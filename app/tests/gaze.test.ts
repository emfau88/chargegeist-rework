import { describe, expect, it } from 'vitest';
import { EYES } from '../src/data/eyes.gen';
import { RIGS } from '../src/data/rigs.gen';
import { GLINT_FOLLOW, gazeOf, lids, pupilShift } from '../src/rig/gaze';

describe('the gaze', () => {
  it('is never longer than 1, whatever comes in', () => {
    for (const [x, y] of [
      [0, 0],
      [1, 1],
      [-1, 1],
      [5, -9],
      [0.3, -0.2],
      [Number.NaN, 2],
      [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    ]) {
      const [gx, gy] = gazeOf(x, y);
      expect(Math.hypot(gx, gy)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Number.isFinite(gx) && Number.isFinite(gy)).toBe(true);
    }
    expect(gazeOf(0.3, -0.2)).toEqual([0.3, -0.2]);
  });

  it('moves the inside of an eye at most as far as it may', () => {
    for (let a = 0; a < 360; a += 7) {
      for (const far of [0.2, 1, 3, 100]) {
        const [x, y] = pupilShift(Math.cos(a) * far, Math.sin(a) * far, 10);
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(10 + 1e-9);
      }
    }
    expect(pupilShift(1, 0, 10)).toEqual([10, 0]);
    expect(pupilShift(-1, 0, 10)[0]).toBe(-10);
    expect(pupilShift(0, 1, 10)[1]).toBeCloseTo(8, 6);
    expect(pupilShift(1, 1, -4)).toEqual([0, 0]);
    expect(pupilShift(1, 1, Number.NaN)).toEqual([0, 0]);
  });

  it('keeps the highlights nearly in place', () => {
    expect(GLINT_FOLLOW).toBeGreaterThan(0);
    expect(GLINT_FOLLOW).toBeLessThan(0.3);
  });
});

describe('the eyes of every ghost that has them in layers', () => {
  it('the inside never leaves the rim: it moves less than the rim is wide', () => {
    for (const [id, kit] of Object.entries(EYES)) {
      expect(RIGS[id], id).toBeTruthy();
      expect(kit.shift, id).toBeGreaterThan(2);
      expect(kit.shift, id).toBeLessThanOrEqual(kit.rim - 2);
      // also at the far end of any gaze
      const [x, y] = pupilShift(9, 9, kit.shift);
      expect(Math.hypot(x, y), id).toBeLessThan(kit.rim);
      for (const v of kit.ink) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the lids', () => {
  it('lie outside the eye while it is open', () => {
    for (const smile of [false, true]) {
      const l = lids(0, smile);
      // at the middle and at the corners (bow reaches its full size there)
      expect(l.top).toBeLessThan(0);
      expect(l.top + l.bow).toBeLessThanOrEqual(0.01);
      expect(l.bot).toBeGreaterThan(1);
    }
  });

  it('close steadily and never cross', () => {
    for (const smile of [false, true]) {
      let before = lids(0, smile);
      for (let c = 0.02; c <= 1.0001; c += 0.02) {
        const l = lids(c, smile);
        expect(l.top).toBeGreaterThan(before.top);
        expect(l.bot).toBeLessThanOrEqual(before.bot);
        expect(l.bot).toBeGreaterThan(l.top);
        before = l;
      }
    }
  });

  it('end in a bowl for sleep and in an arch for a smile', () => {
    expect(lids(1, false).bow).toBeLessThan(0);
    expect(lids(1, true).bow).toBeGreaterThan(0);
    expect(lids(1, false).top).toBeGreaterThan(0.5);
    expect(lids(1, true).bot).toBeLessThan(0.5);
  });

  it('take any number', () => {
    expect(lids(Number.NaN, false)).toEqual(lids(0, false));
    expect(lids(7, true)).toEqual(lids(1, true));
    expect(lids(-3, false)).toEqual(lids(0, false));
  });
});
