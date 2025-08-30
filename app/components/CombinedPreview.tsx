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
  const [gifSyncKey, setGifSyncKey] = useState(0);
  const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Update container size based on window size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const size = Math.min(containerWidth, 400);
        setContainerSize({ width: size, height: size });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Reset sync when traits change
  useEffect(() => {
    setGifSyncKey((prev) => prev + 1);
    setLoadedImages([]);
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
      setIsLoading(false);
      return;
    }

    const allLoaded = selectedTraits.every(traitType => 
      loadedImages.some(img => img.type === traitType)
    );

    if (allLoaded && selectedTraits.length > 0) {
      onProcessingStateChange(false);
      setIsLoading(false);
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
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    onProcessingStateChange(true);
    setError(null);

    // Clear previous images
    setLoadedImages([]);
    imageRefs.current.clear();

    let loadedCount = 0;
    const expectedCount = Object.values(traits).filter(trait => trait !== null).length;

    traitOrder.forEach((traitType) => {
      const trait = traits[traitType];
      if (trait) {
        const img = new Image();
        const isGif = trait.image.endsWith('.gif');
        const imageUrl = isGif
          ? `${trait.image}?sync=${gifSyncKey}`
          : trait.image;

        img.src = imageUrl;
        img.alt = trait.name;
        
        // Store reference for later use
        imageRefs.current.set(traitType, img);

        img.onload = () => {
          setLoadedImages(prev => [...prev, { element: img, type: traitType }]);
          loadedCount++;
          
          // If all expected images have loaded, update state
          if (loadedCount === expectedCount) {
            setIsLoading(false);
            onProcessingStateChange(false);
          }
        };

        img.onerror = () => {
          console.error(`Failed to load image: ${trait.image}`);
          setError(`Failed to load ${traitType} image`);
          setIsLoading(false);
          onProcessingStateChange(false);
        };
      }
    });
  }, [traits, onProcessingStateChange, gifSyncKey]);

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
          // Render images using React's declarative approach
          Array.from(imageRefs.current.entries()).map(([traitType, img]) => {
            const trait = traits[traitType as keyof AvatarTraits];
            if (!trait) return null;
            
            const isGif = trait.image.endsWith('.gif');
            const src = isGif
              ? `${trait.image}?sync=${gifSyncKey}&t=${Date.now()}`
              : trait.image;

            return (
              <img
                key={traitType}
                src={src}
                alt={trait.name}
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ zIndex: getZIndex(traitType as keyof AvatarTraits) }}
              />
            );
          })
        )}
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">{error}</div>
      )}
    </div>
  );
}