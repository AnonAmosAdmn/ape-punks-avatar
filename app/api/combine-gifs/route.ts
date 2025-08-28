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
      for (let i = 0; i < raw.length; i += 4) {
        const b = raw[i + 0];
        const g = raw[i + 1];
        const r = raw[i + 2];
        raw[i + 0] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
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

    const assets: Array<any> = [];
    let canvasWidth = 0;
    let canvasHeight = 0;
    let maxFrames = 1;

    for (const url of sortedUrls) {
      const buffer = await fetchImageWithRetry(url);
      if (url.toLowerCase().endsWith('.gif')) {
        const reader = new GifReader(buffer);
        const { width, height, frames } = extractGifFrames(reader);
        maxFrames = Math.max(maxFrames, frames.length);
        assets.push({ isGif: true, width, height, frames, frameCount: frames.length });
        if (!canvasWidth) { canvasWidth = width; canvasHeight = height; }
      } else {
        const image = await loadImage(buffer);
        assets.push({ isGif: false, image, width: image.width, height: image.height });
        if (!canvasWidth) { canvasWidth = image.width; canvasHeight = image.height; }
      }
    }

    if (!canvasWidth) { canvasWidth = 1000; canvasHeight = 1000; }

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const encoder = new GIFEncoder(canvasWidth, canvasHeight);
    const stream = encoder.createReadStream();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));

    encoder.start();
    encoder.setRepeat(0);
    encoder.setQuality(10);

    for (let frameIndex = 0; frameIndex < maxFrames; frameIndex++) {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      const delays: number[] = [];
      for (const asset of assets) {
        if (asset.isGif) {
          const frame = asset.frames[frameIndex % asset.frameCount];
          const imageData = new ImageData(frame.pixels, asset.width, asset.height);
          const tmp = createCanvas(asset.width, asset.height);
          const tctx = tmp.getContext('2d');
          tctx.putImageData(imageData, 0, 0);

          // Now draw with alpha compositing
          ctx.drawImage(tmp, 0, 0, canvasWidth, canvasHeight);

          delays.push(frame.delay || 100);
        } else {
          ctx.drawImage(asset.image, 0, 0, canvasWidth, canvasHeight);
          delays.push(100);
        }
      }
      encoder.setDelay(Math.max(20, Math.max(...delays)));
      encoder.addFrame(ctx);
    }

    encoder.finish();
    await new Promise((resolve) => stream.on('end', resolve));

    const outputBuffer = Buffer.concat(chunks);
    const dataUrl = `data:image/gif;base64,${outputBuffer.toString('base64')}`;

    return NextResponse.json({ success: true, imageData: dataUrl, format: 'gif' });
  } catch (error) {
    console.error('Error combining GIFs:', error);
    return NextResponse.json({ error: 'Failed to combine GIFs', details: (error as Error).message }, { status: 500 });
  }
}
