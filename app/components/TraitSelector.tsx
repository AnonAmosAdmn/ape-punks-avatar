// app/components/TraitSelector.tsx
'use client';

import { Trait, TraitType } from '@/types';

interface TraitSelectorProps {
  traitType: TraitType;
  traits: Trait[];
  selectedTrait: Trait | null;
  onSelect: (trait: Trait) => void;
}

export default function TraitSelector({ traitType, traits, selectedTrait, onSelect }: TraitSelectorProps) {
  return (
    <div className="mb-6 p-4 bg-indigo-700 rounded-lg">
      <h3 className="text-xl font-semibold mb-3 capitalize">{traitType}</h3>
      <div className="flex flex-wrap gap-3">
        {traits.map((trait) => {
          const isGif = trait.image.endsWith('.gif');
          return (
            <div
              key={trait.value}
              className={`cursor-pointer p-2 border-2 rounded-lg transition-all ${
                selectedTrait?.value === trait.value
                  ? 'border-purple-400 bg-purple-500 shadow-lg'
                  : 'border-indigo-500 hover:border-purple-300'
              }`}
              onClick={() => onSelect(trait)}
            >
              <div className="relative">
                <img
                  src={trait.image}
                  alt={trait.name}
                  className="w-16 h-16 object-contain rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.error(`Failed to load trait image: ${trait.image}`);
                  }}
                />
                {isGif && (
                  <div className="absolute top-0 right-0 bg-purple-500 text-xs px-1 rounded-bl-lg rounded-tr">
                    GIF
                  </div>
                )}
              </div>
              <p className="text-xs mt-1 text-center max-w-[64px] truncate">{trait.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
