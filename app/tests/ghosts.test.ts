import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COSTUME_GHOSTS, GHOSTS, SPARKS_NEEDED, sparksNeeded } from '../src/data/catalog';
import { EYES } from '../src/data/eyes.gen';
import { RIGS } from '../src/data/rigs.gen';
import { partNames } from '../src/rig/rig';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/ghosts');
/** The ghosts whose body is the finished figure of their sheet. */
const FIGURES = ['cloud', 'cactus', 'dragon', 'jellyfish', 'phoenix', 'moondeer'];

describe('ghost parts', () => {
  it('every part a ghost draws is there as a file, still and live', () => {
    for (const g of GHOSTS) {
      for (const live of [false, true]) {
        for (const part of partNames(g.id, live)) {
          expect(existsSync(resolve(ASSETS, g.id, `${part}.webp`)), `${g.id}/${part}`).toBe(true);
        }
      }
    }
  });

  it('every ghost has eyes in layers', () => {
    for (const g of GHOSTS) {
      expect(EYES[g.id], g.id).toBeTruthy();
      expect(partNames(g.id, true)).toContain(g.id === 'pirate' ? 'eye_iris_L' : 'eye_iris_R');
    }
  });

  it('a figure ghost does not draw again what is painted on its body', () => {
    for (const id of FIGURES) {
      const parts = partNames(id, true);
      expect(RIGS[id].baked, id).toContain('blush');
      expect(parts.some((p) => p.startsWith('blush_')), id).toBe(false);
      expect(parts.some((p) => p.startsWith('arm_')), id).toBe(!RIGS[id].baked!.includes('arms'));
      expect(parts).toContain('body');
      expect(parts).toContain('mouth_smile');
    }
    // the cloud is the one whose kit brings loose arms the figure does not hold up already
    expect(partNames('cloud')).toContain('arm_L');
    expect(partNames('phoenix')).not.toContain('arm_L');
  });

  it('a figure ghost whose arms are painted on has parts that bend instead', () => {
    for (const id of FIGURES) {
      const r = RIGS[id];
      // every ghost can wave: with arms on a hinge, or with a part of its picture that bends at a joint
      expect(!r.baked?.includes('arms') || (!!r.limbs?.L && !!r.limbs?.R), id).toBe(true);
      for (const [key, l] of Object.entries(r.limbs ?? {})) {
        const where = `${id}/${key}`;
        expect(l.shape.length % 2, where).toBe(0);
        expect(l.shape.length, where).toBeGreaterThanOrEqual(6);
        // the turn fades in from the joint outwards, and stays small: the picture is bent, not cut
        expect(l.ramp[0], where).toBeGreaterThanOrEqual(0);
        expect(l.ramp[1], where).toBeGreaterThan(l.ramp[0]);
        expect(Math.abs(l.gain), where).toBeGreaterThan(0);
        expect(Math.abs(l.gain), where).toBeLessThanOrEqual(0.6);
        expect(l.max, where).toBeGreaterThan(0);
        expect(l.max, where).toBeLessThanOrEqual(26);
        expect(l.lift ?? l.max, where).toBeLessThanOrEqual(l.max);
        // the joint lies at the edge of the part: some of the outline is near it, some of it far out
        const d = [];
        for (let i = 0; i < l.shape.length; i += 2) d.push(Math.hypot(l.shape[i] - l.at[0], l.shape[i + 1] - l.at[1]));
        expect(Math.max(...d), where).toBeGreaterThan(l.ramp[1]);
      }
    }
  });

  it('the first generation still draws arms and blush', () => {
    for (const g of GHOSTS.filter((x) => !FIGURES.includes(x.id))) {
      expect(RIGS[g.id].baked, g.id).toBeUndefined();
      for (const p of ['arm_L', 'arm_R', 'blush_L', 'blush_R']) expect(partNames(g.id)).toContain(p);
    }
  });

  it('a figure ghost stands on the stage like the others: feet at the same height, head below the top', () => {
    for (const id of FIGURES) {
      const R = RIGS[id];
      // stage y of a body row: (v - cy) * k + 280
      const top = (R.top - R.cy) * R.k + 280;
      expect(top, id).toBeGreaterThan(55);
      expect(top, id).toBeLessThan(130);
      // the face lies in the upper half of the figure, the eyes above the mouth
      expect(R.eyeY).toBeLessThan(R.mouth[1]);
      expect((R.eyeY - R.cy) * R.k + 280).toBeLessThan(300);
      // where a charm floats and a high five lands, also without arms to draw
      expect(R.armL.at[0]).toBeLessThan(R.cx);
      expect(R.armR.at[0]).toBeGreaterThan(R.cx);
    }
  });

  it('the new costume ghosts need sparks by their rarity', () => {
    for (const id of FIGURES) {
      const g = COSTUME_GHOSTS.find((x) => x.id === id)!;
      expect(g, id).toBeTruthy();
      expect(sparksNeeded(id)).toBe(SPARKS_NEEDED[g.rarity!]);
      expect(g.nameDe.length).toBeGreaterThan(0);
      expect(g.quoteDe.length).toBeGreaterThan(0);
    }
  });
});
