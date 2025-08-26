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

    // Set white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load and draw all images in sequence
    for (const url of traitUrls) {
      try {
        let finalUrl = url;
        
        // Handle relative URLs
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
        
        console.log(`Loading image from: ${finalUrl}`);
        
        const response = await fetch(finalUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch ${finalUrl}: ${response.status}`);
          continue;
        }
        
        const buffer = await response.arrayBuffer();
        const image = await loadImage(Buffer.from(buffer));
        
        // Draw the image
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        console.log(`Successfully drew image: ${finalUrl}`);
        
      } catch (error) {
        console.error(`Error processing image ${url}:`, error);
        // Continue with other images even if one fails
      }
    }

    // Convert to PNG
    const pngBuffer = canvas.toBuffer('image/png');
    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      imageData: dataUrl,
      message: 'Layered image created successfully'
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