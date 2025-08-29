'use client';

import { AvatarTraits } from '@/types';
import { useState } from 'react';

interface SaveButtonProps {
  traits: AvatarTraits;
}

export default function SaveButton({ traits }: SaveButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSave = async () => {
    setIsProcessing(true);
    
    try {
      // Check if any traits are selected
      const hasTraits = Object.values(traits).some(trait => trait !== null);
      if (!hasTraits) {
        alert('Please select at least one trait to save');
        return;
      }

      // Define the correct layer order
      const layerOrder: (keyof AvatarTraits)[] = [
        'background', 'fur', 'mouth', 'head', 'mask', 'eyes', 'minion'
      ];

      // Collect all trait image URLs in the correct order
      const traitUrls = layerOrder
        .map(traitType => traits[traitType])
        .filter(trait => trait !== null)
        .map(trait => trait!.image);

      // Use server API to combine GIFs
      const response = await fetch('/api/combine-gifs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ traitUrls }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.imageData) {
        // Create download link
        const a = document.createElement('a');
        a.href = result.imageData;
        a.download = 'nft-avatar.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error(result.error || 'Failed to generate GIF');
      }
      
    } catch (error) {
      console.error('Error generating GIF:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any traits are selected
  const hasTraits = Object.values(traits).some(trait => trait !== null);

  return (
    <button
      onClick={handleSave}
      disabled={isProcessing || !hasTraits}
      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      {isProcessing ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
          Generating GIF...
        </>
      ) : (
        'Download as GIF'
      )}
    </button>
  );
}