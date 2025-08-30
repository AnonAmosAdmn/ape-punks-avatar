// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

interface GifFrame {
  imageData: ImageData;
  delay: number;
}

interface LoadedGif {
  type: keyof AvatarTraits;
  frames: GifFrame[];
  currentFrame: number;
  lastUpdate: number;
  isPlaying: boolean;
}

export default function CombinedPreview({
  traits,
  onGifGenerated,
  onProcessingStateChange,
}: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  const animationRef = useRef<number>();
  const gifDataRef = useRef<Map<keyof AvatarTraits, LoadedGif>>(new Map());
  const staticImagesRef = useRef<Map<keyof AvatarTraits, HTMLImageElement>>(new Map());

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Extract frames from GIF using a canvas-based approach
  const extractGifFrames = useCallback(async (url: string): Promise<GifFrame[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        
        // For non-GIF images, just return one frame
        if (!url.endsWith('.gif')) {
          ctx.drawImage(img, 0, 0);
          resolve([{
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            delay: 0
          }]);
          return;
        }

        // For GIFs, we need to extract frames
        // This is a simplified approach - in a production app, you might want to use a library like omggif
        const frames: GifFrame[] = [];
        
        try {
          // Draw the first frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          frames.push({
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            delay: 100 // Default delay for GIFs
          });
        } catch (e) {
          console.error('Error extracting GIF frames:', e);
        }
        
        resolve(frames);
      };
      
      img.onerror = () => {
        resolve([]);
      };
    });
  }, []);

  // Load and process all traits
  useEffect(() => {
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
      gifDataRef.current.clear();
      staticImagesRef.current.clear();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    onProcessingStateChange(true);
    setError(null);

    // Load all images
    const loadImages = async () => {
      gifDataRef.current.clear();
      staticImagesRef.current.clear();
      
      for (const traitType of traitOrder) {
        const trait = traits[traitType];
        if (!trait) continue;

        try {
          const isGif = trait.image.endsWith('.gif');
          
          if (isGif) {
            const frames = await extractGifFrames(trait.image);
            if (frames.length > 0) {
              gifDataRef.current.set(traitType, {
                type: traitType,
                frames,
                currentFrame: 0,
                lastUpdate: performance.now(),
                isPlaying: true
              });
            }
          } else {
            // For static images, just load them normally
            const img = new Image();
            img.src = trait.image;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            staticImagesRef.current.set(traitType, img);
          }
        } catch (err) {
          console.error(`Failed to load ${traitType} image:`, err);
          setError(`Failed to load ${traitType} image`);
        }
      }

      onProcessingStateChange(false);
      
      // Start animation if we have GIFs
      if (gifDataRef.current.size > 0) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Just draw static images
        drawStatic();
      }
    };

    loadImages();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [traits, onProcessingStateChange, extractGifFrames]);

  // Draw static images (no GIFs)
  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw in proper order
    const traitOrder: (keyof AvatarTraits)[] = [
      'background',
      'fur',
      'mouth',
      'head',
      'mask',
      'eyes',
      'minion',
    ];
    
    traitOrder.forEach(traitType => {
      const img = staticImagesRef.current.get(traitType);
      if (img) {
        // Calculate aspect ratio and position
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }
    });
  }, []);

  // Animation loop for synchronized GIF playback
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || gifDataRef.current.size === 0) return;

    const now = performance.now();
    let needsRedraw = false;
    
    // Update all GIF frames
    gifDataRef.current.forEach((gif, traitType) => {
      if (gif.frames.length <= 1) return; // No need to animate single-frame GIFs
      
      const timeSinceLastUpdate = now - gif.lastUpdate;
      const currentFrameDelay = gif.frames[gif.currentFrame].delay;
      
      if (timeSinceLastUpdate >= currentFrameDelay) {
        gif.currentFrame = (gif.currentFrame + 1) % gif.frames.length;
        gif.lastUpdate = now;
        needsRedraw = true;
      }
    });
    
    // Only redraw if at least one GIF has advanced frames
    if (needsRedraw) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw in proper order
      const traitOrder: (keyof AvatarTraits)[] = [
        'background',
        'fur',
        'mouth',
        'head',
        'mask',
        'eyes',
        'minion',
      ];
      
      traitOrder.forEach(traitType => {
        // Draw static images first
        const staticImg = staticImagesRef.current.get(traitType);
        if (staticImg) {
          const scale = Math.min(canvas.width / staticImg.width, canvas.height / staticImg.height);
          const x = (canvas.width - staticImg.width * scale) / 2;
          const y = (canvas.height - staticImg.height * scale) / 2;
          
          ctx.drawImage(staticImg, x, y, staticImg.width * scale, staticImg.height * scale);
        }
        
        // Then draw GIF frames
        const gif = gifDataRef.current.get(traitType);
        if (gif && gif.frames.length > 0) {
          const frame = gif.frames[gif.currentFrame].imageData;
          
          // Create a temporary canvas to put the image data
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = frame.width;
          tempCanvas.height = frame.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.putImageData(frame, 0, 0);
            
            // Calculate aspect ratio and position
            const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
            const x = (canvas.width - frame.width * scale) / 2;
            const y = (canvas.height - frame.height * scale) / 2;
            
            ctx.drawImage(tempCanvas, x, y, frame.width * scale, frame.height * scale);
          }
        }
      });
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Setup canvas when container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = containerSize.width;
    canvas.height = containerSize.height;
    
    // Redraw content when canvas size changes
    if (gifDataRef.current.size > 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    } else {
      drawStatic();
    }
  }, [containerSize, animate, drawStatic]);

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
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
        
        {Object.values(traits).every((trait) => trait === null) && (
          <div className="no-traits-message flex items-center justify-center h-full text-gray-500 text-center p-4">
            Select traits to build your avatar
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">{error}</div>
      )}
    </div>
  );
}