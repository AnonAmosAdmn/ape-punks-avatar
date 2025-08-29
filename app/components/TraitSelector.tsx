// app/components/TraitSelector.tsx
'use client';

import { Trait, TraitType } from '@/types';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface TraitSelectorProps {
  traitType: TraitType;
  traits: Trait[];
  selectedTrait: Trait | null;
  onSelect: (trait: Trait) => void;
}

export default function TraitSelector({ traitType, traits, selectedTrait, onSelect }: TraitSelectorProps) {
  const [gifSyncKey, setGifSyncKey] = useState(0);
  const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());

  // Reset synchronization when traits change
  useEffect(() => {
    setGifSyncKey(prev => prev + 1);
  }, [traits]);

  // Function to reload all GIFs simultaneously
  const reloadAllGifs = () => {
    const now = Date.now();
    imageRefs.current.forEach((img, key) => {
      if (img.src.endsWith('.gif')) {
        // Add a cache-busting parameter to force reload
        img.src = img.src.split('?')[0] + `?sync=${now}`;
      }
    });
  };

  // Reload GIFs when selection changes
  useEffect(() => {
    const timer = setTimeout(() => {
      reloadAllGifs();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [selectedTrait, gifSyncKey]);

  return (
    <div className="mb-4 p-3 bg-indigo-700 rounded-lg md:mb-6 md:p-4">
      <h3 className="text-lg font-semibold mb-2 capitalize md:text-xl md:mb-3">{traitType}</h3>
      <div className="flex flex-nowrap overflow-x-auto pb-2 md:flex-wrap md:gap-3 md:overflow-visible">
        {traits.map((trait) => {
          const isGif = trait.image.endsWith('.gif');
          // Add sync parameter to GIF URLs
          const imageUrl = isGif ? `${trait.image}?sync=${gifSyncKey}` : trait.image;
          
          return (
            <div
              key={trait.value}
              className={`flex-shrink-0 cursor-pointer p-1.5 border-2 rounded-lg transition-all mr-2 last:mr-0 md:mr-0 md:p-2 ${
                selectedTrait?.value === trait.value
                  ? 'border-purple-400 bg-purple-500 shadow-lg'
                  : 'border-indigo-500 hover:border-purple-300'
              }`}
              onClick={() => {
                onSelect(trait);
                // Force reload all GIFs on selection
                setTimeout(() => reloadAllGifs(), 10);
              }}
            >
              <div className="relative">
                <Image
                  ref={(el) => {
                    if (el) {
                      imageRefs.current.set(trait.value, el);
                    } else {
                      imageRefs.current.delete(trait.value);
                    }
                  }}
                  src={imageUrl}
                  alt={trait.name}
                  width={48}
                  height={48}
                  className="object-contain rounded md:w-16 md:h-16"
                  unoptimized={true} // Add this for GIFs
                  onLoad={() => {
                    // When a GIF loads, reload all to sync them
                    if (isGif) {
                      setTimeout(() => reloadAllGifs(), 50);
                    }
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.error(`Failed to load trait image: ${trait.image}`);
                  }}
                />
                {isGif && (
                  <div className="absolute top-0 right-0 bg-purple-500 text-[10px] px-1 rounded-bl-lg rounded-tr md:text-xs">
                    GIF
                  </div>
                )}
              </div>
              <p className="text-[10px] mt-1 text-center max-w-[48px] truncate md:text-xs md:max-w-[64px]">
                {trait.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}