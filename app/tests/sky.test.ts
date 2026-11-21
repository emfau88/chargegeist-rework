import { describe, expect, it } from 'vitest';
import { SKY_PHASES, moonPhase, moonPlace, orbAlpha, skyLight, skyOpacities, skyWeights, starAlpha, sunPlace } from '../src/logic/sky';
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

describe('sun and moon', () => {
  it('the sun is up by day and the moon by night', () => {
    expect(sunPlace(13)).not.toBeNull();
    expect(sunPlace(2)).toBeNull();
    expect(moonPlace(1)).not.toBeNull();
    expect(moonPlace(12)).toBeNull();
  });

  it('they rise on the left, stand highest in the middle and set on the right', () => {
    const rise = sunPlace(6.5)!,
      noon = sunPlace(13)!,
      set = sunPlace(19.5)!;
    expect(rise.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(set.x);
    expect(noon.y).toBeLessThan(rise.y);
    expect(noon.alt).toBeCloseTo(1, 6);
    expect(moonPlace(1)!.alt).toBeCloseTo(1, 6);
    expect(moonPlace(23)!.x).toBeLessThan(moonPlace(3)!.x);
  });

  it('they are faint near the horizon and never jump from one minute to the next', () => {
    expect(orbAlpha(sunPlace(6.05)!.alt)).toBeLessThan(0.1);
    expect(orbAlpha(sunPlace(13)!.alt)).toBe(1);
    for (let h = 6; h < 20 - 1 / 60; h += 1 / 60) {
      const a = sunPlace(h)!,
        b = sunPlace(h + 1 / 60)!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThan(0.01);
    }
  });

  it('the moon shows the phase of the real one', () => {
    // a new moon (solar eclipse of 8 April 2024) and a full moon (lunar eclipse of 14 March 2025)
    const nm = moonPhase(Date.UTC(2024, 3, 8, 18, 21));
    expect(Math.min(nm, 1 - nm)).toBeLessThan(0.03);
    expect(moonPhase(Date.UTC(2025, 2, 14, 6, 55))).toBeCloseTo(0.5, 1);
    for (const ms of [0, Date.UTC(1990, 5, 1), Date.UTC(2040, 1, 1)]) {
      expect(moonPhase(ms)).toBeGreaterThanOrEqual(0);
      expect(moonPhase(ms)).toBeLessThan(1);
    }
  });
});

describe('the light the ghosts pick up from the sky', () => {
  it('comes from the side of the sun: left in the morning, right in the evening', () => {
    expect(skyLight(8).dir[0]).toBeLessThan(-0.5);
    expect(skyLight(18).dir[0]).toBeGreaterThan(0.5);
    expect(Math.abs(skyLight(13).dir[0])).toBeLessThan(0.5);
  });

  it('always has a direction of length 1 and never comes from below', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const [x, y] = skyLight(h).dir;
      expect(Math.hypot(x, y)).toBeCloseTo(1, 5);
      expect(y).toBeLessThan(-0.2);
    }
  });

  it('is warm in the evening and cool at night', () => {
    const eve = skyLight(19).tint,
      night = skyLight(1).tint;
    expect(eve[0]).toBeGreaterThan(eve[2]);
    expect(night[2]).toBeGreaterThan(night[0]);
  });

  it('only tints a ghost slightly, so it keeps its own colour', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const l = skyLight(h);
      for (const v of l.tint) {
        expect(v).toBeGreaterThanOrEqual(0.96);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('changes smoothly through the day', () => {
    for (let h = 0; h < 24; h += 1 / 30) {
      const a = skyLight(h),
        b = skyLight(h + 1 / 30);
      expect(Math.abs(a.tint[2] - b.tint[2])).toBeLessThan(0.02);
      // at dawn and dusk the light swings from one to the other, over the top, within about half an hour
      expect(Math.hypot(a.dir[0] - b.dir[0], a.dir[1] - b.dir[1])).toBeLessThan(0.3);
    }
  });
});
