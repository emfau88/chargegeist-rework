/**
 * Everything you can collect.
 *  - 6 companions: they charge while you focus and can wear costume pieces.
 *  - 25 costume pieces: they come from drops and wishes.
 *  - 10 costume ghosts: a complete outfit (or a calmed weekly boss) brings one.
 */
import { ITEM_RIGS, RIGS } from './rigs.gen';
import type { RigConfig } from './rigTypes';
import type { GhostDef, ItemDef, Rarity, SetDef } from './types';

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'mythic'];

/** Chance per card, in percent. Shown to the user on the drop screen. */
export const ODDS: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, mythic: 2 };

/** A duplicate pick turns into this much wish energy (1 energy = 1 focus minute). */
export const DUPE_ENERGY: Record<Rarity, number> = { common: 10, rare: 20, epic: 40, mythic: 80 };

/** What a wished piece costs in wish energy. */
export const WISH_COST: Record<Rarity, number> = { common: 60, rare: 150, epic: 300, mythic: 600 };

/** Wish energy for calming a boss you already own. */
export const BOSS_DUPE_ENERGY = 100;

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#72e6a6',
  rare: '#68a8ff',
  epic: '#c58cff',
  mythic: '#ffc76b',
};

const C = (id: string, nameEn: string, glow: string, quoteEn: string, quoteDe: string, starter: boolean): GhostDef => ({
  id,
  kind: 'companion',
  nameEn,
  nameDe: nameEn,
  quoteEn,
  quoteDe,
  glow,
  rarity: null,
  starter,
});
const K = (id: string, nameEn: string, nameDe: string, rarity: Rarity, glow: string, quoteEn: string, quoteDe: string): GhostDef => ({
  id,
  kind: 'costume',
  nameEn,
  nameDe,
  quoteEn,
  quoteDe,
  glow,
  rarity,
  starter: false,
});

export const GHOSTS: GhostDef[] = [
  C('volti', 'Volti', '#5be3ff', 'Every minute is a spark.', 'Jede Minute ist ein Funke.', true),
  C('ember', 'Ember', '#ffa36b', 'Warm up, then glow.', 'Erst warm werden, dann glühen.', true),
  C('luna', 'Luna', '#b69bff', 'Quiet minds shine brightest.', 'Ruhige Köpfe leuchten am hellsten.', true),
  C('sprout', 'Sprout', '#8ef08a', 'A little every day.', 'Jeden Tag ein bisschen.', false),
  C('mochi', 'Mochi', '#ff9fd2', 'Soft focus, strong heart.', 'Weicher Fokus, starkes Herz.', false),
  C('sunny', 'Sunny', '#ffd66b', 'Let’s make today bright!', 'Machen wir den Tag hell!', false),
  K('pumpkin', 'Pumpkin Pip', 'Kürbis-Pip', 'epic', '#ffa04a', 'Carved a smile, kept the candle.', 'Ein Lächeln geschnitzt, die Kerze behalten.'),
  K('samurai', 'Ronin', 'Ronin', 'epic', '#ff6b6b', 'One breath. One task. Then tea.', 'Ein Atemzug. Eine Aufgabe. Dann Tee.'),
  K('witch', 'Hazel', 'Hazel', 'epic', '#b07bff', 'My best spell is a closed tab.', 'Mein bester Zauber: ein geschlossener Tab.'),
  K('owl', 'Professor Hoot', 'Professor Huhu', 'epic', '#e0b27a', 'Whooo needs notifications?', 'Wer braucht schon Benachrichtigungen? Huhu!'),
  K('pirate', 'Captain Boo', 'Käpt’n Buh', 'epic', '#ffcf5b', 'X marks the deadline.', 'Das X markiert die Deadline.'),
  K('aviator', 'Skye', 'Skye', 'epic', '#7fd8ff', 'Goggles down, clouds out.', 'Brille runter, Wolken weg.'),
  K('kitsune', 'Kitsu', 'Kitsu', 'mythic', '#ff7a7a', 'Nine tails, one focus.', 'Neun Schwänze, ein Fokus.'),
  K('reaper', 'Grim', 'Grimmi', 'mythic', '#c48bff', 'I only reap distractions.', 'Ich ernte nur Ablenkungen.'),
  K('starmage', 'Stella', 'Stella', 'mythic', '#ffd85b', 'Small steps, big constellations.', 'Kleine Schritte, große Sternbilder.'),
  K('forest', 'Moss', 'Moos', 'mythic', '#7dffa8', 'Grow slowly. Grow anyway.', 'Langsam wachsen. Aber wachsen.'),
];

const I = (id: string, nameEn: string, nameDe: string, rarity: Rarity, set: string): ItemDef => ({
  id,
  nameEn,
  nameDe,
  rarity,
  set,
  slot: ITEM_RIGS[id].slot,
});

