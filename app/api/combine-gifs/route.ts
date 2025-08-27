// app/api/combine-gifs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

export async function POST(request: NextRequest) {
  try {
    const { traitUrls } = await request.json();
    
    if (!traitUrls || !Array.isArray(traitUrls) || traitUrls.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: traitUrls must be a non-empty array' },
        { status: 400 }
      );
    }

    // Create canvas
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext('2d');

    // Draw each layer in order
    for (const url of traitUrls) {
      try {
        let finalUrl = url;
        
        if (url.startsWith('/')) {
          if (process.env.NODE_ENV === 'development') {
            finalUrl = `http://localhost:3000${url}`;
          } else {
            const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
              ? `https://${process.env.VERCEL_URL}`
              : 'http://localhost:3000';
            finalUrl = `${baseUrl}${url}`;
          }
        }
        
        const response = await fetch(finalUrl);
        if (!response.ok) continue;
        
        const buffer = await response.arrayBuffer();
        const image = await loadImage(Buffer.from(buffer));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error(`Error processing image ${url}:`, error);
        // Continue with other images even if one fails
      }
    }

    // Convert to PNG first (more reliable), then we'll handle GIF conversion
    const pngBuffer = canvas.toBuffer('image/png');
    
    // For GIF conversion, we'll use a simple approach since canvas GIF support is limited
    // This creates a single-frame GIF (not animated)
    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      imageData: dataUrl,
      message: 'Created static PNG. For animated GIFs, server-side processing is more complex.'
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
