/* eslint-disable @typescript-eslint/no-explicit-any */

// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';

// Import the omggif library
import { GifReader } from 'omggif';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

interface ProcessedGif {
  type: keyof AvatarTraits;
  frames: ImageData[];
  delays: number[];
  width: number;
  height: number;
  currentFrame: number;
  lastUpdate: number;
}

interface StaticImage {
  type: keyof AvatarTraits;
  element: HTMLImageElement;
}

export default function CombinedPreview({
  traits,
  onGifGenerated,
  onProcessingStateChange,
}: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const gifDataRef = useRef<ProcessedGif[]>([]);
  const staticImagesRef = useRef<StaticImage[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Update container size based on window size
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768;
        const size = isMobile ? 280 : 400;
        setContainerSize({ width: size, height: size });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Process traits when they change
  useEffect(() => {
    const processTraits = async () => {
      onProcessingStateChange(true);
      setError(null);
      
      // Clear previous data
      gifDataRef.current = [];
      staticImagesRef.current = [];
      cancelAnimationFrame(animationFrameRef.current);
      
      const traitOrder: (keyof AvatarTraits)[] = [
        'background',
        'fur',
        'mouth',
        'head',
        'mask',
        'eyes',
        'minion',
      ];

      // Check if any traits are selected
      const hasTraits = Object.values(traits).some((trait) => trait !== null);
      if (!hasTraits) {
        onProcessingStateChange(false);
        return;
      }

      try {
        // Process each trait
        for (const traitType of traitOrder) {
          const trait = traits[traitType];
          if (!trait) continue;

          if (trait.image.endsWith('.gif')) {
            // Process GIF trait using omggif
            await processGifTrait(traitType, trait.image);
          } else {
            // Process static image trait
            await processStaticTrait(traitType, trait.image);
          }
        }

        // Start animation if we have GIFs
        if (gifDataRef.current.length > 0) {
          lastFrameTimeRef.current = performance.now();
          requestAnimationFrame(drawFrame);
        } else {
          // Just draw static images
          drawStaticImages();
          onProcessingStateChange(false);
        }
      } catch (error) {
        console.error('Error processing traits:', error);
        setError('Failed to load avatar traits');
        onProcessingStateChange(false);
      }
    };

    processTraits();
  }, [traits, onProcessingStateChange]);

  // Process a GIF trait using omggif (similar to API route)
  const processGifTrait = async (type: keyof AvatarTraits, url: string) => {
    try {
      // Fetch the GIF data
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Parse the GIF using omggif
      const reader = new GifReader(buffer);
      const width = reader.width;
      const height = reader.height;
      
      // Extract all frames using the same method as API route
      const frames: ImageData[] = [];
      const delays: number[] = [];
      
      for (let f = 0; f < reader.numFrames(); f++) {
        // Create RGBA buffer for the frame
        const imageData = new Uint8ClampedArray(width * height * 4);
        
        // Use the appropriate decoding method (same as API route)
        if (typeof (reader as any).decodeAndBlitFrameRGBA === 'function') {
          (reader as any).decodeAndBlitFrameRGBA(f, imageData);
        } else if (typeof (reader as any).decodeAndBlitFrameBGRA === 'function') {
          const bgraData = new Uint8Array(width * height * 4);
          (reader as any).decodeAndBlitFrameBGRA(f, bgraData);
          
          // Convert BGRA to RGBA (same as API route)
          for (let i = 0; i < bgraData.length; i += 4) {
            imageData[i] = bgraData[i + 2];     // R
            imageData[i + 1] = bgraData[i + 1]; // G
            imageData[i + 2] = bgraData[i];     // B
            imageData[i + 3] = bgraData[i + 3]; // A
          }
        }
        
        // Get frame info and delay (same as API route)
        const frameInfo = (reader as any).frameInfo(f);
        const delayMs = (typeof frameInfo.delay === 'number' ? frameInfo.delay : 10) * 10;
        
        // Create ImageData object for the frame
        const frameImageData = new ImageData(
          new Uint8ClampedArray(imageData.buffer),
          width,
          height
        );
        
        frames.push(frameImageData);
        delays.push(delayMs);
      }
      
      // Add to GIF data
      gifDataRef.current.push({
        type,
        frames,
        delays,
        width,
        height,
        currentFrame: 0,
        lastUpdate: 0
      });
    } catch (error) {
      console.error(`Error processing GIF for ${type}:`, error);
      throw new Error(`Failed to process ${type} GIF`);
    }
  };

  // Process a static image trait
  const processStaticTrait = (type: keyof AvatarTraits, url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        staticImagesRef.current.push({ type, element: img });
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load ${type} image`));
      };
    });
  };

  // Get the z-index for proper layering
  const getZIndex = useCallback((traitType: keyof AvatarTraits): number => {
    const order: (keyof AvatarTraits)[] = [
      'background',
      'fur',
      'mouth',
      'head',
      'mask',
      'eyes',
      'minion',
    ];
    return order.indexOf(traitType);
  }, []);

  // Draw a single frame with proper synchronization
  const drawFrame = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas || gifDataRef.current.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw static images first (background layers)
    drawStaticImages(ctx);
    
    // Update and draw GIFs with proper timing
    let needsNextFrame = false;
    const currentTime = performance.now();
    
    // Sort GIFs by z-index for proper layering
    const sortedGifs = [...gifDataRef.current].sort((a, b) => 
      getZIndex(a.type) - getZIndex(b.type)
    );
    
    for (const gif of sortedGifs) {
      // Check if it's time to advance the frame
      const timeSinceLastUpdate = currentTime - gif.lastUpdate;
      
      if (timeSinceLastUpdate >= gif.delays[gif.currentFrame]) {
        gif.currentFrame = (gif.currentFrame + 1) % gif.frames.length;
        gif.lastUpdate = currentTime;
        needsNextFrame = true;
      }
      
      // Draw the current frame
      const frameData = gif.frames[gif.currentFrame];
      
      // Create a temporary canvas for this GIF frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = gif.width;
      tempCanvas.height = gif.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.putImageData(frameData, 0, 0);
        
        // Draw the frame onto the main canvas, scaled to container size
        ctx.drawImage(
          tempCanvas, 
          0, 0, gif.width, gif.height,
          0, 0, containerSize.width, containerSize.height
        );
      }
    }
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  // Draw static images
  const drawStaticImages = (ctx?: CanvasRenderingContext2D | null) => {
    if (!ctx) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      if (!ctx) return;
    }
    
    // Sort by z-index
    const sortedImages = [...staticImagesRef.current].sort((a, b) => 
      getZIndex(a.type) - getZIndex(b.type)
    );
    
    // Draw each static image
    for (const { element } of sortedImages) {
      ctx.drawImage(element, 0, 0, containerSize.width, containerSize.height);
    }
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="avatar-container mx-auto border-4 border-indigo-600 rounded-lg bg-gray-900 relative overflow-hidden"
        style={{
          width: `${containerSize.width}px`,
          height: `${containerSize.height}px`,
          maxWidth: '100%',
        }}
      >
        {Object.values(traits).every((trait) => trait === null) ? (
          <div className="no-traits-message flex items-center justify-center h-full text-gray-500 text-center p-4">
            Select traits to build your avatar
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={containerSize.width}
            height={containerSize.height}
            className="w-full h-full"
          />
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">{error}</div>
      )}
    </div>
  );
}