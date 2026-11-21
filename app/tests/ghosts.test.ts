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
