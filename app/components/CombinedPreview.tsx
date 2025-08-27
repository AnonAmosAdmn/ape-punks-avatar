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

  useEffect(() => {
    onProcessingStateChange(false);
    onGifGenerated(null);
    setError(null);
    
    // Check if any traits are selected
    const hasTraits = Object.values(traits).some(trait => trait !== null);
    if (!hasTraits) {
      return;
    }

    // For client-side preview, we'll just stack the GIFs using HTML
    if (containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Add each GIF layer in the correct order
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
          containerRef.current?.appendChild(img);
        }
      });
    }
    
  }, [traits, onGifGenerated, onProcessingStateChange]);

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className="avatar-container mx-auto border-4 border-indigo-600 rounded-lg bg-gray-900 relative"
        style={{ width: '400px', height: '400px' }}
      >
        {Object.values(traits).every(trait => trait === null) && (
          <div className="flex items-center justify-center h-full text-gray-500">
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
