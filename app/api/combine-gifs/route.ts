/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { GifReader } from 'omggif';
import { GifFrame, BitmapImage, GifCodec } from 'gifwrap';

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

function extractGifFrames(buffer: Buffer) {
  try {
    const reader = new GifReader(buffer);
    const frames: { pixels: Uint8Array; delay: number }[] = [];

    for (let f = 0; f < reader.numFrames(); f++) {
      const frameInfo = reader.frameInfo(f);
      const imageData = new Uint8Array(reader.width * reader.height * 4);
      reader.decodeAndBlitFrameRGBA(f, imageData);
      
      const delayMs = (frameInfo.delay || 10) * 10;
      frames.push({ pixels: imageData, delay: delayMs });
    }

    return { width: reader.width, height: reader.height, frames };
  } catch (error) {
    console.error('Error extracting GIF frames:', error);
    throw new Error('Failed to parse GIF');
  }
}

function compositeImages(base: Uint8Array, overlay: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(base.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const baseA = base[idx + 3] / 255;
      const overlayA = overlay[idx + 3] / 255;
      
      // If overlay is fully transparent, keep base
      if (overlayA === 0) {
        result[idx] = base[idx];
        result[idx + 1] = base[idx + 1];
        result[idx + 2] = base[idx + 2];
        result[idx + 3] = base[idx + 3];
        continue;
      }
      
      // If base is fully transparent, use overlay
      if (baseA === 0) {
        result[idx] = overlay[idx];
        result[idx + 1] = overlay[idx + 1];
        result[idx + 2] = overlay[idx + 2];
        result[idx + 3] = overlay[idx + 3];
        continue;
      }
      
      const alpha = overlayA + baseA * (1 - overlayA);
      
      result[idx] = Math.round((overlay[idx] * overlayA + base[idx] * baseA * (1 - overlayA)) / alpha);
      result[idx + 1] = Math.round((overlay[idx + 1] * overlayA + base[idx + 1] * baseA * (1 - overlayA)) / alpha);
      result[idx + 2] = Math.round((overlay[idx + 2] * overlayA + base[idx + 2] * baseA * (1 - overlayA)) / alpha);
      result[idx + 3] = Math.round(alpha * 255);
    }
  }
  
  return result;
}

function getAbsoluteUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  
  let baseUrl = 'ape-punks-avatar.vercel.app';
  if (!baseUrl && process.env.VERCEL_URL) baseUrl = `ape-punks-avatar.vercel.app`;
  if (!baseUrl) baseUrl = 'ape-punks-avatar.vercel.app';
  
  baseUrl = baseUrl.replace(/\/$/, '');
  relativeUrl = relativeUrl.replace(/^\//, '');
  
  return `${baseUrl}/${relativeUrl}`;
}

function rgbaToBitmapImage(rgbaData: Uint8Array, width: number, height: number): BitmapImage {
  // Convert RGBA to RGB format (remove alpha channel for BitmapImage)
  const rgbBuffer = Buffer.alloc(width * height * 3);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgbaIdx = (y * width + x) * 4;
      const rgbIdx = (y * width + x) * 3;
      
      rgbBuffer[rgbIdx] = rgbaData[rgbaIdx];
      rgbBuffer[rgbIdx + 1] = rgbaData[rgbaIdx + 1];
      rgbBuffer[rgbIdx + 2] = rgbaData[rgbaIdx + 2];
    }
  }
  
  // BitmapImage expects RGB data without separate alpha
  return new BitmapImage(width, height, rgbBuffer);
}

