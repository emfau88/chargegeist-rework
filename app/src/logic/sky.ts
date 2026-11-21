/**
 * The time of day of the default sky: how much of morning, day, evening and night shows at an hour.
 * Pure, so the blend can be tested; the sky draws night as its base and the others on top.
 */
export type SkyPhase = 'morning' | 'day' | 'evening' | 'night';
export const SKY_PHASES: SkyPhase[] = ['morning', 'day', 'evening', 'night'];

/** Hour marks (0..24) where the sky is fully one phase; between two marks it blends. */
const MARKS: [number, SkyPhase][] = [
  [4.5, 'night'],
  [6.5, 'morning'],
  [9, 'morning'],
  [11, 'day'],
  [16, 'day'],
  [18, 'evening'],
  [20, 'evening'],
  [22, 'night'],
];

export type SkyWeights = Record<SkyPhase, number>;

/** How strongly each phase shows at a (fractional) hour; the weights add up to 1. */
export function skyWeights(hour: number): SkyWeights {
  const h = ((hour % 24) + 24) % 24;
  const w: SkyWeights = { morning: 0, day: 0, evening: 0, night: 0 };
  // before the first mark and after the last one it is night
  if (h < MARKS[0][0] || h >= MARKS[MARKS.length - 1][0]) {
    w.night = 1;
    return w;
  }
  for (let i = 0; i < MARKS.length - 1; i++) {
    const [a, pa] = MARKS[i];
    const [b, pb] = MARKS[i + 1];
    if (h >= a && h < b) {
      const f = pa === pb ? 0 : (h - a) / (b - a);
      const s = f * f * (3 - 2 * f);
      w[pa] += 1 - s;
      w[pb] += s;
      return w;
    }
  }
  w.night = 1;
  return w;
}

/**
 * Opacities for the layers morning, day and evening stacked over a night base, so that the
 * stack shows exactly the blend of the weights.
 */
export function skyOpacities(w: SkyWeights): { morning: number; day: number; evening: number } {
  let below = w.night;
  const out = { morning: 0, day: 0, evening: 0 };
  for (const k of ['morning', 'day', 'evening'] as const) {
    below += w[k];
    out[k] = below > 0 ? w[k] / below : 0;
  }
  return out;
}

/** Where the sun or moon stands: x and y as a share of the sky (0..1), alt 0 at the horizon and 1 at its highest. */
export interface OrbPlace {
  x: number;
  y: number;
  alt: number;
}

/**
 * One pass over the sky, t from 0 (rising behind the hills on the left) to 1 (setting on the right).
 * The path climbs along the left edge, runs flat below the headings, where the ghost floats in front
 * of it, and sinks along the right edge. So sun and moon never lie behind a line of text.
 */
function arc(t: number): OrbPlace | null {
  if (!(t >= 0 && t <= 1)) return null;
  const alt = Math.sin(Math.PI * t);
  return { x: 0.08 + 0.48 * (1 - Math.cos(Math.PI * t)), y: 0.78 - 0.54 * (1 - (1 - alt) ** 2), alt };
}

/** The sun is up from 6 to 20 o'clock. */
export function sunPlace(hour: number): OrbPlace | null {
  const h = ((hour % 24) + 24) % 24;
  return arc((h - 6) / 14);
}

/** The moon is up from 19 to 7 o'clock. */
export function moonPlace(hour: number): OrbPlace | null {
  const h = ((hour % 24) + 24) % 24;
  return arc(((h - 19 + 24) % 24) / 12);
}

/** Right at the horizon the sun and moon fade in; the hills hide them until they are higher up. */
export function orbAlpha(alt: number): number {
  return Math.max(0, Math.min(1, alt * 4));
}

const SYNODIC_DAYS = 29.530588853;
/** A new moon, as a reference point: 6 January 2000, 18:14 UTC. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

/** The phase of the real moon at a time: 0 new, 0.25 waxing half, 0.5 full, 0.75 waning half. */
export function moonPhase(ms: number): number {
  const p = ((ms - NEW_MOON_MS) / 86_400_000 / SYNODIC_DAYS) % 1;
  return p < 0 ? p + 1 : p;
}

type Rgb = [number, number, number];

/** The light a ghost picks up from the scene. */
export interface SceneLight {
  /** Towards the sun or moon on screen: x to the right, y down, length 1. A ghost looks that way in some of its acts. */
  dir: [number, number];
  /** Laid over the whole figure: r, g, b, each close to 1. */
  tint: Rgb;
}

/** The tint of each phase: a touch warm in the morning and evening, a touch cool at night. */
const TINT: Record<SkyPhase, Rgb> = {
  morning: [1, 0.99, 0.98],
  day: [1, 1, 1],
  evening: [1, 0.985, 0.965],
  night: [0.975, 0.98, 1],
};

/** Where a ghost floats, as a share of the sky, and the shape of a phone screen: the light comes from where the sun or moon stands as seen from there. */
const GHOST_AT = [0.5, 0.34];
const SCREEN = [390, 844];

/** The light of the default sky at an hour. It always falls from above the horizontal, also when the sun is low. */
export function skyLight(hour: number): SceneLight {
  const w = skyWeights(hour);
  const tint = [0, 1, 2].map((i) => SKY_PHASES.reduce((a, p) => a + w[p] * TINT[p][i], 0)) as Rgb;
  const sun = sunPlace(hour);
  const moon = moonPlace(hour);
  const ws = sun ? orbAlpha(sun.alt) : 0;
  const wm = moon ? orbAlpha(moon.alt) * (1 - ws) : 0;
  let x = 0,
    y = 0;
  for (const [orb, wt] of [
    [sun, ws],
    [moon, wm],
  ] as const) {
    if (!orb || wt <= 0) continue;
    const dx = (orb.x - GHOST_AT[0]) * SCREEN[0],
      dy = Math.min((orb.y - GHOST_AT[1]) * SCREEN[1], -0.35 * Math.abs((orb.x - GHOST_AT[0]) * SCREEN[0]));
    const len = Math.hypot(dx, dy) || 1;
    x += (wt * dx) / len;
    y += (wt * dy) / len;
  }
  const len = Math.hypot(x, y);
  return { dir: len > 1e-6 ? [x / len, y / len] : [0, -1], tint };
}

/** How visible the stars are: all at night, some in the morning and evening, few by day. */
export function starAlpha(w: SkyWeights): number {
  return Math.min(1, w.night + 0.55 * w.evening + 0.45 * w.morning + 0.18 * w.day);
}
