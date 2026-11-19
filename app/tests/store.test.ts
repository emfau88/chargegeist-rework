import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOSS_DUPE_ENERGY, WISH_COST, item } from '../src/data/catalog';
import { ACHIEVEMENTS } from '../src/logic/progress';
import {
  chooseCompanion,
  claimWish,
  defaultState,
  dev,
  elapsedMin,
  finishSession,
  getState,
  keepFromDrop,
  pauseSession,
  resumeSession,
  revealDrop,
  setWish,
  startSession,
  toggleItem,
} from '../src/state/store';

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

describe('sessions', () => {
  it('counts time without pauses', () => {
    startSession(25, 'work');
    vi.advanceTimersByTime(5 * 60_000);
    pauseSession();
    vi.advanceTimersByTime(10 * 60_000);
    resumeSession();
    vi.advanceTimersByTime(3 * 60_000);
    expect(elapsedMin(getState().active!)).toBeCloseTo(8, 5);
  });
  it('credits whole minutes when ended early, nothing under a minute', () => {
    startSession(25, 'work');
    vi.advanceTimersByTime(40_000);
    expect(finishSession()).toBeNull();
    expect(getState().sessions).toHaveLength(0);
    startSession(25, 'work');
    vi.advanceTimersByTime(12.7 * 60_000);
    const r = finishSession()!;
    expect(r.minutes).toBe(12);
    expect(r.completed).toBe(false);
  });
  it('demo speed turns seconds into minutes', () => {
    dev.setSpeed(true);
    startSession(25, 'work');
    vi.advanceTimersByTime(25_000);
    expect(elapsedMin(getState().active!)).toBeCloseTo(25, 5);
  });
});

describe('daily loop', () => {
  it('opens one daily drop per day from 5 minutes', () => {
    const a = focus(3);
    expect(a.dailyDrop).toBe(false);
    const b = focus(2);
    expect(b.dailyDrop).toBe(true);
    const c = focus(25);
    expect(c.dailyDrop).toBe(false);
    expect(getState().pending).toHaveLength(1);
    vi.setSystemTime(T0 + 86_400_000);
    expect(focus(5).dailyDrop).toBe(true);
    expect(getState().pending).toHaveLength(2);
  });
  it('a drop keeps its cards once revealed, and keeping adds the piece', () => {
    focus(5);
    const id = getState().pending[0].id;
    const cards = revealDrop(id);
    expect(revealDrop(id)).toEqual(cards);
    const k = keepFromDrop(id, cards[0]);
    expect(k.dupe).toBe(false);
    expect(getState().items[cards[0]]).toBeTruthy();
    expect(getState().pending).toHaveLength(0);
    expect(getState().dropsOpened).toBe(1);
  });
  it('a duplicate turns into wish energy', () => {
    focus(5);
    const id = getState().pending[0].id;
    const cards = revealDrop(id);
    dev.replace({ ...getState(), items: { [cards[1]]: { at: 0, via: 'drop', seen: true } } });
    const before = getState().wish.energy;
    const k = keepFromDrop(id, cards[1]);
    expect(k.dupe).toBe(true);
    expect(getState().wish.energy).toBe(before + k.energy);
  });
  it('the trial session opens a first drop with a rare or better', () => {
    dev.replace(defaultState());
    chooseCompanion('ember', 'Funke');
    startSession(1, 'study', true);
    vi.advanceTimersByTime(60_000);
    const r = finishSession()!;
    expect(r.firstDrop).toBe(true);
    expect(r.achievements).toContain('first');
    const p = getState().pending[0];
    expect(p.kind).toBe('first');
    const cards = revealDrop(p.id);
    expect(cards.some((c) => item(c).rarity !== 'common')).toBe(true);
    expect(getState().names.ember).toBe('Funke');
    expect(Object.keys(getState().ghosts)).toEqual(['ember']);
  });
  it('a complete outfit brings its costume ghost', () => {
    focus(5);
    dev.replace({ ...getState(), items: { owl_ears: { at: 0, via: 'drop', seen: true }, owl_goggles: { at: 0, via: 'drop', seen: true } } });
    const id = getState().pending[0].id;
    dev.replace({ ...getState(), pending: [{ ...getState().pending[0], cards: ['owl_beak', 'pirate_hat', 'witch_hat'] }] });
    const k = keepFromDrop(id, 'owl_beak');
    expect(k.set).toEqual({ have: 3, total: 3, done: true });
    expect(k.ghostJoined).toBe('owl');
    expect(getState().ghosts.owl.via).toBe('set');
    expect(k.achievements).toContain('outfit1');
  });
  it('companions wear one piece per spot, costume ghosts wear nothing', () => {
    dev.replace({ ...getState(), items: { witch_hat: { at: 0, via: 'drop', seen: true }, pirate_hat: { at: 0, via: 'drop', seen: true }, owl_beak: { at: 0, via: 'drop', seen: true } } });
    toggleItem('volti', 'witch_hat');
    toggleItem('volti', 'owl_beak');
    expect(getState().outfits.volti).toEqual({ head: 'witch_hat', mouth: 'owl_beak' });
    toggleItem('volti', 'pirate_hat');
    expect(getState().outfits.volti.head).toBe('pirate_hat');
    toggleItem('volti', 'pirate_hat');
    expect(getState().outfits.volti.head).toBeUndefined();
    toggleItem('pumpkin', 'witch_hat');
    expect(getState().outfits.pumpkin).toBeUndefined();
    toggleItem('volti', 'samurai_helmet');
    expect(getState().outfits.volti.head).toBeUndefined();
  });
});

