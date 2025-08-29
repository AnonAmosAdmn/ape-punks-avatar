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

export default function CombinedPreview({ traits, onGifGenerated, onProcessingStateChange }: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<LoadedImages>({});
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  const gifSyncRef = useRef<number>(0); // Counter to force GIF synchronization

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

  // Preload all images and track when they're loaded
  useEffect(() => {
    const traitOrder: (keyof AvatarTraits)[] = [
      'background', 'fur', 'face', 'eyes', 'mouth', 'head', 'mask', 'minion'
    ];
    
    // Check if any traits are selected
    const hasTraits = Object.values(traits).some(trait => trait !== null);
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
    const totalCount = Object.values(traits).filter(trait => trait !== null).length;
    const newLoadedImages: LoadedImages = {};
    
    traitOrder.forEach(traitType => {
      const trait = traits[traitType];
      if (trait) {
        const img = new Image();
        img.src = trait.image;
        img.alt = trait.name;
        
        img.onload = () => {
          newLoadedImages[traitType] = img;
          loadedCount++;
          
          if (loadedCount === totalCount) {
            setLoadedImages(newLoadedImages);
            setAllImagesLoaded(true);
            onProcessingStateChange(false);
            
            // Increment sync counter to force GIF reload
            gifSyncRef.current += 1;
          }
        };
        
        img.onerror = () => {
          console.error(`Failed to load image: ${trait.image}`);
          loadedCount++;
          
          if (loadedCount === totalCount) {
            setLoadedImages(newLoadedImages);
            setAllImagesLoaded(true);
            onProcessingStateChange(false);
            gifSyncRef.current += 1;
          }
        };
      }
    });
  }, [traits, onGifGenerated, onProcessingStateChange]);

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
      'background', 'fur', 'face', 'eyes', 'mouth', 'head', 'mask', 'minion'
    ];
    
    traitOrder.forEach(traitType => {
      const trait = traits[traitType];
      if (trait && loadedImages[traitType]) {
        const img = document.createElement('img');
        
        // Add sync parameter to GIF URLs to force them to load at the same time
        const isGif = trait.image.endsWith('.gif');
        let src = trait.image;
        if (isGif) {
          // Add a cache-busting parameter to force reload and synchronization
          src = `${trait.image}?sync=${gifSyncRef.current}&t=${Date.now()}`;
        }
        
        img.src = src;
        img.alt = trait.name;
        img.className = 'absolute top-0 left-0 w-full h-full object-contain';
        
        // Force GIFs to load at the same time by setting decoding to async
        img.decoding = 'async';
        
        containerRef.current?.appendChild(img);
      }
    });
  }, [allImagesLoaded, loadedImages, traits, gifSyncRef.current]); // Add gifSyncRef.current as dependency

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className="avatar-container mx-auto border-4 border-indigo-600 rounded-lg bg-gray-900 relative overflow-hidden"
        style={{ 
          width: `${containerSize.width}px`, 
          height: `${containerSize.height}px`,
          maxWidth: '100%'
        }}
      >
        {Object.values(traits).every(trait => trait === null) && (
          <div className="no-traits-message flex items-center justify-center h-full text-gray-500 text-center p-4">
            Select traits to build your avatar
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}