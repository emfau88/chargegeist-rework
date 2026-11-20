/**
 * The bond with each ghost: hearts from focus minutes and from touches, and the stages they reach.
 * Hearts and stages only ever go up, even after a long break. Plus never buys any.
 */

/** Hearts needed for each stage after "New": Familiar, Friend, Best Friend, Kindred Spirit. */
export const BOND_STEPS = [10, 40, 100, 250] as const;
/** One heart for this many focus minutes; the remainder carries over to the next session. */
export const BOND_FOCUS_MIN = 5;
/** Touches that bring a heart: each one once a day per ghost, so at most three a day. */
export const BOND_TOUCHES = ['stroke', 'hold', 'tickle'] as const;
export type BondTouch = (typeof BOND_TOUCHES)[number];
/** 0 New, 1 Familiar, 2 Friend, 3 Best Friend, 4 Kindred Spirit. */
export type BondLevel = 0 | 1 | 2 | 3 | 4;
export const BOND_MAX: BondLevel = 4;

/** What each stage brings, by level. */
export const BOND_PERK = ['', 'greet', 'hug', 'highfive', 'gold'] as const;

export interface BondRec {
  hearts: number;
  /** Focus minutes not yet turned into a heart. */
  rest: number;
  /** The day the touches below belong to. */
  day: string;
  /** Touches that brought a heart on that day. */
  touched: BondTouch[];
  /** The highest stage already celebrated. */
  seen: BondLevel;
}

export function emptyBond(): BondRec {
  return { hearts: 0, rest: 0, day: '', touched: [], seen: 0 };
}

/** The stage a number of hearts reaches. */
export function levelFor(hearts: number): BondLevel {
  let l = 0;
  for (const need of BOND_STEPS) if (hearts >= need) l++;
  return l as BondLevel;
}

/** The stage of a bond; never below one that was already reached. */
export function bondLevel(b: BondRec): BondLevel {
  return Math.max(levelFor(b.hearts), b.seen) as BondLevel;
}

export interface BondProgress {
  level: BondLevel;
  hearts: number;
  /** Hearts where this stage started and where the next one starts (null at the top). */
  from: number;
  to: number | null;
  /** 0..1 on the way to the next stage (1 at the top). */
  frac: number;
}
export function bondProgress(b: BondRec): BondProgress {
  const level = bondLevel(b);
  const steps: readonly number[] = BOND_STEPS;
  const from = level === 0 ? 0 : (steps[level - 1] ?? 0);
  const to = level >= BOND_MAX ? null : (steps[level] ?? null);
  const frac = to === null ? 1 : Math.max(0, Math.min(1, (b.hearts - from) / (to - from)));
  return { level, hearts: b.hearts, from, to, frac };
}

export interface BondGain {
  bond: BondRec;
  gained: number;
  before: BondLevel;
  after: BondLevel;
}

/** Hearts from a focus session: one per BOND_FOCUS_MIN minutes, the rest carries over. */
export function addFocus(b: BondRec, minutes: number): BondGain {
  const before = bondLevel(b);
  const total = b.rest + Math.max(0, Math.floor(minutes));
  const gained = Math.floor(total / BOND_FOCUS_MIN);
  const bond = { ...b, hearts: b.hearts + gained, rest: total - gained * BOND_FOCUS_MIN };
  return { bond, gained, before, after: bondLevel(bond) };
}

/** A heart from a touch, once per kind of touch a day. */
export function addTouch(b: BondRec, kind: BondTouch, day: string): BondGain {
  const before = bondLevel(b);
  const touched = b.day === day ? b.touched : [];
  if (touched.includes(kind)) return { bond: b, gained: 0, before, after: before };
  const bond = { ...b, hearts: b.hearts + 1, day, touched: [...touched, kind] };
  return { bond, gained: 1, before, after: bondLevel(bond) };
}

/** Touches still worth a heart today. */
export function touchesLeft(b: BondRec, day: string): BondTouch[] {
  const done = b.day === day ? b.touched : [];
  return BOND_TOUCHES.filter((k) => !done.includes(k));
}
