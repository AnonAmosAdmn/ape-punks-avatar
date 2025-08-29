/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { GifReader } from 'omggif';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

async function fetchImageWithRetry(url: string, retries = 3): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  throw new Error('Failed to fetch image');
}

function extractGifFrames(reader: any) {
  const w = reader.width;
  const h = reader.height;
  const frames: { pixels: Uint8Array; delay: number }[] = [];

  for (let f = 0; f < reader.numFrames(); f++) {
    const imageData = new Uint8Array(w * h * 4);
    
    if (typeof reader.decodeAndBlitFrameRGBA === 'function') {
      reader.decodeAndBlitFrameRGBA(f, imageData);
    } else if (typeof reader.decodeAndBlitFrameBGRA === 'function') {
      const bgraData = new Uint8Array(w * h * 4);
      reader.decodeAndBlitFrameBGRA(f, bgraData);
      
      // Convert BGRA to RGBA
      for (let i = 0; i < bgraData.length; i += 4) {
        imageData[i] = bgraData[i + 2];     // R
        imageData[i + 1] = bgraData[i + 1]; // G
        imageData[i + 2] = bgraData[i];     // B
        imageData[i + 3] = bgraData[i + 3]; // A
      }
    }
    
    const frameInfo = reader.frameInfo(f);
    const delayMs = (typeof frameInfo.delay === 'number' ? frameInfo.delay : 10) * 10;
    frames.push({ pixels: imageData, delay: delayMs });
  }

  return { width: w, height: h, frames };
}

function compositeImages(base: Uint8Array, overlay: Uint8Array): Uint8Array {
  const result = new Uint8Array(base.length);

  for (let i = 0; i < base.length; i += 4) {
    const baseAlpha = base[i + 3] / 255;
    const overlayAlpha = overlay[i + 3] / 255;
    const alpha = overlayAlpha + baseAlpha * (1 - overlayAlpha);

    if (alpha === 0) {
      result[i] = result[i + 1] = result[i + 2] = result[i + 3] = 0;
    } else {
      result[i] = Math.round((overlay[i] * overlayAlpha + base[i] * baseAlpha * (1 - overlayAlpha)) / alpha);
      result[i + 1] = Math.round((overlay[i + 1] * overlayAlpha + base[i + 1] * baseAlpha * (1 - overlayAlpha)) / alpha);
      result[i + 2] = Math.round((overlay[i + 2] * overlayAlpha + base[i + 2] * baseAlpha * (1 - overlayAlpha)) / alpha);
      result[i + 3] = Math.round(alpha * 255);
    }
  }

  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { traitUrls } = await request.json();
    if (!traitUrls || !Array.isArray(traitUrls)) {
      return NextResponse.json({ error: 'Invalid input: traitUrls must be an array' }, { status: 400 });
    }

    const validUrls = traitUrls.filter(Boolean).map((url: string) => {
      if (url.startsWith('/')) {
        const baseUrl = 'https://ape-punks-avatar.vercel.app/';
        return `${baseUrl}${url}`;
      }
      return url;
    });

    const assets: Array<any> = [];
    let canvasWidth = 1000;
    let canvasHeight = 1000;
    let maxFrames = 1;
    let hasGifs = false;

    for (const url of validUrls) {
      try {
        const buffer = await fetchImageWithRetry(url);
        if (url.toLowerCase().endsWith('.gif')) {
          const reader = new GifReader(buffer);
          const { width, height, frames } = extractGifFrames(reader);
          maxFrames = Math.max(maxFrames, frames.length);
          assets.push({ isGif: true, width, height, frames, frameCount: frames.length });
          canvasWidth = width;
          canvasHeight = height;
          hasGifs = true;
        } else {
          // Handle static images (PNG, JPEG)
          // You'll need to implement this based on your needs
          console.log('Static image detected:', url);
        }
      } catch (e) {
        console.error(`Failed to load ${url}`, e);
      }
    }

    if (assets.length === 0) {
      return NextResponse.json({ error: 'No valid images could be loaded' }, { status: 400 });
    }

    // Combine frames
    const combinedFrames: { pixels: Uint8Array; delay: number }[] = [];
    for (let frameIndex = 0; frameIndex < maxFrames; frameIndex++) {
      let basePixels: Uint8Array | null = null;
      let frameDelay = 100;

      for (const asset of assets) {
        if (!asset.isGif) continue; // Skip non-GIF assets for now
        
        const frameNum = frameIndex % asset.frameCount;
        const frame = asset.frames[frameNum];

        if (!basePixels) {
          basePixels = new Uint8Array(frame.pixels);
        } else {
          basePixels = compositeImages(basePixels, frame.pixels);
        }

        frameDelay = Math.max(frameDelay, frame.delay);
      }

      if (basePixels) combinedFrames.push({ pixels: basePixels, delay: frameDelay });
    }

    if (combinedFrames.length === 0) {
      return NextResponse.json({ error: 'No frames to generate GIF' }, { status: 400 });
    }

    // Generate GIF
    if (hasGifs || combinedFrames.length > 1) {
      // Create a global palette from all frames
      const allPixels = new Uint8Array(combinedFrames.length * canvasWidth * canvasHeight * 4);
      for (let i = 0; i < combinedFrames.length; i++) {
        allPixels.set(combinedFrames[i].pixels, i * canvasWidth * canvasHeight * 4);
      }
      
      const globalPalette = quantize(allPixels, 256);
      const encoder: any = new (GIFEncoder as any)(canvasWidth, canvasHeight);

      // Add frames with the global palette
      for (let i = 0; i < combinedFrames.length; i++) {
        const frame = combinedFrames[i];
        const indexed = applyPalette(frame.pixels, globalPalette);

        if (i === 0) {
          encoder.writeFrame(indexed, canvasWidth, canvasHeight, {
            palette: globalPalette,
            delay: Math.max(1, Math.floor(frame.delay / 10)),
          });
        } else {
          encoder.writeFrame(indexed, canvasWidth, canvasHeight, {
            delay: Math.max(1, Math.floor(frame.delay / 10)),
          });
        }
      }

      encoder.finish();
      const gifBuffer = Buffer.from(encoder.bytes());
      const dataUrl = `data:image/gif;base64,${gifBuffer.toString('base64')}`;

      return NextResponse.json({
        success: true,
        imageData: dataUrl,
        format: 'gif',
        frameCount: combinedFrames.length,
        message: 'Animated GIF created successfully',
      });
    }

    // PNG fallback for single frame
    const firstFrame = combinedFrames[0];
    const base64Data = Buffer.from(firstFrame.pixels).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Data}`;

    return NextResponse.json({
      success: true,
      imageData: dataUrl,
      format: 'png',
      frameCount: 1,
      message: 'PNG created from static images',
    });
  } catch (error) {
    console.error('Error combining images:', error);
    return NextResponse.json(
      { error: 'Failed to combine images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}