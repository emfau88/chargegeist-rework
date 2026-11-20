import { describe, expect, it } from 'vitest';
import { SKY_PHASES, skyOpacities, skyWeights, starAlpha } from '../src/logic/sky';
import type { SkyWeights } from '../src/logic/sky';

const main = (w: SkyWeights) => SKY_PHASES.reduce((a, b) => (w[b] > w[a] ? b : a));
const sum = (w: SkyWeights) => SKY_PHASES.reduce((a, k) => a + w[k], 0);

describe('sky by the time of day', () => {
  it('shows morning, day, evening and night at their hours', () => {
    expect(main(skyWeights(7.5))).toBe('morning');
    expect(main(skyWeights(13))).toBe('day');
    expect(main(skyWeights(19))).toBe('evening');
    expect(main(skyWeights(23))).toBe('night');
    expect(main(skyWeights(2))).toBe('night');
  });

  it('blends softly and the weights always add up to 1', () => {
    for (let h = 0; h < 24; h += 0.25) expect(sum(skyWeights(h))).toBeCloseTo(1, 6);
    const w = skyWeights(10);
    expect(w.morning).toBeCloseTo(0.5, 6);
    expect(w.day).toBeCloseTo(0.5, 6);
  });

  it('changes only a little from one minute to the next', () => {
    for (let h = 0; h < 24; h += 1 / 60) {
      const a = skyWeights(h),
        b = skyWeights(h + 1 / 60);
      for (const k of SKY_PHASES) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.02);
    }
  });

  it('stacked layer opacities reproduce the blend over the night base', () => {
    for (const h of [5.5, 8, 10, 14, 17, 19, 21, 23]) {
      const w = skyWeights(h);
      const o = skyOpacities(w);
      // composite night, then morning, day and evening "over" it
      let mix = { night: 1, morning: 0, day: 0, evening: 0 };
      for (const k of ['morning', 'day', 'evening'] as const) {
        const a = o[k];
        mix = { night: mix.night * (1 - a), morning: mix.morning * (1 - a), day: mix.day * (1 - a), evening: mix.evening * (1 - a) };
        mix[k] += a;
      }
      for (const k of SKY_PHASES) expect(mix[k]).toBeCloseTo(w[k], 6);
    }
  });

  it('has the most stars at night and few by day', () => {
    expect(starAlpha(skyWeights(23))).toBe(1);
    expect(starAlpha(skyWeights(13))).toBeLessThan(0.25);
  });
});
