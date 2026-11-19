import { ODDS, POOL_BY_RARITY, RARITIES, item, rarityRank } from '../data/catalog';
import type { Rarity } from '../data/types';

export type Rng = () => number;

/** Small seeded generator for tests and reproducible drops. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pity {
  /** Drops in a row without a rare-or-better card. */
  sinceRare: number;
  /** Drops in a row without an epic-or-better card. */
  sinceEpic: number;
}

/** A rare-or-better card is guaranteed at the latest in this many drops, epic-or-better in PITY_EPIC. */
export const PITY_RARE = 3;
export const PITY_EPIC = 10;
/** Chance that a card prefers a piece you do not own yet (when one exists at that rarity). */
export const PREFER_NEW = 0.85;
export const CARDS_PER_DROP = 3;

export function rollRarity(rng: Rng, min: Rarity = 'common'): Rarity {
  const allowed = RARITIES.filter((r) => rarityRank(r) >= rarityRank(min));
  const total = allowed.reduce((s, r) => s + ODDS[r], 0);
  let x = rng() * total;
  for (const r of [...allowed].reverse()) {
    x -= ODDS[r];
    if (x < 0) return r;
  }
  return allowed[0];
}

export interface RollOptions {
  /** At least one card has this rarity or better (used for the very first drop). */
  guarantee?: Rarity;
}

export function rollDrop(owned: ReadonlySet<string>, pity: Pity, rng: Rng, opts: RollOptions = {}): { cards: string[]; pity: Pity } {
  const rar: Rarity[] = Array.from({ length: CARDS_PER_DROP }, () => rollRarity(rng));
  const best = () => Math.max(...rar.map(rarityRank));
  const lift = (min: Rarity) => {
    if (best() >= rarityRank(min)) return;
    // upgrade the weakest card; the upgrade keeps the relative odds above `min`
    let wi = 0;
    rar.forEach((r, i) => {
      if (rarityRank(r) < rarityRank(rar[wi])) wi = i;
    });
    rar[wi] = rollRarity(rng, min);
  };
  if (opts.guarantee) lift(opts.guarantee);
  if (pity.sinceEpic >= PITY_EPIC - 1) lift('epic');
  if (pity.sinceRare >= PITY_RARE - 1) lift('rare');

  const cards: string[] = [];
  for (const r0 of rar) {
    let r: Rarity = r0;
    let pick: string | null = null;
    while (!pick) {
      const cands = POOL_BY_RARITY[r].filter((g) => !cards.includes(g.id));
      if (cands.length) {
        const fresh = cands.filter((g) => !owned.has(g.id));
        const from = fresh.length && rng() < PREFER_NEW ? fresh : cands;
        pick = from[Math.floor(rng() * from.length)].id;
      } else {
        // every piece of this rarity is already on the table: step down one rarity
        const i = rarityRank(r);
        if (i === 0) throw new Error('drop pool exhausted');
        r = RARITIES[i - 1];
      }
    }
    cards.push(pick);
  }
  const top = Math.max(...cards.map((id) => rarityRank(item(id).rarity)));
  return {
    cards,
    pity: {
      sinceRare: top >= rarityRank('rare') ? 0 : pity.sinceRare + 1,
      sinceEpic: top >= rarityRank('epic') ? 0 : pity.sinceEpic + 1,
    },
  };
}

/** How many drops at most until an epic-or-better card, counting the next one. */
export function epicWithin(p: Pity): number {
  return Math.max(1, PITY_EPIC - p.sinceEpic);
}
export function rareWithin(p: Pity): number {
  return Math.max(1, PITY_RARE - p.sinceRare);
}
