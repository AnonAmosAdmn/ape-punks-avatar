// app/api/combine-gifs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

// Helper function to fetch image with retry logic
async function fetchImageWithRetry(url: string, retries = 3): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  throw new Error('Failed to fetch image');
}

export async function POST(request: NextRequest) {
  try {
    const { traitUrls } = await request.json();
    
    if (!traitUrls || !Array.isArray(traitUrls)) {
      return NextResponse.json(
        { error: 'Invalid input: traitUrls must be an array' },
        { status: 400 }
      );
    }

    // Filter out null/empty URLs and ensure absolute URLs
    const validUrls = traitUrls
      .filter(url => url && url !== '')
      .map(url => {
        if (url.startsWith('/')) {
          // Convert relative URLs to absolute
          const baseUrl = process.env.NEXTAUTH_URL || 
                         process.env.VERCEL_URL || 
                         'http://localhost:3000';
          return `${baseUrl}${url}`;
        }
        return url;
      });
    
    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid image URLs provided' },
        { status: 400 }
      );
    }

    // Create canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');

    // Clear with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Define the correct layer order
    const layerOrder = [
      'background', 'fur', 'face', 'eyes', 'mouth', 'head', 'mask', 'minion'
    ];

    // Sort URLs by layer order based on their path
    const sortedUrls = validUrls.sort((a, b) => {
      const getLayerIndex = (url: string) => {
        for (let i = 0; i < layerOrder.length; i++) {
          if (url.includes(`/${layerOrder[i]}/`)) return i;
        }
        return layerOrder.length; // Put unknown layers at the end
      };
      
      return getLayerIndex(a) - getLayerIndex(b);
    });

    console.log('Processing layers in order:', sortedUrls.map(url => {
      const match = url.match(/\/([^\/]+)\/[^\/]+$/);
      return match ? match[1] : 'unknown';
    }));

    // Load and draw each image sequentially
    for (const url of sortedUrls) {
      try {
        console.log(`Loading image: ${url}`);
        const imageBuffer = await fetchImageWithRetry(url);
        const image = await loadImage(imageBuffer);
        
        // Draw the image
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        console.log(`Successfully drawn: ${url}`);
      } catch (error) {
        console.error(`Error processing image ${url}:`, error);
        // Continue with other images
      }
    }

    // Convert to PNG
    const pngBuffer = canvas.toBuffer('image/png');
    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      imageData: dataUrl,
      format: 'png'
    });

  } catch (error) {
    console.error('Error combining images:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to combine images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}