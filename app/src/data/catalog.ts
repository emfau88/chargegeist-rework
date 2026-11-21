/**
 * Everything you can collect.
 *  - 6 companions: they charge while you focus and join with focus hours.
 *  - 16 costume ghosts: every drop brings a ghost spark; enough sparks (or a calmed weekly boss) bring one.
 *    Ghosts always look exactly like their kit.
 *  - Style (auras, shimmers, charms): it comes from drops and wishes and never changes a ghost's shape.
 */
import { CHARMS } from './charms.gen';
import { RIGS } from './rigs.gen';
import type { RigConfig } from './rigTypes';
import type { GhostDef, Rarity, StyleDef, StyleKind } from './types';

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'mythic'];

/** Chance per card, in percent. Shown to the user on the drop screen. */
export const ODDS: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, mythic: 2 };

/** A duplicate style turns into this much wish energy (1 energy = 1 focus minute). */
export const DUPE_ENERGY: Record<Rarity, number> = { common: 10, rare: 20, epic: 40, mythic: 80 };

/** What a wished style costs in wish energy. */
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
  K('cloud', 'Nimbus', 'Nimbus', 'epic', '#8fa8ff', 'Brainstorm first, lightning after.', 'Erst der Gedankensturm, dann der Geistesblitz.'),
  K('cactus', 'Prickles', 'Piks', 'epic', '#b4e66a', 'Stay sharp. Drink water.', 'Bleib spitze. Trink Wasser.'),
  K('dragon', 'Jade', 'Jade', 'epic', '#5fe0c0', 'I hoard finished tasks.', 'Ich horte erledigte Aufgaben.'),
  K('jellyfish', 'Nori', 'Nori', 'epic', '#4fc3ff', 'Deep work? I live down here.', 'Deep Work? Ich wohne hier unten.'),
  K('phoenix', 'Fenix', 'Fenix', 'mythic', '#ff8a3c', 'Burnt out? Rise again tomorrow.', 'Ausgebrannt? Morgen steigst du neu auf.'),
  K('moondeer', 'Elara', 'Elara', 'mythic', '#a9b8ff', 'Even the moon takes it one phase at a time.', 'Auch der Mond nimmt eine Phase nach der anderen.'),
];

export const COMPANIONS = GHOSTS.filter((g) => g.kind === 'companion');
export const COSTUME_GHOSTS = GHOSTS.filter((g) => g.kind === 'costume');

/** Ghost sparks a costume ghost needs before it joins, by its rarity. */
export const SPARKS_NEEDED: Record<Rarity, number> = { common: 2, rare: 2, epic: 3, mythic: 5 };
/** Wish energy for a spark that has no ghost left to charge, or for sparks refunded when a boss brings that ghost. */
export const SPARK_ENERGY = 30;

/** Total focus hours at which the next companion joins, in order. */
export const COMPANION_UNLOCK_HOURS = [3, 8, 15, 25, 40];

/** The order in which the remaining companions join, given the one picked first. */
export function unlockOrder(firstId: string): string[] {
  return COMPANIONS.filter((c) => c.id !== firstId).map((c) => c.id);
}

/* ---------- style: auras, shimmers and charms ---------- */
export const STYLE_KINDS: StyleKind[] = ['aura', 'shimmer', 'charm'];

const S = (id: string, kind: StyleKind, nameEn: string, nameDe: string, rarity: Rarity, plus = false): StyleDef => ({ id, kind, nameEn, nameDe, rarity, plus });

export const STYLES: StyleDef[] = [
  S('aura_fireflies', 'aura', 'Fireflies', 'Glühwürmchen', 'common'),
  S('aura_sparks', 'aura', 'Spark Flurry', 'Funkenflug', 'common'),
  S('aura_bubbles', 'aura', 'Bubbles', 'Seifenblasen', 'common'),
  S('aura_leaves', 'aura', 'Autumn Leaves', 'Herbstlaub', 'rare'),
  S('aura_snow', 'aura', 'Snowfall', 'Schneefall', 'rare'),
  S('aura_blossoms', 'aura', 'Cherry Blossoms', 'Kirschblüten', 'rare'),
  S('aura_stardust', 'aura', 'Stardust', 'Sternenstaub', 'epic'),
  S('aura_notes', 'aura', 'Melody', 'Notenwirbel', 'epic'),
  S('aura_storm', 'aura', 'Storm Ring', 'Blitzring', 'mythic'),
  S('aura_comets', 'aura', 'Shooting Stars', 'Sternschnuppen', 'mythic'),
  S('shimmer_moon', 'shimmer', 'Moonsilver', 'Mondsilber', 'common'),
  S('shimmer_mint', 'shimmer', 'Mint', 'Minze', 'common'),
  S('shimmer_gold', 'shimmer', 'Sungold', 'Sonnengold', 'rare'),
  S('shimmer_rose', 'shimmer', 'Rose Quartz', 'Rosenquarz', 'rare'),
  S('shimmer_ember', 'shimmer', 'Ember Glow', 'Glut', 'epic'),
  S('shimmer_rainbow', 'shimmer', 'Rainbow', 'Regenbogen', 'epic'),
  S('shimmer_aurora', 'shimmer', 'Northern Lights', 'Nordlicht', 'mythic'),
  S('shimmer_holo', 'shimmer', 'Holo', 'Holo', 'mythic'),
  S('shimmer_heart', 'shimmer', 'Heartlight', 'Herzlicht', 'mythic', true),
  ...CHARMS.map((c) => S(c.id, 'charm', c.nameEn, c.nameDe, c.rarity)),
];

/** Styles that can come from drops and wishes (Plus styles never do). */
export const DROP_STYLES = STYLES.filter((x) => !x.plus);

/** Drop styles by rarity. */
export const POOL_BY_RARITY: Record<Rarity, StyleDef[]> = {
  common: DROP_STYLES.filter((i) => i.rarity === 'common'),
  rare: DROP_STYLES.filter((i) => i.rarity === 'rare'),
  epic: DROP_STYLES.filter((i) => i.rarity === 'epic'),
  mythic: DROP_STYLES.filter((i) => i.rarity === 'mythic'),
};

const ghostById = new Map(GHOSTS.map((g) => [g.id, g]));
const styleById = new Map(STYLES.map((i) => [i.id, i]));

export function ghost(id: string): GhostDef {
  const g = ghostById.get(id);
  if (!g) throw new Error(`unknown ghost ${id}`);
  return g;
}
export function hasGhost(id: string): boolean {
  return ghostById.has(id);
}
export function style(id: string): StyleDef {
  const i = styleById.get(id);
  if (!i) throw new Error(`unknown style ${id}`);
  return i;
}
export function hasStyle(id: string): boolean {
  return styleById.has(id);
}
export function stylesOf(kind: StyleKind): StyleDef[] {
  return STYLES.filter((x) => x.kind === kind);
}
export function rigOf(id: string): RigConfig {
  return RIGS[id];
}
/** Sparks a costume ghost needs (0 for companions, they come with focus hours). */
export function sparksNeeded(ghostId: string): number {
  const g = ghost(ghostId);
  return g.kind === 'costume' && g.rarity ? SPARKS_NEEDED[g.rarity] : 0;
}

const BASE = import.meta.env.BASE_URL;
export function partUrl(ghostId: string, part: string): string {
  return `${BASE}assets/ghosts/${ghostId}/${part}.webp`;
}
export function charmImg(id: string): string {
  return `${BASE}assets/charms/${id}.webp`;
}

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}
