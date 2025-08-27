// app/components/SaveButton.tsx
'use client';

import { AvatarTraits } from '@/types';
import { useState, useRef } from 'react';

interface SaveButtonProps {
  traits: AvatarTraits;
}

export default function SaveButton({ traits }: SaveButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    setIsProcessing(true);
    
    try {
      // Check if any traits are selected
      const hasTraits = Object.values(traits).some(trait => trait !== null);
      if (!hasTraits) {
        alert('Please select at least one trait to save');
        return;
      }

      // Use html2canvas to capture the preview
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current!);
      
      // Convert to GIF using a simple approach (single frame)
      const gifData = canvas.toDataURL('image/gif');
      
      // Create download link
      const a = document.createElement('a');
      a.href = gifData;
      a.download = 'nft-avatar.gif';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error generating GIF:', error);
      
      // Fallback: Try server API
      try {
        const traitUrls = Object.values(traits)
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
            // Create download link
            const a = document.createElement('a');
            a.href = result.imageData;
            a.download = 'nft-avatar.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      } catch (serverError) {
        console.error('Server fallback also failed:', serverError);
        alert('Failed to generate image. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any traits are selected
  const hasTraits = Object.values(traits).some(trait => trait !== null);

  return (
    <>
      <div ref={previewRef} className="hidden">
        <div className="avatar-container" style={{ width: '500px', height: '500px' }}>
          {Object.values(traits).map((trait, index) => (
            trait && (
              <img
                key={index}
                src={trait.image}
                alt={trait.name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            )
          ))}
        </div>
      </div>
      
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
          'Download as GIF'
        )}
      </button>
    </>
  );
}
