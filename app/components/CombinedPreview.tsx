// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef } from 'react';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

export default function CombinedPreview({ traits, onGifGenerated, onProcessingStateChange }: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });

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

  useEffect(() => {
    onProcessingStateChange(false);
    onGifGenerated(null);
    setError(null);
    
    // Check if any traits are selected
    const hasTraits = Object.values(traits).some(trait => trait !== null);
    if (!hasTraits) {
      return;
    }

    // For client-side preview, we'll just stack the images using HTML
    if (containerRef.current) {
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
        if (trait) {
          const img = document.createElement('img');
          img.src = trait.image;
          img.alt = trait.name;
          img.className = 'absolute top-0 left-0 w-full h-full object-contain';
          img.onerror = () => {
            console.error(`Failed to load image: ${trait.image}`);
            img.style.display = 'none';
          };
          containerRef.current?.appendChild(img);
        }
      });
    }
    
  }, [traits, onGifGenerated, onProcessingStateChange]);

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