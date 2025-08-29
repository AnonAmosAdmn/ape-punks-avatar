// by anonamosadmn

// app/page.tsx
'use client';

import { useState } from 'react';
import { Trait, AvatarTraits, TraitType } from '@/types';
import TraitSelector from './components/TraitSelector';
import CombinedPreview from './components/CombinedPreview';
import SaveButton from './components/SaveButton';

// Sample trait data with GIF examples
const traitOptions: Record<TraitType, Trait[]> = {
  background: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Blue Sky', value: 'blue-sky', image: '/assets/background/1.gif' },
    { name: 'Space', value: 'space', image: '/assets/background/2.gif' },
  ],
  eyes: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Normal', value: 'normal', image: '/assets/eyes/14.gif' },
    { name: 'Laser', value: 'laser', image: '/assets/eyes/15.gif' },
  ],
  face: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Round', value: 'round', image: '/assets/face/3.gif' },
  ],
  fur: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Brown', value: 'brown', image: '/assets/fur/4.gif' },
    { name: 'White', value: 'white', image: '/assets/fur/5.gif' },
  ],
  head: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Cap', value: 'cap', image: '/assets/head/6.gif' },
    { name: 'Crown', value: 'crown', image: '/assets/head/7.gif' },
  ],
  mask: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Surgical', value: 'surgical', image: '/assets/mask/8.gif' },
    { name: 'Gas', value: 'gas', image: '/assets/mask/9.gif' },
  ],
  minion: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Frog', value: 'frog', image: '/assets/minion/10.gif' },
    { name: 'Robot', value: 'robot', image: '/assets/minion/11.gif' },
  ],
  mouth: [
    { name: 'None', value: 'none', image: '/assets/transparent.gif' },
    { name: 'Smile', value: 'smile', image: '/assets/mouth/12.gif' },
    { name: 'Open', value: 'open', image: '/assets/mouth/13.gif' },
  ],
};

const initialTraits: AvatarTraits = {
  background: null,
  eyes: null,
  face: null,
  fur: null,
  head: null,
  mask: null,
  minion: null,
  mouth: null,
};

export default function Home() {
  const [traits, setTraits] = useState<AvatarTraits>(initialTraits);
  const [combinedGifUrl, setCombinedGifUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTraitSelect = (traitType: TraitType, trait: Trait) => {
    const newTraits = {
      ...traits,
      [traitType]: trait.value === 'none' ? null : trait,
    };
    setTraits(newTraits);
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <h1 className="text-4xl font-bold text-center mb-2">APE PUNKS Avatar Creator</h1>
      <p className="text-center text-indigo-200 mb-8">Create your unique NFT avatar with animated traits</p>
      
      <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
        <div className="flex-1 bg-indigo-800 p-6 rounded-xl shadow-lg">
          <div className="sticky top-4">
            <h2 className="text-2xl font-semibold mb-4">Preview</h2>
            <CombinedPreview 
              traits={traits} 
              onGifGenerated={setCombinedGifUrl}
              onProcessingStateChange={setIsProcessing}
            />
            <div className="mt-6 flex justify-center">
              <SaveButton traits={traits} />
            </div>
          </div>
        </div>
        
        <div className="flex-1 bg-indigo-800 p-6 rounded-xl shadow-lg overflow-y-auto max-h-screen">
          <h2 className="text-2xl font-semibold mb-6">Customize Your Avatar</h2>
          {Object.entries(traitOptions).map(([traitType, options]) => (
            <TraitSelector
              key={traitType}
              traitType={traitType as TraitType}
              traits={options}
              selectedTrait={traits[traitType as TraitType]}
              onSelect={(trait) => handleTraitSelect(traitType as TraitType, trait)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}