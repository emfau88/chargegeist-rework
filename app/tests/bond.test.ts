import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOND_STEPS, addFocus, addTouch, bondLevel, bondProgress, emptyBond, levelFor, touchesLeft } from '../src/logic/bond';
import { ackBond, bondOf, bondUps, defaultState, dev, finishSession, getState, startSession, touchBond } from '../src/state/store';
import type { State } from '../src/state/store';

const T0 = new Date(2026, 10, 16, 9, 0).getTime(); // Monday 09:00

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  dev.replace({ ...defaultState(), onboarded: true });
});

function focus(min: number) {
  startSession(min, 'study');
  vi.advanceTimersByTime(min * 60_000);
  return finishSession()!;
}

describe('bond logic', () => {
  it('stages come at 10, 40, 100 and 250 hearts', () => {
    expect(BOND_STEPS).toEqual([10, 40, 100, 250]);
    expect([0, 9, 10, 39, 40, 99, 100, 249, 250, 9999].map(levelFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('one heart per 5 focus minutes, the rest carries over', () => {
    let b = emptyBond();
    let g = addFocus(b, 12);
    expect(g.gained).toBe(2);
    expect(g.bond.rest).toBe(2);
    g = addFocus(g.bond, 3);
    expect(g.gained).toBe(1);
    expect(g.bond).toMatchObject({ hearts: 3, rest: 0 });
    b = g.bond;
    expect(addFocus(b, 4).gained).toBe(0);
  });

  it('each touch brings one heart a day, three at most, and a new day starts over', () => {
    let b = emptyBond();
    const day = '2026-11-16';
    for (const k of ['stroke', 'hold', 'tickle', 'stroke', 'hold', 'tickle'] as const) b = addTouch(b, k, day).bond;
    expect(b.hearts).toBe(3);
    expect(addTouch(b, 'stroke', day).gained).toBe(0);
    expect(touchesLeft(b, day)).toEqual([]);
    expect(touchesLeft(b, '2026-11-17')).toEqual(['stroke', 'hold', 'tickle']);
    const next = addTouch(b, 'hold', '2026-11-17');
    expect(next.gained).toBe(1);
    expect(next.bond.hearts).toBe(4);
  });

  it('a stage once reached never sinks', () => {
    const b = { ...emptyBond(), hearts: 12, seen: 3 as const };
    expect(bondLevel(b)).toBe(3);
    expect(bondProgress(b).level).toBe(3);
    // nothing in the logic takes hearts away
    expect(addFocus(b, 0).bond.hearts).toBe(12);
    expect(addTouch(b, 'stroke', 'x').bond.hearts).toBeGreaterThanOrEqual(12);
  });

  it('progress runs from one stage to the next and is full at the top', () => {
    expect(bondProgress({ ...emptyBond(), hearts: 25 })).toMatchObject({ level: 1, from: 10, to: 40, frac: 0.5 });
    expect(bondProgress({ ...emptyBond(), hearts: 300 })).toMatchObject({ level: 4, to: null, frac: 1 });
  });
});

describe('bond in the app', () => {
  it('a session gives the companion its hearts', () => {
    const r = focus(25);
    expect(r.bond).toMatchObject({ ghost: 'volti', gained: 5, hearts: 5, before: 0, after: 0 });
    expect(bondOf(getState(), 'volti').hearts).toBe(5);
    const r2 = focus(25);
    expect(r2.bond).toMatchObject({ gained: 5, hearts: 10, before: 0, after: 1 });
  });

  it('touches count for ghosts you own only, once per kind a day', () => {
    expect(touchBond('ember', 'stroke')).toBeNull();
    expect(touchBond('volti', 'stroke')?.gained).toBe(1);
    expect(touchBond('volti', 'stroke')).toBeNull();
    expect(touchBond('volti', 'hold')?.hearts).toBe(2);
    vi.setSystemTime(T0 + 24 * 3600_000);
    expect(touchBond('volti', 'stroke')?.hearts).toBe(3);
  });

  it('a new stage waits for its celebration once, then stays', () => {
    dev.addHearts('volti', 10);
    expect(bondUps()).toEqual(['volti']);
    ackBond('volti');
    expect(bondUps()).toEqual([]);
    expect(bondLevel(bondOf(getState(), 'volti'))).toBe(1);
  });

  it('becoming friends and kindred spirits are achievements', () => {
    dev.addHearts('volti', 40);
    expect(getState().achievements.friend1).toBeTruthy();
    expect(getState().achievements.kindred1).toBeFalsy();
    dev.addHearts('volti', 210);
    expect(getState().achievements.kindred1).toBeTruthy();
  });

  it('an old save without bonds loads and starts every bond at zero', async () => {
    const { bonds: _b, ...old } = defaultState();
    const mem = new Map<string, string>([['chargegeist.v3', JSON.stringify({ ...old, onboarded: true })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    vi.resetModules();
    const m = await import('../src/state/store');
    const s: State = m.getState();
    expect(s.onboarded).toBe(true);
    expect(s.bonds).toEqual({});
    expect(m.bondOf(s, 'volti')).toMatchObject({ hearts: 0, seen: 0 });
    vi.unstubAllGlobals();
  });
});