export const ITEMS: ItemDef[] = [
  I('pumpkin_hat', 'Pumpkin Hat', 'Kürbishut', 'rare', 'pumpkin'),
  I('samurai_helmet', 'Kabuto Helmet', 'Kabuto-Helm', 'epic', 'samurai'),
  I('samurai_sash', 'Red Sash', 'Rote Schärpe', 'common', 'samurai'),
  I('witch_hat', 'Witch Hat', 'Hexenhut', 'epic', 'witch'),
  I('witch_collar', 'Feather Collar', 'Federkragen', 'rare', 'witch'),
  I('owl_ears', 'Owl Tufts', 'Eulenohren', 'common', 'owl'),
  I('owl_goggles', 'Brass Goggles', 'Messingbrille', 'rare', 'owl'),
  I('owl_beak', 'Tiny Beak', 'Kleiner Schnabel', 'common', 'owl'),
  I('pirate_hat', 'Captain’s Hat', 'Kapitänshut', 'epic', 'pirate'),
  I('pirate_eyepatch', 'Eye Patch', 'Augenklappe', 'common', 'pirate'),
  I('pirate_bandana', 'Bandana', 'Bandana', 'common', 'pirate'),
  I('aviator_cap', 'Aviator Cap', 'Fliegermütze', 'epic', 'aviator'),
  I('aviator_scarf', 'Gear Scarf', 'Zahnrad-Schal', 'common', 'aviator'),
  I('aviator_lantern', 'Storm Lantern', 'Sturmlaterne', 'rare', 'aviator'),
  I('kitsune_mask', 'Fox Mask', 'Fuchsmaske', 'mythic', 'kitsune'),
  I('kitsune_collar', 'Bell Collar', 'Glöckchenkette', 'common', 'kitsune'),
  I('kitsune_tail', 'Fox Tail', 'Fuchsschwanz', 'rare', 'kitsune'),
  I('reaper_hood', 'Shadow Hood', 'Schattenkapuze', 'mythic', 'reaper'),
  I('reaper_cloak', 'Tattered Cape', 'Zerfetzter Umhang', 'common', 'reaper'),
  I('reaper_scythe', 'Tiny Scythe', 'Mini-Sense', 'mythic', 'reaper'),
  I('star_halo', 'Sun Crown', 'Sonnenkrone', 'mythic', 'starmage'),
  I('star_hood', 'Starry Cap', 'Sternenmütze', 'epic', 'starmage'),
  I('star_collar', 'Star Collar', 'Sternenkragen', 'rare', 'starmage'),
  I('forest_antlers', 'Leafy Antlers', 'Blättergeweih', 'epic', 'forest'),
  I('forest_collar', 'Leaf Collar', 'Blätterkragen', 'rare', 'forest'),
];

export const COMPANIONS = GHOSTS.filter((g) => g.kind === 'companion');
export const COSTUME_GHOSTS = GHOSTS.filter((g) => g.kind === 'costume');

/** One outfit per costume ghost, in collection order. */
export const SETS: SetDef[] = COSTUME_GHOSTS.map((g) => ({ id: g.id, items: ITEMS.filter((i) => i.set === g.id).map((i) => i.id) }));

/** Total focus hours at which the next companion joins, in order. */
export const COMPANION_UNLOCK_HOURS = [3, 8, 15, 25, 40];

/** The order in which the remaining companions join, given the one picked first. */
export function unlockOrder(firstId: string): string[] {
  return COMPANIONS.filter((c) => c.id !== firstId).map((c) => c.id);
}

const ghostById = new Map(GHOSTS.map((g) => [g.id, g]));
const itemById = new Map(ITEMS.map((i) => [i.id, i]));
const setById = new Map(SETS.map((s) => [s.id, s]));

export function ghost(id: string): GhostDef {
  const g = ghostById.get(id);
  if (!g) throw new Error(`unknown ghost ${id}`);
  return g;
}
export function hasGhost(id: string): boolean {
  return ghostById.has(id);
}
export function item(id: string): ItemDef {
  const i = itemById.get(id);
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}
export function hasItem(id: string): boolean {
  return itemById.has(id);
}
export function setOf(id: string): SetDef {
  const s = setById.get(id);
  if (!s) throw new Error(`unknown set ${id}`);
  return s;
}
export function rigOf(id: string): RigConfig {
  return RIGS[id];
}
/** Companions wear pieces; costume ghosts keep their own costume. */
export function canWear(ghostId: string): boolean {
  return RIGS[ghostId]?.wear != null;
}

/** Pieces by rarity, for drops. */
export const POOL_BY_RARITY: Record<Rarity, ItemDef[]> = {
  common: ITEMS.filter((i) => i.rarity === 'common'),
  rare: ITEMS.filter((i) => i.rarity === 'rare'),
  epic: ITEMS.filter((i) => i.rarity === 'epic'),
  mythic: ITEMS.filter((i) => i.rarity === 'mythic'),
};

const BASE = import.meta.env.BASE_URL;
export function partUrl(ghostId: string, part: string): string {
  return `${BASE}assets/ghosts/${ghostId}/${part}.webp`;
}
export function itemImg(id: string): string {
  return `${BASE}assets/items/${id}.webp`;
}

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}