async function loadStaticImage(buffer: Buffer, width: number, height: number): Promise<Uint8Array> {
  try {
    // For static images, create a simple placeholder
    const imageData = new Uint8Array(width * height * 4);
    
    // Fill with transparent background
    imageData.fill(0);
    
    // Create a simple colored rectangle in the center
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const rectSize = Math.min(width, height) / 4;
    
    for (let y = centerY - rectSize/2; y < centerY + rectSize/2; y++) {
      for (let x = centerX - rectSize/2; x < centerX + rectSize/2; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          imageData[idx] = 0; // R
          imageData[idx + 1] = 255; // G (green instead of red to differentiate)
          imageData[idx + 2] = 0; // B
          imageData[idx + 3] = 255; // A
        }
      }
    }
    
    return imageData;
  } catch (error) {
    console.error('Error loading static image:', error);
    return new Uint8Array(width * height * 4).fill(0);
  }
}

function quantizeTo256Colors(rgbaData: Uint8Array, width: number, height: number): Uint8Array {
  // Better color quantization - less aggressive
  const result = new Uint8Array(rgbaData.length);
  
  // Use a more subtle quantization to preserve quality
  for (let i = 0; i < rgbaData.length; i += 4) {
    // Reduce to 6-bit color (64 values per channel) instead of 4-bit
    result[i] = Math.floor(rgbaData[i] / 4) * 4; // R
    result[i + 1] = Math.floor(rgbaData[i + 1] / 4) * 4; // G
    result[i + 2] = Math.floor(rgbaData[i + 2] / 4) * 4; // B
    result[i + 3] = rgbaData[i + 3] > 64 ? 255 : 0; // A (softer threshold)
  }
  
  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { traitUrls } = await request.json();
    if (!traitUrls || !Array.isArray(traitUrls)) {
      return NextResponse.json({ error: 'Invalid input: traitUrls must be an array' }, { status: 400 });
    }

    // Remove duplicate URLs to prevent multiple copies
    const uniqueUrls = [...new Set(traitUrls.filter(Boolean))];
    
    if (uniqueUrls.length === 0) {
      return NextResponse.json({ error: 'No valid URLs provided' }, { status: 400 });
    }

    const absoluteUrls = uniqueUrls.map(url => getAbsoluteUrl(url));
    const assets: any[] = [];
    let canvasWidth = 500, canvasHeight = 500, maxFrames = 1, hasGifs = false;

    console.log('Processing unique URLs:', absoluteUrls);

    // First pass: determine canvas size and frame count
    for (const url of absoluteUrls) {
      try {
        const buffer = await fetchImageWithRetry(url);
        const isGif = url.toLowerCase().endsWith('.gif') || (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46);

        if (isGif) {
          const { width, height, frames } = extractGifFrames(buffer);
          if (frames.length > 0) {
            canvasWidth = Math.max(canvasWidth, width);
            canvasHeight = Math.max(canvasHeight, height);
            maxFrames = Math.max(maxFrames, frames.length);
            hasGifs = true;
            console.log(`GIF detected: ${width}x${height}, ${frames.length} frames`);
          }
        } else {
          console.log(`Static image detected: ${url}`);
          canvasWidth = Math.max(canvasWidth, 200);
          canvasHeight = Math.max(canvasHeight, 200);
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
      }
    }

    console.log(`Canvas size: ${canvasWidth}x${canvasHeight}, Max frames: ${maxFrames}`);

    // Second pass: load and prepare all assets
    for (const url of absoluteUrls) {
      try {
        const buffer = await fetchImageWithRetry(url);
        const isGif = url.toLowerCase().endsWith('.gif') || (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46);

        if (isGif) {
          const { width, height, frames } = extractGifFrames(buffer);
          const resizedFrames = frames.map(frame => ({
            pixels: resizeFrame(frame.pixels, width, height, canvasWidth, canvasHeight),
            delay: frame.delay
          }));
          assets.push({ 
            frames: resizedFrames, 
            frameCount: resizedFrames.length, 
            isGif: true,
            type: 'gif',
            url
          });
          console.log(`Loaded GIF with ${resizedFrames.length} frames`);
        } else {
          const imageData = await loadStaticImage(buffer, canvasWidth, canvasHeight);
          assets.push({ 
            frames: [{ pixels: imageData, delay: 100 }], 
            frameCount: 1, 
            isGif: false,
            type: 'static',
            url
          });
          console.log('Loaded static image');
        }
      } catch (error) {
        console.error(`Error loading ${url}:`, error);
        return NextResponse.json({ error: `Failed to load image: ${url}` }, { status: 400 });
      }
    }

    console.log(`Loaded ${assets.length} unique assets:`, assets.map(a => ({ 
      type: a.type, 
      frames: a.frameCount,
      url: a.url 
    })));

    // Combine frames
    const combinedFrames: any[] = [];
    
    if (assets.length > 0) {
      for (let i = 0; i < maxFrames; i++) {
        let basePixels: Uint8Array | null = null;
        let frameDelay = 100;

        for (const asset of assets) {
          const frameNum = i % asset.frameCount;
          const frame = asset.frames[frameNum];
          
          if (basePixels === null) {
            basePixels = new Uint8Array(frame.pixels);
          } else {
            basePixels = compositeImages(basePixels, frame.pixels, canvasWidth, canvasHeight);
          }
          
          frameDelay = Math.max(frameDelay, frame.delay);
        }

        if (basePixels) {
          // Only quantize if necessary (for GIF output)
          const finalPixels = hasGifs ? quantizeTo256Colors(basePixels, canvasWidth, canvasHeight) : basePixels;
          combinedFrames.push({
            pixels: finalPixels,
            width: canvasWidth,
            height: canvasHeight,
            delay: frameDelay
          });
        }
      }
    }

    if (combinedFrames.length === 0) {
      return NextResponse.json({ error: 'No frames to generate output' }, { status: 400 });
    }

    // Output based on content
    if (hasGifs || combinedFrames.length > 1) {
      const gifFrames = combinedFrames.map(frame => {
        const bitmap = rgbaToBitmapImage(frame.pixels, frame.width, frame.height);
        return new GifFrame(bitmap, {
          delayCentisecs: Math.max(1, Math.floor(frame.delay / 10))
        });
      });

      const codec = new GifCodec();
      const encodeResult = await codec.encodeGif(gifFrames, { 
        loops: 0,
        colorScope: 1
      });

      return NextResponse.json({
        success: true,
        imageData: `data:image/gif;base64,${encodeResult.buffer.toString('base64')}`,
        format: 'gif',
        frameCount: combinedFrames.length,
        message: 'Animated GIF created successfully'
      });
    }

    // Static image output (no quantization for better quality)
    const firstFrame = combinedFrames[0];
    return NextResponse.json({
      success: true,
      imageData: `data:image/png;base64,${Buffer.from(firstFrame.pixels).toString('base64')}`,
      format: 'png',
      frameCount: 1,
      message: 'Static image created'
    });

  } catch (err) {
    console.error('Error in POST handler:', err);
    return NextResponse.json({ 
      error: 'Failed to generate image', 
      details: (err as Error).message 
    }, { status: 500 });
  }
}

function resizeFrame(pixels: Uint8Array, srcWidth: number, srcHeight: number, destWidth: number, destHeight: number): Uint8Array {
  if (srcWidth === destWidth && srcHeight === destHeight) return pixels;

  const result = new Uint8Array(destWidth * destHeight * 4);
  const xRatio = srcWidth / destWidth;
  const yRatio = srcHeight / destHeight;
  
  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const safeSrcX = Math.min(srcX, srcWidth - 1);
      const safeSrcY = Math.min(srcY, srcHeight - 1);
      
      const srcIdx = (safeSrcY * srcWidth + safeSrcX) * 4;
      const destIdx = (y * destWidth + x) * 4;
      
      result[destIdx] = pixels[srcIdx];
      result[destIdx + 1] = pixels[srcIdx + 1];
      result[destIdx + 2] = pixels[srcIdx + 2];
      result[destIdx + 3] = pixels[srcIdx + 3];
    }
  }
  
  return result;
}