/* eslint-disable @typescript-eslint/no-explicit-any */

// app/components/SelectedTraitsList.tsx
'use client';

import { AvatarTraits, TraitType } from '@/types';

interface SelectedTraitsListProps {
  traits: AvatarTraits;
  traitOptions: Record<TraitType, any[]>;
}

const traitTypeLabels: Record<TraitType, string> = {
  background: 'Background',
  fur: 'Fur',
  head: 'Head',
  mask: 'Mask',
  eyes: 'Eyes',
  minion: 'Minion',
  mouth: 'Mouth',
};

export default function SelectedTraitsList({ traits, traitOptions }: SelectedTraitsListProps) {
  const hasSelectedTraits = Object.values(traits).some(trait => trait !== null);

  if (!hasSelectedTraits) {
    return (
      <div className="bg-indigo-700 p-4 rounded-lg mt-6">
        <h3 className="text-lg font-semibold mb-2">Selected Traits</h3>
        <p className="text-indigo-200 text-sm">No traits selected yet</p>
      </div>
    );
  }

  return (
    <div className="bg-indigo-700 p-4 rounded-lg mt-6">
      <h3 className="text-lg font-semibold mb-3">Selected Traits</h3>
      <div className="space-y-2">
        {Object.entries(traits).map(([traitType, trait]) => {
          if (!trait) return null;

          const type = traitType as TraitType;
          const traitData = traitOptions[type].find(opt => opt.value === trait.value);
          
          return (
            <div key={traitType} className="flex items-center justify-between bg-indigo-600 px-3 py-2 rounded-md">
              <span className="text-sm font-medium text-indigo-100">
                {traitTypeLabels[type]}:
              </span>
              <span className="text-sm text-white">
                {traitData?.name || trait.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}