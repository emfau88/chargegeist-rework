import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { State } from '../src/state/store';

/**
 * Two instances of the app (two tabs, or a tab and the installed app) share one save in the browser.
 * Each test loads the store twice over the same storage, as two open instances would.
 */
const KEY = 'chargegeist.v3';
type Store = typeof import('../src/state/store');
let mem: Map<string, string>;
let listeners: ((e: { key: string | null }) => void)[][];

async function open(): Promise<{ store: Store; tell: (key: string | null) => void }> {
  const mine: ((e: { key: string | null }) => void)[] = [];
  listeners.push(mine);
  vi.stubGlobal('window', { addEventListener: (type: string, fn: (e: { key: string | null }) => void) => type === 'storage' && mine.push(fn) });
  vi.resetModules();
  const store = await import('../src/state/store');
  return { store, tell: (key) => mine.forEach((fn) => fn({ key })) };
}
const saved = () => JSON.parse(mem.get(KEY)!) as State;
const T0 = new Date(2026, 10, 16, 9, 0).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  mem = new Map();
  listeners = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('two instances of the app share one save', () => {
  it('an instance with an older copy does not wipe out a session the other one saved', async () => {
    const a = await open();
    const b = await open();
    // A runs and ends a session; B was open all the while and knows nothing of it
    a.store.startSession(25, 'study');
    vi.setSystemTime(T0 + 25 * 60_000);
    expect(a.store.finishSession()?.minutes).toBe(25);
    expect(b.store.getState().sessions).toHaveLength(0);

    // B only changes the daily goal
    b.store.setGoal(60);

    expect(saved().sessions).toHaveLength(1);
    expect(saved().goal).toBe(60);
    expect(b.store.getState().sessions).toHaveLength(1);
  });

  it('changes made in turn by both instances all stay', async () => {
    const a = await open();
    const b = await open();
    a.store.setGoal(45);
    b.store.setSetting('sound', false);
    a.store.setTags(['read']);
    expect(saved().goal).toBe(45);
    expect(saved().settings.sound).toBe(false);
    expect(saved().tags).toEqual(['read']);
  });

  it('when the browser tells an instance of a new save, it shows it at once', async () => {
    const a = await open();
    const b = await open();
    a.store.setGoal(45);
    expect(b.store.getState().goal).toBe(30);
    b.tell(KEY);
    b.tell(`${KEY}.rev`);
    expect(b.store.getState().goal).toBe(45);
  });

  it('a session that the other instance already ended is not counted twice', async () => {
    const a = await open();
    a.store.startSession(25, 'study');
    const b = await open();
    expect(b.store.getState().active).not.toBeNull();
    vi.setSystemTime(T0 + 25 * 60_000);
    expect(a.store.finishSession()?.minutes).toBe(25);
    // B never heard of it and ends "its" session as well
    expect(b.store.finishSession()).toBeNull();
    expect(saved().sessions).toHaveLength(1);
    expect(saved().active).toBeNull();
  });

  it('a single instance is not slowed down or changed by the counter', async () => {
    const a = await open();
    a.store.setGoal(45);
    a.store.setGoal(50);
    expect(a.store.getState().goal).toBe(50);
    expect(Number(mem.get(`${KEY}.rev`))).toBe(2);
  });
});
