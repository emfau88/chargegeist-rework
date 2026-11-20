import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOSS_DUPE_ENERGY, COSTUME_GHOSTS, DUPE_ENERGY, SPARK_ENERGY, WISH_COST, style } from '../src/data/catalog';
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
  lookOf,
  migrateV2,
  pauseSession,
  resumeSession,
  revealDrop,
  setPlus,
  setSparkTarget,
  setWish,
  sparkTarget,
  startSession,
  toggleStyle,
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
  it('a drop keeps its cards once revealed; keeping adds the style and a ghost spark', () => {
    focus(5);
    const id = getState().pending[0].id;
    const cards = revealDrop(id);
    expect(revealDrop(id)).toEqual(cards);
    const target = sparkTarget()!;
    const k = keepFromDrop(id, cards[0]);
    expect(k.dupe).toBe(false);
    expect(getState().styles[cards[0]]).toBeTruthy();
    expect(k.spark).toEqual({ ghost: target, have: 1, need: 3, joined: false, energy: 0 });
    expect(getState().sparks.have[target]).toBe(1);
    expect(getState().pending).toHaveLength(0);
    expect(getState().dropsOpened).toBe(1);
  });
  it('a duplicate style turns into wish energy, the spark still comes', () => {
    focus(5);
    const id = getState().pending[0].id;
    const cards = revealDrop(id);
    dev.replace({ ...getState(), styles: { [cards[1]]: { at: 0, via: 'drop', seen: true } } });
    const before = getState().wish.energy;
    const k = keepFromDrop(id, cards[1]);
    expect(k.dupe).toBe(true);
    expect(k.energy).toBe(DUPE_ENERGY[style(cards[1]).rarity]);
    expect(getState().wish.energy).toBe(before + k.energy);
    expect(k.spark.have).toBe(1);
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
    expect(cards.some((c) => style(c).rarity !== 'common')).toBe(true);
    for (const c of cards) expect(style(c).kind).toBe('aura');
    expect(getState().names.ember).toBe('Funke');
    expect(Object.keys(getState().ghosts)).toEqual(['ember']);
  });
  it('enough sparks bring the costume ghost you charge', () => {
    setSparkTarget('owl');
    dev.replace({ ...getState(), sparks: { target: 'owl', have: { owl: 2 } } });
    focus(5);
    const id = getState().pending[0].id;
    const k = keepFromDrop(id, revealDrop(id)[0]);
    expect(k.spark).toEqual({ ghost: 'owl', have: 3, need: 3, joined: true, energy: 0 });
    expect(getState().ghosts.owl.via).toBe('spark');
    expect(getState().sparks.have.owl).toBeUndefined();
    expect(getState().sparks.target).toBeNull();
    expect(k.achievements).toContain('costume1');
    expect(sparkTarget()).not.toBe('owl');
  });
  it('without a pick, sparks go to the ghost furthest along; switching keeps sparks', () => {
    dev.replace({ ...getState(), sparks: { target: null, have: { witch: 1, kitsune: 3 } } });
    expect(sparkTarget()).toBe('kitsune'); // 3/5 beats 1/3
    setSparkTarget('witch');
    expect(sparkTarget()).toBe('witch');
    expect(getState().sparks.have.kitsune).toBe(3);
  });
  it('once every costume ghost is yours, a spark turns into wish energy', () => {
    const ghosts = { ...getState().ghosts };
    for (const g of COSTUME_GHOSTS) ghosts[g.id] = { at: 0, via: 'boss', seen: true };
    dev.replace({ ...getState(), ghosts });
    focus(5);
    const id = getState().pending[0].id;
    const before = getState().wish.energy;
    const k = keepFromDrop(id, revealDrop(id)[0]);
    expect(k.spark).toEqual({ ghost: null, have: 0, need: 0, joined: false, energy: SPARK_ENERGY });
    expect(getState().wish.energy).toBe(before + SPARK_ENERGY + k.energy);
  });
  it('every ghost shows one style per kind; Plus styles only with Plus', () => {
    dev.replace({
      ...getState(),
      styles: {
        aura_snow: { at: 0, via: 'drop', seen: true },
        aura_notes: { at: 0, via: 'drop', seen: true },
        shimmer_mint: { at: 0, via: 'drop', seen: true },
        charm_teacup: { at: 0, via: 'drop', seen: true },
      },
      ghosts: { ...getState().ghosts, kitsune: { at: 0, via: 'boss', seen: true } },
    });
    toggleStyle('volti', 'aura_snow');
    toggleStyle('volti', 'shimmer_mint');
    expect(lookOf(getState(), 'volti')).toEqual({ aura: 'aura_snow', shimmer: 'shimmer_mint' });
    toggleStyle('volti', 'charm_teacup');
    expect(lookOf(getState(), 'volti')).toEqual({ aura: 'aura_snow', shimmer: 'shimmer_mint', charm: 'charm_teacup' });
    toggleStyle('volti', 'charm_moon'); // not owned
    expect(lookOf(getState(), 'volti').charm).toBe('charm_teacup');
    toggleStyle('volti', 'aura_notes');
    expect(lookOf(getState(), 'volti').aura).toBe('aura_notes');
    toggleStyle('volti', 'aura_notes');
    expect(lookOf(getState(), 'volti').aura).toBeUndefined();
    toggleStyle('kitsune', 'aura_snow'); // costume ghosts wear style too
    expect(lookOf(getState(), 'kitsune').aura).toBe('aura_snow');
    toggleStyle('volti', 'aura_storm'); // not owned
    expect(lookOf(getState(), 'volti').aura).toBeUndefined();
    toggleStyle('pumpkin', 'aura_snow'); // ghost not owned
    expect(getState().looks.pumpkin).toBeUndefined();
    toggleStyle('volti', 'shimmer_heart');
    expect(lookOf(getState(), 'volti').shimmer).toBe('shimmer_mint');
    setPlus(true);
    toggleStyle('volti', 'shimmer_heart');
    expect(lookOf(getState(), 'volti').shimmer).toBe('shimmer_heart');
    setPlus(false);
    expect(lookOf(getState(), 'volti').shimmer).toBeUndefined();
  });
  it('turns a v2 save into v3: pieces become sparks, outfits go, ghosts and energy stay', () => {
    const d = defaultState();
    const old = {
      ...d,
      v: 2,
      ghosts: { volti: { at: 1, via: 'start', seen: true }, witch: { at: 2, via: 'set', seen: true } },
      items: Object.fromEntries(
        ['witch_hat', 'witch_collar', 'kitsune_tail', 'kitsune_mask', 'kitsune_collar', 'owl_ears', 'star_halo'].map((id) => [id, { at: 1, via: 'drop', seen: true }]),
      ),
      outfits: { volti: { tail: 'kitsune_tail' } },
      achievements: { first: 5, outfit1: 6 },
      wish: { target: 'owl_beak', energy: 140 },
      pending: [{ id: 'p1', kind: 'daily', at: 1, cards: ['owl_beak', 'pirate_hat', 'witch_hat'] }],
    };
    delete (old as Record<string, unknown>).styles;
    delete (old as Record<string, unknown>).looks;
    delete (old as Record<string, unknown>).sparks;
    const s = migrateV2(old);
    expect(s.v).toBe(3);
    expect(Object.keys(s.ghosts).sort()).toEqual(['volti', 'witch']);
    expect(s.ghosts.witch.via).toBe('spark');
    expect(s.sparks.have).toEqual({ kitsune: 3, owl: 1, starmage: 1 });
    expect('items' in s || 'outfits' in s).toBe(false);
    expect(s.looks).toEqual({});
    expect(s.achievements).toEqual({ first: 5, costume1: 6 });
    expect(s.wish).toEqual({ target: null, energy: 140 });
    expect(s.pending[0].cards).toBeNull();
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
  it('a boss ghost you had sparks for refunds them as wish energy', () => {
    focus(1);
    const b = getState().boss!.ghost;
    dev.replace({ ...getState(), sparks: { target: null, have: { [b]: 2 } } });
    const r = focus(150);
    expect(r.boss.calmedNow).toBe(true);
    expect(r.boss.sparkRefund).toBe(2 * SPARK_ENERGY);
    expect(getState().sparks.have[b]).toBeUndefined();
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
  it('claims a wished style once the energy is there', () => {
    const target = 'aura_bubbles';
    setWish(target);
    focus(20);
    expect(claimWish()).toBeNull();
    focus(10);
    // 30 minutes, 20 for the first session, 30 for the first daily goal
    const before = getState().wish.energy;
    expect(before).toBe(50 + 30);
    const r = claimWish()!;
    expect(r.style).toBe(target);
    expect(getState().styles[target].via).toBe('wish');
    expect(getState().wish.energy).toBe(before - WISH_COST.common);
    expect(getState().wish.target).toBeNull();
  });
  it('a Plus style can not be wished for', () => {
    setWish('shimmer_heart');
    dev.replace({ ...getState(), wish: { target: 'shimmer_heart', energy: 9999 } });
    expect(claimWish()).toBeNull();
  });
  it('unlocks the next companion at 3 hours', () => {
    chooseCompanion('volti', 'Volti');
    const r = focus(180);
    expect(r.companionsUnlocked).toEqual(['ember']);
  });
});
