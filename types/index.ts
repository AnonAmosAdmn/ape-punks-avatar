// types/index.ts
export interface Trait {
  name: string;
  value: string;
  image: string;
}

export interface AvatarTraits {
  background: Trait | null;
  eyes: Trait | null;
  face: Trait | null;
  fur: Trait | null;
  head: Trait | null;
  mask: Trait | null;
  minion: Trait | null;
  mouth: Trait | null;
}

export type TraitType = keyof AvatarTraits;