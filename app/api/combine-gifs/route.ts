/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';
import { GifReader } from 'omggif';
// Use gifencoder package instead
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
  const frames: { pixels: Uint8ClampedArray; delay: number }[] = [];

  for (let f = 0; f < numFrames; f++) {
    const imageData = new Uint8ClampedArray(w * h * 4);
    
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
    let canvasWidth = 1000;
    let canvasHeight = 1000;
    let maxFrames = 1;
    let hasGifs = false;

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
          canvasWidth = width;
          canvasHeight = height;
          hasGifs = true;
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
          // Use the first static image's dimensions if no GIFs found
          if (!hasGifs) {
            canvasWidth = image.width;
            canvasHeight = image.height;
          }
        }
      } catch (error) {
        console.error(`Failed to load ${url}:`, error);
      }
    }

    console.log(`Canvas size: ${canvasWidth}x${canvasHeight}, Max frames: ${maxFrames}`);

    // Create combined frames
    const combinedFrames: { pixels: Uint8ClampedArray; delay: number }[] = [];

    for (let frameIndex = 0; frameIndex < maxFrames; frameIndex++) {
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      let frameDelay = 100;

      for (const asset of assets) {
        if (asset.isGif) {
          const frameNum = frameIndex % asset.frameCount;
          const frame = asset.frames[frameNum];
          
          // Create temporary canvas for this frame
          const tempCanvas = createCanvas(asset.width, asset.height);
          const tempCtx = tempCanvas.getContext('2d');
          
          // Create ImageData using createImageData instead of new ImageData()
          const imageData = tempCtx.createImageData(asset.width, asset.height);
          imageData.data.set(frame.pixels);
          tempCtx.putImageData(imageData, 0, 0);
          
          // Draw onto main canvas
          ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
          
          frameDelay = Math.max(frameDelay, frame.delay);
        } else {
          // Draw static image
          ctx.drawImage(asset.image, 0, 0, canvasWidth, canvasHeight);
        }
      }

      // Get the combined frame data
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      combinedFrames.push({
        pixels: new Uint8ClampedArray(imageData.data),
        delay: frameDelay
      });
    }

    // Create animated GIF if we have multiple frames or GIF inputs
    if (hasGifs || combinedFrames.length > 1) {
      // Create GIF encoder
      const encoder = new GIFEncoder(canvasWidth, canvasHeight);
      
      // Create a stream to collect the GIF data
      const stream = encoder.createReadStream();
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          // Combine all chunks into a single buffer
          const gifBuffer = Buffer.concat(chunks);
          const dataUrl = `data:image/gif;base64,${gifBuffer.toString('base64')}`;
          
          resolve(NextResponse.json({ 
            success: true, 
            imageData: dataUrl, 
            format: 'gif',
            frameCount: combinedFrames.length,
            message: 'Animated GIF created successfully'
          }));
        });
        
        // Start the encoder
        encoder.start();
        encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
        encoder.setDelay(100); // Default delay, will be overridden per frame
        encoder.setQuality(10); // Image quality (1-20)
        
        // Add each frame to the GIF
        for (const frame of combinedFrames) {
          encoder.setDelay(frame.delay);
          
          // Create a canvas for this frame
          const frameCanvas = createCanvas(canvasWidth, canvasHeight);
          const frameCtx = frameCanvas.getContext('2d');
          
          // Create ImageData and put it on the canvas
          const imageData = frameCtx.createImageData(canvasWidth, canvasHeight);
          imageData.data.set(frame.pixels);
          frameCtx.putImageData(imageData, 0, 0);
          
          // Add the frame to the encoder
          encoder.addFrame(frameCtx as any);
        }
        
        // Finish the GIF
        encoder.finish();
      });
    } else {
      // Fallback to PNG for single frame
      const firstFrame = combinedFrames[0];
      const resultCanvas = createCanvas(canvasWidth, canvasHeight);
      const resultCtx = resultCanvas.getContext('2d');
      
      // Create ImageData using createImageData
      const resultImageData = resultCtx.createImageData(canvasWidth, canvasHeight);
      resultImageData.data.set(firstFrame.pixels);
      resultCtx.putImageData(resultImageData, 0, 0);

      const pngBuffer = resultCanvas.toBuffer('image/png');
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      return NextResponse.json({ 
        success: true, 
        imageData: dataUrl, 
        format: 'png',
        frameCount: 1,
        message: 'PNG created from static images'
      });
    }

  } catch (error) {
    console.error('Error combining images:', error);
    return NextResponse.json({ 
      error: 'Failed to combine images', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}