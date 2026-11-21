export type Rarity = 'common' | 'rare' | 'epic' | 'mythic';
/** Companions join with focus hours. Costume ghosts join with ghost sparks or as a calmed boss. */
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
  /** Costume ghosts only: how rare the ghost is. It sets how many sparks it needs. */
  rarity: Rarity | null;
  /** Companions offered in onboarding. */
  starter: boolean;
  /**
   * Switched off: not offered, not earned and not shown anywhere. The ghost keeps its id, rig and
   * pictures, so an old save that has it can put it on the shelf (see retire in state/store.ts).
   */
  off: boolean;
}

export type StyleKind = 'aura' | 'shimmer' | 'charm';

/** A style: it shows around a ghost and never changes its shape. */
export interface StyleDef {
  id: string;
  kind: StyleKind;
  nameEn: string;
  nameDe: string;
  rarity: Rarity;
  /** Only with Plus; never in drops or wishes. */
  plus: boolean;
}

/** A charm image from the talisman sheet. */
export interface CharmDef {
  id: string;
  nameEn: string;
  nameDe: string;
  rarity: Rarity;
  /** Image size in pixels. */
  w: number;
  h: number;
}
