import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COMPANION, SPARK_ENERGY } from '../src/data/catalog';
import { defaultState, retire } from '../src/state/store';
import type { State } from '../src/state/store';

const T0 = new Date(2026, 10, 16, 9, 0).getTime();
const own = (via: 'start' | 'hours' | 'spark' | 'boss' = 'start') => ({ at: T0, via, seen: true });
const day = '2026-11-16';

/** A save from before the starters changed: Volti first, Ember and Luna earned with hours. */
function oldSave(over: Partial<State> = {}): State {
  return {
    ...defaultState(),
    onboarded: true,
    createdAt: T0,
    companion: 'volti',
    firstCompanion: 'volti',
    ghosts: { volti: own(), ember: own('hours'), luna: own('hours'), kitsune: own('spark') },
    bonds: { volti: { hearts: 42, rest: 2, day: '', touched: [], seen: 2 } },
    looks: { volti: { aura: 'aura_snow' }, kitsune: { charm: 'charm_teacup' } },
    names: { volti: 'Blitz' },
    ...over,
  };
}
const minutes = (h: number) => [{ id: 's', at: T0, day, min: h * 60, planned: h * 60, tag: 'study' as const, done: true }];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

describe('a save meets the new starters', () => {
  it('a fresh save needs nothing', () => {
    const s = defaultState();
    const before = JSON.stringify({ ...s, shelf: {} });
    expect(JSON.stringify(retire(s))).toBe(before);
    expect(s.companion).toBe(DEFAULT_COMPANION);
  });

  it('the old starters go on the shelf with what belonged to them; the first starter takes over', () => {
    const s = retire(oldSave());
    expect(Object.keys(s.ghosts).sort()).toEqual(['aviator', 'kitsune']);
    expect(s.companion).toBe('aviator');
    expect(s.firstCompanion).toBe('aviator');
    expect(s.ghosts.aviator.via).toBe('start');
    expect(Object.keys(s.shelf!).sort()).toEqual(['ember', 'luna', 'volti']);
    expect(s.shelf!.volti).toMatchObject({ bond: { hearts: 42 }, look: { aura: 'aura_snow' }, name: 'Blitz' });
    expect(s.bonds.volti).toBeUndefined();
    expect(s.looks.volti).toBeUndefined();
    expect(s.names.volti).toBeUndefined();
    // what belongs to a ghost that stays is untouched
    expect(s.looks.kitsune).toEqual({ charm: 'charm_teacup' });
  });

  it('the active companion stays if it is still part of the game', () => {
    const s = retire(oldSave({ companion: 'kitsune' }));
    expect(s.companion).toBe('kitsune');
    expect(s.firstCompanion).toBe('aviator');
  });

  it('the companions your focus hours have earned join at once, in the new order', () => {
    // 9 hours: the thresholds at 3 and 8 hours are passed
    const s = retire(oldSave({ sessions: minutes(9) }));
    expect(s.ghosts.pumpkin?.via).toBe('hours');
    expect(s.ghosts.witch?.via).toBe('hours');
    expect(s.ghosts.sprout).toBeUndefined();
  });

  it('before the onboarding is done nothing is earned yet', () => {
    const s = retire(oldSave({ onboarded: false, sessions: minutes(9) }));
    expect(Object.keys(s.ghosts).sort()).toEqual(['aviator', 'kitsune']);
  });

  it('sparks of a ghost that became a companion come back as wish energy', () => {
    const s0 = oldSave({ sparks: { target: 'witch', have: { witch: 2, kitsune: 3, owl: 1 } }, ghosts: { volti: own() } });
    const energy = s0.wish.energy;
    const s = retire(s0);
    expect(s.sparks.have).toEqual({ kitsune: 3, owl: 1 });
    expect(s.sparks.target).toBeNull();
    expect(s.wish.energy).toBe(energy + 2 * SPARK_ENERGY);
  });

  it('a pick among the costume ghosts stays', () => {
    const s = retire(oldSave({ sparks: { target: 'owl', have: { owl: 1 } }, ghosts: { volti: own() } }));
    expect(s.sparks.target).toBe('owl');
  });

  it('a boss that is a companion now makes room; a calmed one stays in the books', () => {
    const open = retire(oldSave({ boss: { week: '2026-W47', ghost: 'pumpkin', goal: 150, done: false } }));
    expect(open.boss).toBeNull();
    const calmed = retire(oldSave({ boss: { week: '2026-W47', ghost: 'pumpkin', goal: 150, done: true } }));
    expect(calmed.boss?.ghost).toBe('pumpkin');
    const costume = retire(oldSave({ boss: { week: '2026-W47', ghost: 'owl', goal: 150, done: false } }));
    expect(costume.boss?.ghost).toBe('owl');
  });

  it('a starter you already had through sparks is yours as before', () => {
    const s = retire(oldSave({ ghosts: { volti: own(), witch: own('spark') } }));
    expect(s.ghosts.witch.via).toBe('spark');
    expect(s.companion).toBe('aviator');
  });

  it('doing it twice changes nothing more', () => {
    const once = retire(oldSave({ sessions: minutes(9), sparks: { target: 'witch', have: { witch: 2 } } }));
    const snap = JSON.stringify(once);
    expect(JSON.stringify(retire(once))).toBe(snap);
  });

  it('an old save with earned hours loads for real and is not dropped', async () => {
    // the path the app takes at start: the save is read before there is any state
    const mem = new Map<string, string>([['chargegeist.v3', JSON.stringify(oldSave({ sessions: minutes(9) }))]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    vi.resetModules();
    const m = await import('../src/state/store');
    const s = m.getState();
    vi.unstubAllGlobals();
    expect(s.onboarded).toBe(true);
    expect(s.sessions).toHaveLength(1);
    expect(s.companion).toBe('aviator');
    expect(Object.keys(s.ghosts).sort()).toEqual(['aviator', 'kitsune', 'pumpkin', 'witch']);
    expect(s.shelf!.volti.bond!.hearts).toBe(42);
  });

  it('a ghost comes back from the shelf once it is part of the game again', () => {
    // the shelf is read by id: put a ghost there that is switched on
    const s = retire({ ...defaultState(), shelf: { owl: { ghost: own('spark'), bond: { hearts: 7, rest: 0, day: '', touched: [], seen: 0 }, name: 'Uhu' } } });
    expect(s.ghosts.owl.via).toBe('spark');
    expect(s.bonds.owl.hearts).toBe(7);
    expect(s.names.owl).toBe('Uhu');
    expect(s.shelf).toEqual({});
  });
});
