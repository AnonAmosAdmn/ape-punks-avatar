// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

interface LoadedImage {
  element: HTMLImageElement;
  type: keyof AvatarTraits;
  isGif: boolean;
}

export default function CombinedPreview({
  traits,
  onGifGenerated,
  onProcessingStateChange,
}: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  const [renderKey, setRenderKey] = useState(0);
  const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const syncTimestampRef = useRef<number>(Date.now());
  const hasGifsRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const gifElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

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

  // Reset sync when traits change
  useEffect(() => {
    const newTimestamp = Date.now();
    syncTimestampRef.current = newTimestamp;
    setRenderKey(prev => prev + 1);
    setLoadedImages([]);
    hasGifsRef.current = false;
    cancelAnimationFrame(animationFrameRef.current);
    gifElementsRef.current.clear();
  }, [traits]);

  // Check if all selected traits have loaded images
  useEffect(() => {
    const selectedTraits = Object.entries(traits)
      .filter(([_, value]) => value !== null)
      .map(([key]) => key as keyof AvatarTraits);

    if (selectedTraits.length === 0) {
      onProcessingStateChange(false);
      onGifGenerated(null);
      setError(null);
      return;
    }

    const allLoaded = selectedTraits.every(traitType => 
      loadedImages.some(img => img.type === traitType)
    );

    if (allLoaded && selectedTraits.length > 0) {
      onProcessingStateChange(false);
    }
  }, [loadedImages, traits, onProcessingStateChange, onGifGenerated]);

  // Load images when traits change
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
      return;
    }

    onProcessingStateChange(true);
    setError(null);

    // Clear previous images
    setLoadedImages([]);
    imageRefs.current.clear();
    gifElementsRef.current.clear();

    // Check if we have any GIFs
    hasGifsRef.current = Object.values(traits).some(
      trait => trait !== null && trait.image.endsWith('.gif')
    );

    // Create a promise for each image load
    const loadPromises: Promise<LoadedImage>[] = [];

    traitOrder.forEach((traitType) => {
      const trait = traits[traitType];
      if (trait) {
        const loadPromise = new Promise<LoadedImage>((resolve, reject) => {
          const img = new Image();
          const isGif = trait.image.endsWith('.gif');
          
          // Use the same timestamp for all GIFs to ensure synchronization
          const imageUrl = isGif
            ? `${trait.image}?sync=${syncTimestampRef.current}`
            : trait.image;

          img.src = imageUrl;
          img.alt = trait.name;
          
          // Store reference for later use
          imageRefs.current.set(traitType, img);

          img.onload = () => {
            resolve({ element: img, type: traitType, isGif });
          };

          img.onerror = () => {
            console.error(`Failed to load image: ${trait.image}`);
            reject(new Error(`Failed to load ${traitType} image`));
          };
        });
        
        loadPromises.push(loadPromise);
      }
    });

    // Wait for all images to load
    Promise.all(loadPromises)
      .then((images) => {
        setLoadedImages(images);
      })
      .catch((error) => {
        setError(error.message);
        onProcessingStateChange(false);
      });
  }, [traits, onProcessingStateChange, renderKey]);

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

  // Check if we have GIFs
  const hasGifs = loadedImages.some(img => img.isGif);

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
          // Render all images with proper layering
          loadedImages.map(({ type, isGif }) => {
            const trait = traits[type];
            if (!trait) return null;
            
            // For GIFs, use a unique key with timestamp to force reload and synchronization
            const src = isGif
              ? `${trait.image}?sync=${syncTimestampRef.current}&key=${renderKey}`
              : trait.image;

            return (
              <img
                key={`${type}-${renderKey}`}
                src={src}
                alt={trait.name}
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ zIndex: getZIndex(type) }}
                onLoad={() => {
                  // Store reference to GIF elements for potential manual control
                  if (isGif) {
                    gifElementsRef.current.set(type, document.querySelector(`img[src="${src}"]`) as HTMLImageElement);
                  }
                }}
              />
            );
          })
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">{error}</div>
      )}
      
      {/* Hidden canvas for potential future use */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}