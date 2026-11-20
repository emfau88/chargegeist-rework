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

/** How visible the stars are: all at night, some in the morning and evening, few by day. */
export function starAlpha(w: SkyWeights): number {
  return Math.min(1, w.night + 0.55 * w.evening + 0.45 * w.morning + 0.18 * w.day);
}
