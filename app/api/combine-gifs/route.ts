/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage, ImageData } from 'canvas';
import fetch from 'node-fetch';
import { GifReader } from 'omggif';
import GIFEncoder from 'gifencoder';

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
  const numFrames = reader.numFrames();
  const decodeRGBA = typeof reader.decodeAndBlitFrameRGBA === 'function';
  const decodeBGRA = typeof reader.decodeAndBlitFrameBGRA === 'function';
  const frames: { pixels: Uint8ClampedArray; delay: number }[] = [];

  for (let f = 0; f < numFrames; f++) {
    const raw = new Uint8Array(w * h * 4);
    if (decodeRGBA) {
      reader.decodeAndBlitFrameRGBA(f, raw);
    } else if (decodeBGRA) {
      reader.decodeAndBlitFrameBGRA(f, raw);
      // Convert BGRA to RGBA
      for (let i = 0; i < raw.length; i += 4) {
        const b = raw[i + 0];
        const g = raw[i + 1];
        const r = raw[i + 2];
        const a = raw[i + 3];
        raw[i + 0] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
        raw[i + 3] = a;
      }
    }
    const frameInfo = reader.frameInfo(f);
    const delayMs = (typeof frameInfo.delay === 'number' ? frameInfo.delay : 10) * 10;
    frames.push({ pixels: new Uint8ClampedArray(raw.buffer), delay: delayMs });
  }
  return { width: w, height: h, frames };
}

export async function POST(request: NextRequest) {
  try {
    const { traitUrls } = await request.json();

    if (!traitUrls || !Array.isArray(traitUrls)) {
      return NextResponse.json({ error: 'Invalid input: traitUrls must be an array' }, { status: 400 });
    }

    const validUrls = traitUrls.filter(Boolean).map((url: string) => {
      if (url.startsWith('/')) {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
        return `${baseUrl}${url}`;
      }
      return url;
    });

    if (validUrls.length === 0) {
      return NextResponse.json({ error: 'No valid image URLs provided' }, { status: 400 });
    }

    const layerOrder = ['background', 'fur', 'face', 'eyes', 'mouth', 'head', 'mask', 'minion'];
    const sortedUrls = validUrls.sort((a: string, b: string) => {
      const idx = (url: string) => {
        for (let i = 0; i < layerOrder.length; i++) if (url.includes(`/${layerOrder[i]}/`)) return i;
        return layerOrder.length;
      };
      return idx(a) - idx(b);
    });

    console.log('Processing layers in order:', sortedUrls);

    const assets: Array<any> = [];
    let canvasWidth = 0;
    let canvasHeight = 0;
    let maxFrames = 1;

    for (const url of sortedUrls) {
      try {
        console.log(`Loading: ${url}`);
        const buffer = await fetchImageWithRetry(url);
        
        if (url.toLowerCase().endsWith('.gif')) {
          const reader = new GifReader(buffer);
          const { width, height, frames } = extractGifFrames(reader);
          console.log(`GIF loaded: ${frames.length} frames, ${width}x${height}`);
          maxFrames = Math.max(maxFrames, frames.length);
          assets.push({ 
            isGif: true, 
            width, 
            height, 
            frames, 
            frameCount: frames.length,
            url 
          });
          if (!canvasWidth) { 
            canvasWidth = width; 
            canvasHeight = height; 
          }
        } else {
          const image = await loadImage(buffer);
          console.log(`Static image loaded: ${image.width}x${image.height}`);
          assets.push({ 
            isGif: false, 
            image, 
            width: image.width, 
            height: image.height,
            url 
          });
          if (!canvasWidth) { 
            canvasWidth = image.width; 
            canvasHeight = image.height; 
          }
        }
      } catch (error) {
        console.error(`Failed to load ${url}:`, error);
        // Continue with other assets
      }
    }

    // Set default dimensions if none were found
    if (!canvasWidth) { 
      canvasWidth = 1000; 
      canvasHeight = 1000; 
    }

    console.log(`Canvas size: ${canvasWidth}x${canvasHeight}, Max frames: ${maxFrames}`);

    // If no GIFs were found, create a simple PNG
    const hasGifs = assets.some(asset => asset.isGif);
    if (!hasGifs) {
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      for (const asset of assets) {
        if (!asset.isGif) {
          ctx.drawImage(asset.image, 0, 0, canvasWidth, canvasHeight);
        }
      }

      const pngBuffer = canvas.toBuffer('image/png');
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      return NextResponse.json({ 
        success: true, 
        imageData: dataUrl, 
        format: 'png',
        message: 'PNG created from static images'
      });
    }

    // Create GIF with all frames
    const encoder = new GIFEncoder(canvasWidth, canvasHeight);
    const chunks: Buffer[] = [];

    // Set up stream to collect GIF data
    const stream = encoder.createReadStream();
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    encoder.start();
    encoder.setRepeat(0); // Infinite loop
    encoder.setDelay(100); // Default delay
    encoder.setQuality(10); // Lower quality for smaller file size

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let frameIndex = 0; frameIndex < maxFrames; frameIndex++) {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      let frameDelay = 100;

      for (const asset of assets) {
        if (asset.isGif) {
          const frameNum = frameIndex % asset.frameCount;
          const frame = asset.frames[frameNum];
          
          // Create temporary canvas for this frame
          const tempCanvas = createCanvas(asset.width, asset.height);
          const tempCtx = tempCanvas.getContext('2d');
          const imageData = new ImageData(frame.pixels, asset.width, asset.height);
          tempCtx.putImageData(imageData, 0, 0);
          
          // Draw onto main canvas
          ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
          
          // Use this frame's delay if available
          if (frame.delay) {
            frameDelay = Math.max(frameDelay, frame.delay);
          }
        } else {
          // Draw static image
          ctx.drawImage(asset.image, 0, 0, canvasWidth, canvasHeight);
        }
      }

      // Set delay for this frame
      encoder.setDelay(frameDelay);
      encoder.addFrame(ctx as any);
    }

    encoder.finish();

    // Wait for stream to finish
    await new Promise((resolve) => {
      stream.on('end', resolve);
    });

    const outputBuffer = Buffer.concat(chunks);
    const dataUrl = `data:image/gif;base64,${outputBuffer.toString('base64')}`;

    return NextResponse.json({ 
      success: true, 
      imageData: dataUrl, 
      format: 'gif',
      frameCount: maxFrames,
      message: 'GIF created successfully'
    });

  } catch (error) {
    console.error('Error combining GIFs:', error);
    return NextResponse.json({ 
      error: 'Failed to combine GIFs', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}