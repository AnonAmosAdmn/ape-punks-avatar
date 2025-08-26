// app/components/GifGenerator.tsx
'use client';

import { useEffect, useRef } from 'react';
import GIF from 'gif.js';

interface GifGeneratorProps {
  traits: unknown;
  onGifGenerated: (url: string) => void;
}

export default function GifGenerator({ traits, onGifGenerated }: GifGeneratorProps) {
  const gifRef = useRef<unknown>(null);

  useEffect(() => {
    // Check if any traits are selected
    const hasTraits = Object.values(traits).some(trait => trait !== null);
    if (!hasTraits) return;

    const generateGif = async () => {
      try {
        // Initialize GIF.js
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: 500,
          height: 500,
          workerScript: '/gif.worker.js' // You'll need to serve this file
        });

        gifRef.current = gif;

        // Create a temporary canvas to draw each frame
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Load all trait images
        const images = await Promise.all(
          Object.values(traits)
            .filter(trait => trait !== null)
            .map(trait => {
              return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = trait.image;
              });
            })
        );

        // Draw all images on the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const image of images) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        // Add the frame to the GIF
        gif.addFrame(ctx, { copy: true, delay: 100 });

        // Generate the GIF
        gif.on('finished', (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          onGifGenerated(url);
        });

        gif.render();
      } catch (error) {
        console.error('Error generating GIF:', error);
      }
    };

    generateGif();

    return () => {
      if (gifRef.current) {
        gifRef.current.abort();
      }
    };
  }, [traits, onGifGenerated]);

  return null;
}