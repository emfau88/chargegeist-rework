import { describe, expect, it } from 'vitest';
import { ACT_SECONDS, CHARM_PUSH_AT, IDLE_ACTS, PROUD_SPARKLE_AT, actPose, mayAct, pickAct } from '../src/rig/acts';
import type { ActName, ActPose } from '../src/rig/acts';

const ALL = Object.keys(ACT_SECONDS) as ActName[];
const LIGHTS: ([number, number] | null)[] = [null, [0, -1], [-0.94, -0.33], [0.94, -0.33], [-0.68, -0.73]];
/** Every pose of an act, 60 times a second. */
const frames = (name: ActName, light: [number, number] | null = [-0.68, -0.73]) => {
  const out: [number, ActPose][] = [];
  for (let t = 0; t < ACT_SECONDS[name]; t += 1 / 60) {
    const p = actPose(name, t, light);
    if (p) out.push([t, p]);
  }
  return out;
};

describe('acts of a ghost', () => {
  it('every act has a pose for all of its time and none after it', () => {
    for (const name of ALL) {
      expect(frames(name).length, name).toBeGreaterThan(30);
      expect(actPose(name, 0, null), name).not.toBeNull();
      expect(actPose(name, ACT_SECONDS[name] - 0.001, null), name).not.toBeNull();
      expect(actPose(name, ACT_SECONDS[name], null), name).toBeNull();
      expect(actPose(name, 99, null), name).toBeNull();
      expect(actPose(name, -0.1, null), name).toBeNull();
      expect(actPose(name, Number.NaN, null), name).toBeNull();
    }
  });

  it('stays within what the rig can show, under any light', () => {
    for (const name of ALL)
      for (const light of LIGHTS)
        for (const [t, p] of frames(name, light)) {
          const at = `${name} at ${t.toFixed(2)}`;
          if (p.look) {
            expect(Math.abs(p.look[0]), at).toBeLessThanOrEqual(1);
            expect(Math.abs(p.look[1]), at).toBeLessThanOrEqual(1);
          }
          expect(p.shut ?? 0, at).toBeGreaterThanOrEqual(0);
          expect(p.shut ?? 0, at).toBeLessThanOrEqual(1);
          expect(Math.abs(p.armL ?? 0), at).toBeLessThanOrEqual(120);
          expect(Math.abs(p.armR ?? 0), at).toBeLessThanOrEqual(120);
          expect(p.squash ?? 1, at).toBeGreaterThanOrEqual(0.9);
          expect(p.squash ?? 1, at).toBeLessThanOrEqual(1.15);
          expect(Math.abs(p.lean ?? 0), at).toBeLessThanOrEqual(8);
          expect(p.turn ?? 0, at).toBeGreaterThanOrEqual(0);
          expect(p.turn ?? 0, at).toBeLessThanOrEqual(1);
          expect(p.mouthScale ?? 1, at).toBeGreaterThanOrEqual(1);
          expect(p.mouthScale ?? 1, at).toBeLessThanOrEqual(1.8);
          for (const v of [p.shut, p.armL, p.armR, p.squash, p.lean, p.turn, p.mouthScale, ...(p.look ?? [])]) if (v !== undefined) expect(Number.isFinite(v), at).toBe(true);
        }
  });

  it('begins and ends at rest, so nothing jumps', () => {
    for (const name of ALL) {
      const f = frames(name);
      for (const [, p] of [f[0], f[f.length - 1]]) {
        expect(p.squash ?? 1, name).toBeCloseTo(1, 1);
        expect(Math.abs(p.armL ?? 0), name).toBeLessThan(8);
        expect(Math.abs(p.armR ?? 0), name).toBeLessThan(8);
        expect(Math.abs(p.lean ?? 0), name).toBeLessThan(1);
        expect(p.shut ?? 0, name).toBeLessThan(0.12);
        expect(p.mouthScale ?? 1, name).toBeLessThan(1.1);
      }
      // a twirl ends after exactly one turn, facing front again
      expect(f[0][1].turn ?? 0, name).toBeCloseTo(0, 2);
      if (name === 'twirl') expect(f[f.length - 1][1].turn).toBeCloseTo(1, 2);
    }
  });

  it('moves smoothly from frame to frame', () => {
    for (const name of ALL) {
      const f = frames(name);
      for (let i = 1; i < f.length; i++) {
        const a = f[i - 1][1],
          b = f[i][1];
        const at = `${name} at ${f[i][0].toFixed(2)}`;
        expect(Math.abs((a.squash ?? 1) - (b.squash ?? 1)), at).toBeLessThan(0.02);
        expect(Math.abs((a.armL ?? 0) - (b.armL ?? 0)), at).toBeLessThan(12);
        expect(Math.abs((a.shut ?? 0) - (b.shut ?? 0)), at).toBeLessThan(0.12);
        expect(Math.abs((a.turn ?? 0) - (b.turn ?? 0)), at).toBeLessThan(0.06);
      }
    }
  });

  it('looks up at the light in the sky, on the side where it stands', () => {
    const left = actPose('moon', 1.2, [-0.94, -0.33])!,
      right = actPose('moon', 1.2, [0.94, -0.33])!;
    expect(left.look![0]).toBeLessThan(-0.6);
    expect(right.look![0]).toBeGreaterThan(0.6);
    expect(left.look![1]).toBeLessThan(0);
    expect(actPose('moon', 1.2, null)!.look![1]).toBeLessThan(-0.8);
  });

  it('pushes the charm and sparkles while the act still runs', () => {
    expect(CHARM_PUSH_AT).toBeLessThan(ACT_SECONDS.charm - 0.3);
    expect(actPose('charm', CHARM_PUSH_AT, null)!.armL).toBeGreaterThan(60);
    expect(PROUD_SPARKLE_AT).toBeLessThan(ACT_SECONDS.proud - 0.5);
  });
});

