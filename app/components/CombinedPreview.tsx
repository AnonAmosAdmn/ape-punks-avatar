// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef } from 'react';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

interface LoadedImages {
  [key: string]: HTMLImageElement;
}

export default function CombinedPreview({
  traits,
  onGifGenerated,
  onProcessingStateChange,
}: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<LoadedImages>({});
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  const [gifSyncKey, setGifSyncKey] = useState(0);

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
    };
  }, []);

  // Reset sync when traits change
  useEffect(() => {
    setGifSyncKey((prev) => prev + 1);
  }, [traits]);

  // Preload all images and track when they're loaded
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
      setAllImagesLoaded(false);
      setLoadedImages({});
      onProcessingStateChange(false);
      onGifGenerated(null);
      setError(null);
      return;
    }

    onProcessingStateChange(true);
    setError(null);

    let loadedCount = 0;
    const totalCount = Object.values(traits).filter((trait) => trait !== null).length;
    const newLoadedImages: LoadedImages = {};

    traitOrder.forEach((traitType) => {
      const trait = traits[traitType];
      if (trait) {
        // Add sync parameter to GIF URLs
        const imageUrl = trait.image.endsWith('.gif')
          ? `${trait.image}?sync=${gifSyncKey}`
          : trait.image;

        const img = new Image();
        img.src = imageUrl;
        img.alt = trait.name;

        img.onload = () => {
          newLoadedImages[traitType] = img;
          loadedCount++;

          if (loadedCount === totalCount) {
            setLoadedImages(newLoadedImages);
            setAllImagesLoaded(true);
            onProcessingStateChange(false);
          }
        };

        img.onerror = () => {
          console.error(`Failed to load image: ${trait.image}`);
          loadedCount++;

          if (loadedCount === totalCount) {
            setLoadedImages(newLoadedImages);
            setAllImagesLoaded(true);
            onProcessingStateChange(false);
          }
        };
      }
    });
  }, [traits, onGifGenerated, onProcessingStateChange, gifSyncKey]);

  // Render the preview once all images are loaded
  useEffect(() => {
    if (!containerRef.current || !allImagesLoaded) return;

    // Clear previous content but keep the fallback message container
    const fallback = containerRef.current.querySelector('.no-traits-message');
    containerRef.current.innerHTML = '';
    if (fallback) {
      containerRef.current.appendChild(fallback);
    }

    // Add each image layer in the correct z-order
    const traitOrder: (keyof AvatarTraits)[] = [
      'background',
      'fur',
      'mouth',
      'head',
      'mask',
      'eyes',
      'minion',
    ];

    // Collect all <img> elements first
    const imgs: HTMLImageElement[] = [];

    traitOrder.forEach((traitType) => {
      const trait = traits[traitType];
      if (trait && loadedImages[traitType]) {
        const img = document.createElement('img');

        const isGif = trait.image.endsWith('.gif');
        const src = isGif
          ? `${trait.image}?sync=${gifSyncKey}&t=${Date.now()}`
          : trait.image;

        img.src = src;
        img.alt = trait.name;
        img.className = 'absolute top-0 left-0 w-full h-full object-contain';

        imgs.push(img);
      }
    });

    // Append them all *at once* for better sync
    imgs.forEach((img) => containerRef.current?.appendChild(img));
  }, [allImagesLoaded, loadedImages, traits, gifSyncKey]);

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
