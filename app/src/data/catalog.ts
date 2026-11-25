/**
 * Everything you can collect.
 *  - 6 companions: they charge while you focus and join with focus hours. Three of them are the
 *    starters you pick from; they wear a costume, the other three are plain.
 *  - 13 costume ghosts: every drop brings a ghost spark; enough sparks (or a calmed weekly boss) bring one.
 *    Ghosts always look exactly like their kit.
 *  - 3 ghosts are switched off (the starters of the first version): see GhostDef.off.
 *  - Style (auras, shimmers, charms): it comes from drops and wishes and never changes a ghost's shape.
 */
import { CHARMS } from './charms.gen';
import { RIGS } from './rigs.gen';
import type { RigConfig } from './rigTypes';
import type { CharmDef, GhostDef, Rarity, StyleDef, StyleKind } from './types';

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

const C = (id: string, nameEn: string, nameDe: string, glow: string, quoteEn: string, quoteDe: string, starter: boolean, off = false): GhostDef => ({
  id,
  kind: 'companion',
  nameEn,
  nameDe,
  quoteEn,
  quoteDe,
  glow,
  rarity: null,
  starter,
  off,
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
  off: false,
});

/**
 * Every ghost the app knows. The three starters wear a costume and have every moving part: arms of
 * their own, blush, eyes in layers. The starters of the first version (Volti, Ember, Luna) are
 * switched off for now.
 */
const ALL_GHOSTS: GhostDef[] = [
  C('aviator', 'Skye', 'Skye', '#7fd8ff', 'Goggles down, clouds out.', 'Brille runter, Wolken weg.', true),
  C('pumpkin', 'Pumpkin Pip', 'Kürbis-Pip', '#ffa04a', 'Carved a smile, kept the candle.', 'Ein Lächeln geschnitzt, die Kerze behalten.', true),
  C('witch', 'Hazel', 'Hazel', '#b07bff', 'My best spell is a closed tab.', 'Mein bester Zauber: ein geschlossener Tab.', true),
  C('sprout', 'Sprout', 'Sprout', '#8ef08a', 'A little every day.', 'Jeden Tag ein bisschen.', false),
  C('mochi', 'Mochi', 'Mochi', '#ff9fd2', 'Soft focus, strong heart.', 'Weicher Fokus, starkes Herz.', false),
  C('sunny', 'Sunny', 'Sunny', '#ffd66b', 'Let’s make today bright!', 'Machen wir den Tag hell!', false),
  C('volti', 'Volti', 'Volti', '#5be3ff', 'Every minute is a spark.', 'Jede Minute ist ein Funke.', false, true),
  C('ember', 'Ember', 'Ember', '#ffa36b', 'Warm up, then glow.', 'Erst warm werden, dann glühen.', false, true),
  C('luna', 'Luna', 'Luna', '#b69bff', 'Quiet minds shine brightest.', 'Ruhige Köpfe leuchten am hellsten.', false, true),
  K('samurai', 'Ronin', 'Ronin', 'epic', '#ff6b6b', 'One breath. One task. Then tea.', 'Ein Atemzug. Eine Aufgabe. Dann Tee.'),
  K('owl', 'Professor Hoot', 'Professor Huhu', 'epic', '#e0b27a', 'Whooo needs notifications?', 'Wer braucht schon Benachrichtigungen? Huhu!'),
  K('pirate', 'Captain Boo', 'Käpt’n Buh', 'epic', '#ffcf5b', 'X marks the deadline.', 'Das X markiert die Deadline.'),
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

/** The ghosts of the game: every one that is switched on. */
export const GHOSTS: GhostDef[] = ALL_GHOSTS.filter((g) => !g.off);
/** The companion a new save starts with, and the one the welcome screen shows. */
export const DEFAULT_COMPANION = 'aviator';

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

/** The Plus charm: drawn as rig_input/krone_v1.svg, not cut from the talisman sheet. */
const CROWN: CharmDef = { id: 'charm_crown', nameEn: 'Little Crown', nameDe: 'Kleine Krone', rarity: 'mythic', w: 220, h: 171 };
/** Every charm, the Plus one last. */
export const ALL_CHARMS: CharmDef[] = [...CHARMS, CROWN];

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
  S('aura_lanterns', 'aura', 'Sky Lanterns', 'Himmelslaternen', 'mythic', true),
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
  S(CROWN.id, 'charm', CROWN.nameEn, CROWN.nameDe, CROWN.rarity, true),
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

// by id every ghost is known, also one that is switched off: an old save or a tool may still name it
const ghostById = new Map(ALL_GHOSTS.map((g) => [g.id, g]));
const styleById = new Map(STYLES.map((i) => [i.id, i]));

export function ghost(id: string): GhostDef {
  const g = ghostById.get(id);
  if (!g) throw new Error(`unknown ghost ${id}`);
  return g;
}
/** Whether this ghost is part of the game: known and switched on. */
export function hasGhost(id: string): boolean {
  return ghostById.get(id)?.off === false;
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
