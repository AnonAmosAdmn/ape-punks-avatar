'use client';

import { AvatarTraits } from '@/types';
import { useState } from 'react';

interface SaveButtonProps {
  traits: AvatarTraits;
  gifUrl: string | null;
}

// Define the correct layer order
const TRAIT_ORDER: (keyof AvatarTraits)[] = [
  'background', 'fur', 'face', 'eyes', 'mouth', 'head', 'mask', 'minion'
];

export default function SaveButton({ traits, gifUrl }: SaveButtonProps) {
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

      // Use the server-generated image if available
      if (gifUrl) {
        const a = document.createElement('a');
        a.href = gifUrl;
        a.download = 'nft-avatar.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Otherwise, generate a new one with the correct layer order
      const traitUrls = TRAIT_ORDER
        .map(traitType => traits[traitType])
        .filter(trait => trait !== null)
        .map(trait => trait!.image);
      
      const response = await fetch('/api/combine-gifs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ traitUrls }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.imageData) {
          const a = document.createElement('a');
          a.href = result.imageData;
          a.download = 'nft-avatar.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          throw new Error(result.error || 'Failed to generate image');
        }
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Final fallback: use html2canvas with correct layer order
      try {
        const html2canvas = (await import('html2canvas')).default;
        
        // Create a temporary container with images in correct order
        const container = document.createElement('div');
        container.style.width = '500px';
        container.style.height = '500px';
        container.style.position = 'relative';
        container.style.backgroundColor = 'white';
        
        TRAIT_ORDER.forEach(traitType => {
          const trait = traits[traitType];
          if (trait) {
            const img = document.createElement('img');
            img.src = trait.image;
            img.alt = trait.name;
            img.style.position = 'absolute';
            img.style.top = '0';
            img.style.left = '0';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            container.appendChild(img);
          }
        });
        
        document.body.appendChild(container);
        
        // Wait for images to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = await html2canvas(container);
        const pngData = canvas.toDataURL('image/png');
        
        const a = document.createElement('a');
        a.href = pngData;
        a.download = 'nft-avatar.png';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        document.body.removeChild(container);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        alert('Failed to generate image. Please try again.');
      }
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
          Generating Image...
        </>
      ) : (
        'Download as PNG'
      )}
    </button>
  );
}