describe('week, boss, goal, wish', () => {
  it('a charge week of 5 days brings a week drop and an achievement', () => {
    let last;
    for (let d = 0; d < 5; d++) {
      vi.setSystemTime(T0 + d * 86_400_000);
      last = focus(5);
    }
    expect(last!.weekDoneNow).toBe(true);
    expect(last!.weekDrop).toBe(true);
    expect(last!.achievements).toContain('week1');
    expect(getState().pending.filter((p) => p.kind === 'week')).toHaveLength(1);
  });
  it('reaching the weekly hours calms the boss', () => {
    const boss = getState().boss?.ghost;
    const r1 = focus(100);
    expect(r1.boss.calmedNow).toBe(false);
    const r2 = focus(50);
    expect(r2.boss.calmedNow).toBe(true);
    expect(getState().ghosts[r2.boss.ghost].via).toBe('boss');
    if (boss) expect(r2.boss.ghost).toBe(boss);
  });
  it('calming a boss you already own gives wish energy', () => {
    focus(1); // sets this week's boss
    const b = getState().boss!.ghost;
    dev.replace({ ...getState(), ghosts: { ...getState().ghosts, [b]: { at: 0, via: 'set', seen: true } } });
    const r = focus(150);
    expect(r.boss.calmedNow).toBe(true);
    expect(r.boss.wasOwned).toBe(true);
    const ach = r.achievements.reduce((a, id) => a + ACHIEVEMENTS.find((x) => x.id === id)!.energy, 0);
    expect(r.wish.after - r.wish.before).toBe(150 + BOSS_DUPE_ENERGY + ach);
  });
  it('flags the daily goal once', () => {
    expect(focus(25).goalReachedNow).toBe(false);
    expect(focus(5).goalReachedNow).toBe(true);
    expect(focus(5).goalReachedNow).toBe(false);
  });
  it('claims a wished piece once the energy is there', () => {
    const target = 'owl_beak';
    setWish(target);
    focus(20);
    expect(claimWish()).toBeNull();
    focus(10);
    // 30 minutes, 20 for the first session, 30 for the first daily goal
    const before = getState().wish.energy;
    expect(before).toBe(50 + 30);
    const r = claimWish()!;
    expect(r.item).toBe(target);
    expect(getState().items[target].via).toBe('wish');
    expect(getState().wish.energy).toBe(before - WISH_COST.common);
    expect(getState().wish.target).toBeNull();
  });
  it('unlocks the next companion at 3 hours', () => {
    chooseCompanion('volti', 'Volti');
    const r = focus(180);
    expect(r.companionsUnlocked).toEqual(['ember']);
  });
});
