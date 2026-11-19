import type { Slot } from './rigTypes';

export type Rarity = 'common' | 'rare' | 'epic' | 'mythic';
/** Companions can wear costume pieces. Costume ghosts wear their own costume. */
export type GhostKind = 'companion' | 'costume';

export interface GhostDef {
  id: string;
  kind: GhostKind;
  nameEn: string;
  nameDe: string;
  quoteEn: string;
  quoteDe: string;
  /** Glow and energy colour. */
  glow: string;
  /** Costume ghosts only: how rare the ghost is (it shows on the boss card and in the collection). */
  rarity: Rarity | null;
  /** Companions offered in onboarding. */
  starter: boolean;
}

export interface ItemDef {
  id: string;
  nameEn: string;
  nameDe: string;
  rarity: Rarity;
  /** The costume ghost whose outfit this piece belongs to. */
  set: string;
  slot: Slot;
}

/** An outfit: all its pieces together bring its costume ghost. The set id is the ghost id. */
export interface SetDef {
  id: string;
  items: string[];
}
