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
    <div className="mb-4 p-3 bg-indigo-700 rounded-lg md:mb-6 md:p-4">
      <h3 className="text-lg font-semibold mb-2 capitalize md:text-xl md:mb-3">{traitType}</h3>
      <div className="flex flex-nowrap overflow-x-auto pb-2 md:flex-wrap md:gap-3 md:overflow-visible">
        {traits.map((trait) => {
          const isGif = trait.image.endsWith('.gif');
          return (
            <div
              key={trait.value}
              className={`flex-shrink-0 cursor-pointer p-1.5 border-2 rounded-lg transition-all mr-2 last:mr-0 md:mr-0 md:p-2 ${
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
                  className="w-12 h-12 object-contain rounded md:w-16 md:h-16"
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