// app/components/CombinedPreview.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useEffect, useState, useRef } from 'react';
import GifGenerator from './GifGenerator';

interface CombinedPreviewProps {
  traits: AvatarTraits;
  onGifGenerated: (url: string | null) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

export default function CombinedPreview({ traits, onGifGenerated, onProcessingStateChange }: CombinedPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleGifGenerated = (url: string) => {
    setGifUrl(url);
    onGifGenerated(url);
    onProcessingStateChange(false);
  };

  useEffect(() => {
    onProcessingStateChange(true);
    onGifGenerated(null);
    setError(null);
    setGifUrl(null);
    
    // Check if any traits are selected
    const hasTraits = Object.values(traits).some(trait => trait !== null);
    if (!hasTraits) {
      onProcessingStateChange(false);
      return;
    }

    // Fallback: Show layered images while GIF is generating
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
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
      <GifGenerator traits={traits} onGifGenerated={handleGifGenerated} />
      
      {gifUrl ? (
        <img 
          src={gifUrl} 
          alt="Combined Avatar" 
          className="mx-auto border-4 border-indigo-600 rounded-lg bg-gray-900"
          style={{ width: '400px', height: '400px' }}
        />
      ) : (
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
      )}
      {error && (
        <div className="mt-2 text-sm text-center text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}