import { describe, expect, it } from 'vitest';
import { STYLES } from '../src/data/catalog';
import { AURAS, AuraSim } from '../src/fx/aura';
import type { AuraBox, AuraMode } from '../src/fx/aura';
import { mulberry32 } from '../src/logic/drops';

const BOX: AuraBox = { cx: 300, cy: 310, rx: 150, ry: 190, glow: [0.4, 0.9, 1] };
const run = (sim: AuraSim, seconds: number, mode: AuraMode = 'idle') => {
  for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, BOX, mode);
};

describe('auras', () => {
  it('every aura style has a particle definition', () => {
    for (const x of STYLES.filter((s) => s.kind === 'aura')) expect(AURAS[x.id], x.id).toBeTruthy();
  });

  it('stays within its particle budget, on stage and visible', () => {
    for (const id of Object.keys(AURAS)) {
      const sim = new AuraSim(id, mulberry32(7));
      const d = AURAS[id];
      let peak = 0;
      for (let i = 0; i < 20 * 60; i++) {
        sim.step(1 / 60, BOX);
        if (i % 180 === 0) sim.burst(BOX, 10);
        peak = Math.max(peak, sim.particles.length);
      }
      // a burst may go a little over, never far
      expect(peak, id).toBeLessThanOrEqual(d.max + 6 + (d.extra?.max ?? 0));
      expect(peak, id).toBeGreaterThan(0);
      for (const p of sim.particles) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), id).toBe(true);
        expect(p.x, id).toBeGreaterThan(-200);
        expect(p.x, id).toBeLessThan(800);
        expect(p.y, id).toBeGreaterThan(-300);
        expect(p.y, id).toBeLessThan(900);
        expect(p.alpha, id).toBeGreaterThanOrEqual(0);
        expect(p.alpha, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is the same for the same seed', () => {
    const a = new AuraSim('aura_storm', mulberry32(42));
    const b = new AuraSim('aura_storm', mulberry32(42));
    run(a, 5);
    run(b, 5);
    expect(a.particles.map((p) => [p.x, p.y, p.age])).toEqual(b.particles.map((p) => [p.x, p.y, p.age]));
  });

  it('a removed or switched aura fades out quickly', () => {
    const sim = new AuraSim('aura_fireflies', mulberry32(3));
    run(sim, 6);
    expect(sim.particles.length).toBeGreaterThan(0);
    sim.setId('aura_snow');
    run(sim, 0.4);
    expect(sim.particles.some((p) => p.def === AURAS.aura_fireflies)).toBe(false);
    sim.setId(undefined);
    run(sim, 0.4);
    expect(sim.particles).toHaveLength(0);
    expect(sim.active).toBe(false);
  });

  it('sleeps quieter than it idles', () => {
    const count = (mode: AuraMode) => {
      const sim = new AuraSim('aura_bubbles', mulberry32(9));
      let n = 0;
      for (let i = 0; i < 30 * 60; i++) {
        sim.step(1 / 60, BOX, mode);
        n += sim.particles.length;
      }
      return n;
    };
    expect(count('sleep')).toBeLessThan(count('idle'));
  });
});