describe('when he acts', () => {
  const rest = { mode: 'idle' as const, busy: false, off: false };

  it('never while he focuses or sleeps', () => {
    expect(mayAct(rest)).toBe(true);
    expect(mayAct({ ...rest, mode: 'focus' })).toBe(false);
    expect(mayAct({ ...rest, mode: 'sleep' })).toBe(false);
  });

  it('not while something holds him, and not where acts are off', () => {
    expect(mayAct({ ...rest, busy: true })).toBe(false);
    expect(mayAct({ ...rest, off: true })).toBe(false);
  });

  it('only picks what is possible right now', () => {
    for (let r = 0; r <= 1; r += 0.01) {
      expect(pickAct({ sky: false, charm: false, tired: false }, null, r)).not.toBe('moon');
      expect(pickAct({ sky: false, charm: false, tired: false }, null, r)).not.toBe('charm');
      expect(pickAct({ sky: true, charm: true, tired: false }, null, r)).not.toBe('yawn');
      const any = pickAct({ sky: true, charm: true, tired: true }, null, r);
      expect(IDLE_ACTS).toContain(any);
      // reactions are never picked at rest
      expect(any).not.toBe('nod');
      expect(any).not.toBe('proud');
    }
  });

  it('reaches every act that is possible, and never repeats the last one', () => {
    const seen = new Set<string>();
    for (let r = 0; r < 1; r += 0.01) seen.add(pickAct({ sky: true, charm: true, tired: true }, null, r)!);
    expect([...seen].sort()).toEqual([...IDLE_ACTS].sort());
    for (const last of IDLE_ACTS) for (let r = 0; r <= 1; r += 0.05) expect(pickAct({ sky: true, charm: true, tired: true }, last, r)).not.toBe(last);
  });

  it('takes any roll', () => {
    const room = { sky: false, charm: false, tired: false };
    expect(pickAct(room, null, Number.NaN)).toBe(pickAct(room, null, 0));
    expect(pickAct(room, null, 7)).toBe(pickAct(room, null, 1));
    expect(pickAct(room, null, -3)).toBe(pickAct(room, null, 0));
  });
});
