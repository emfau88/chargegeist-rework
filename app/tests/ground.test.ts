import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE, SCENE_PROPS } from '../src/data/scene.gen';
import { GROUND_LINE, REST_ABOVE_BOTTOM, SCENE_MAX_W, SCROLL_RATE, groundY, onGround, onStagedLights, sceneLit, scenePlace, setGround, stageLights, stagedLights } from '../src/fx/ground';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/scene');
const A = {},
  B = {};

afterEach(() => {
  setGround(A, null);
  setGround(B, null);
});

describe('the painted scene: where it hangs', () => {
  it('puts its ground line on the ghost shadow, on every phone', () => {
    for (const [w, h, shadow] of [
      [360, 640, 302],
      [390, 844, 410],
      [390, 844, 449],
      [430, 932, 434],
    ]) {
      const p = scenePlace(w, h, shadow);
      expect(p.scale).toBeCloseTo(w / SCENE.w, 6);
      expect(Math.abs(p.top + GROUND_LINE * p.scale - shadow)).toBeLessThanOrEqual(0.5);
      // hills and ground hang together
      expect(p.groundTop).toBe(p.top);
    }
  });

  it('the ground line lies on the clearing, below its crest and above the calm ground', () => {
    expect(GROUND_LINE).toBeGreaterThan(SCENE.ground.mid);
    expect(GROUND_LINE).toBeLessThan(SCENE.ground.mid + 60);
    // the hills behind end above the clearing, so they show between the firs
    expect(SCENE.far.mid).toBeLessThan(SCENE.ground.mid);
    expect(SCENE.mid.mid).toBeGreaterThan(SCENE.far.mid);
  });

  it('covers the screen down to the tab bar when a ghost stands on it', () => {
    // 390 x 844, shadow at 410: the picture ends below the top of the tab bar (763); the ground colour goes on from there
    const p = scenePlace(390, 844, 410);
    expect(p.top + SCENE.h * p.scale).toBeGreaterThan(640);
    expect(p.top).toBeGreaterThan(0);
  });

  it('at rest the hills lie low and the ground with its firs is below the screen', () => {
    for (const [w, h] of [
      [360, 640],
      [390, 844],
      [430, 932],
    ]) {
      const p = scenePlace(w, h, null);
      // the valley between the hills
      expect(p.top + SCENE.mid.mid * p.scale).toBeCloseTo(h - REST_ABOVE_BOTTOM, 0);
      // the highest hill stays in the lower third
      expect(p.top + SCENE.far.top * p.scale).toBeGreaterThan(h * 0.66);
      // the highest fir of the ground
      expect(p.groundTop + SCENE.ground.top * p.scale).toBeGreaterThanOrEqual(h);
    }
  });

  it('keeps its width on a wide screen, and survives odd sizes', () => {
    expect(scenePlace(1280, 800, 400).width).toBe(SCENE_MAX_W);
    expect(scenePlace(1280, 800, 400).scale).toBeCloseTo(SCENE_MAX_W / SCENE.w, 6);
    for (const w of [0, -5, Number.NaN, Infinity]) {
      const p = scenePlace(w, Number.NaN, null);
      expect(Number.isFinite(p.top)).toBe(true);
      expect(p.scale).toBeGreaterThan(0);
    }
  });

  it('the ground goes with the page, the land behind lags', () => {
    expect(SCROLL_RATE.ground).toBe(1);
    expect(SCROLL_RATE.mid).toBeLessThan(1);
    expect(SCROLL_RATE.far).toBeLessThan(SCROLL_RATE.mid);
    expect(SCROLL_RATE.far).toBeGreaterThan(0);
  });
});

describe('the painted scene: who says where the ground is', () => {
  it('tells its listeners, and only when something changed', () => {
    let n = 0;
    const off = onGround(() => n++);
    setGround(A, 410.4);
    expect(groundY()).toBe(410);
    setGround(A, 410.2);
    expect(n).toBe(1);
    setGround(A, 449);
    expect(n).toBe(2);
    off();
    setGround(A, 300);
    expect(n).toBe(2);
  });

  it('a stage that leaves does not take the ground from the one that came after it', () => {
    setGround(A, 410);
    // the next screen mounts its stage before the old one is gone
    setGround(B, 245);
    setGround(A, null);
    expect(groundY()).toBe(245);
    setGround(B, null);
    expect(groundY()).toBeNull();
  });
});

describe('the painted scene: what the day lights', () => {
  it('the first lantern burns after any focus today, the second once the goal is reached', () => {
    expect(sceneLit(0, 30)).toEqual({ first: false, goal: false });
    expect(sceneLit(1, 30)).toEqual({ first: true, goal: false });
    expect(sceneLit(29, 30)).toEqual({ first: true, goal: false });
    expect(sceneLit(30, 30)).toEqual({ first: true, goal: true });
    expect(sceneLit(95, 30)).toEqual({ first: true, goal: true });
  });

  it('stays dark for numbers that make no sense', () => {
    expect(sceneLit(Number.NaN, 30)).toEqual({ first: false, goal: false });
    expect(sceneLit(10, 0)).toEqual({ first: true, goal: false });
  });
});

describe('the painted scene: a screen lights the lanterns itself', () => {
  afterEach(() => stageLights(null));

  it('nothing is staged until a screen asks, and null gives the lanterns back to the day', () => {
    expect(stagedLights()).toBeNull();
    stageLights({ first: false, goal: true });
    expect(stagedLights()).toEqual({ first: false, goal: true });
    stageLights(null);
    expect(stagedLights()).toBeNull();
  });

  it('tells its listeners, and only when something changed', () => {
    let n = 0;
    const off = onStagedLights(() => n++);
    stageLights({ first: false, goal: false });
    stageLights({ first: false, goal: false });
    expect(n).toBe(1);
    stageLights({ first: false, goal: true });
    expect(n).toBe(2);
    stageLights(null);
    stageLights(null);
    expect(n).toBe(3);
    off();
    stageLights({ first: true, goal: true });
    expect(n).toBe(3);
  });
});

describe('the painted scene: its pictures', () => {
  it('every layer and every prop is there as a file', () => {
    for (const n of ['far', 'mid', 'ground', ...Object.keys(SCENE_PROPS)]) {
      expect(existsSync(resolve(ASSETS, `${n}.webp`)), n).toBe(true);
    }
  });

  it('a lantern has the same size lit and unlit, so the two lie on each other', () => {
    for (const n of ['lantern_hang', 'lantern_stand']) {
      const [w0, h0] = SCENE_PROPS[`${n}_off`];
      const [w1, h1] = SCENE_PROPS[`${n}_on`];
      expect(Math.abs(w0 - w1)).toBeLessThanOrEqual(4);
      expect(Math.abs(h0 - h1)).toBeLessThanOrEqual(4);
    }
  });
});
