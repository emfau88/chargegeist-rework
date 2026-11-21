import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOSS_DUPE_ENERGY, COSTUME_GHOSTS, SPARK_ENERGY, sparksNeeded } from '../src/data/catalog';
import { actGap } from '../src/rig/acts';
import {
  bondOf,
  currentBoss,
  dailyDropOpen,
  defaultState,
  dev,
  elapsedMin,
  finishSession,
  getState,
  lookOf,
  pauseSession,
  setSparkTarget,
  sparkTarget,
  startSession,
  todayMinutes,
  touchBond,
  wearStyle,
} from '../src/state/store';

const T0 = new Date(2026, 10, 16, 9, 0).getTime(); // Monday 09:00

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  dev.replace({ ...defaultState(), onboarded: true, ghosts: { volti: { at: T0, via: 'start', seen: true } } });
});

describe('developer menu: time', () => {
  it('ends a running session at once, as a full one', () => {
    startSession(25, 'study');
    vi.advanceTimersByTime(60_000);
    expect(elapsedMin(getState().active!)).toBeCloseTo(1, 1);
    dev.finishNow();
    expect(elapsedMin(getState().active!)).toBeGreaterThanOrEqual(25);
    const r = finishSession()!;
    expect(r.completed).toBe(true);
    expect(r.minutes).toBe(25);
    expect(getState().active).toBeNull();
  });

  it('also ends a paused session, and one at demo speed', () => {
    startSession(50, 'study');
    vi.advanceTimersByTime(120_000);
    pauseSession();
    dev.finishNow();
    expect(getState().active!.pausedAt).toBeNull();
    expect(finishSession()!.completed).toBe(true);

    dev.setSpeed(true);
    startSession(15, 'study');
    dev.finishNow();
    const r = finishSession()!;
    expect(r.completed).toBe(true);
    expect(r.minutes).toBe(15);
  });

  it('does nothing without a session', () => {
    const before = JSON.stringify(getState());
    dev.finishNow();
    expect(JSON.stringify(getState())).toBe(before);
  });

  it('adding minutes up to the goal reaches it', () => {
    const s = getState();
    const r = dev.addMinutes(Math.max(1, s.goal - todayMinutes(s)));
    expect(r.goalReachedNow).toBe(true);
    expect(todayMinutes(getState())).toBe(getState().goal);
  });

  it('makes the drop of the day earnable again', () => {
    expect(dev.addMinutes(25).dailyDrop).toBe(true);
    expect(dailyDropOpen()).toBe(false);
    expect(dev.addMinutes(25).dailyDrop).toBe(false);
    dev.freeDailyDrop();
    expect(dailyDropOpen()).toBe(true);
    expect(dev.addMinutes(25).dailyDrop).toBe(true);
  });

  it('lets a touch bring a heart again on the same day', () => {
    expect(touchBond('volti', 'stroke')?.gained).toBe(1);
    expect(touchBond('volti', 'stroke')).toBeNull();
    dev.freeTouches();
    expect(touchBond('volti', 'stroke')?.gained).toBe(1);
    expect(bondOf(getState(), 'volti').hearts).toBe(2);
  });

  it('calms the boss once: its ghost joins, a second time changes nothing', () => {
    const boss = currentBoss().ghost;
    expect(getState().ghosts[boss]).toBeUndefined();
    expect(dev.calmBoss()).toBe(true);
    expect(getState().boss!.done).toBe(true);
    expect(getState().ghosts[boss].via).toBe('boss');
    const energy = getState().wish.energy;
    expect(dev.calmBoss()).toBe(false);
    expect(getState().wish.energy).toBe(energy);
  });

  it('a calmed boss you own already gives wish energy, and its sparks are paid back otherwise', () => {
    // a first session fixes the boss of the week; a ghost you own is never picked as a new boss
    dev.addMinutes(5);
    const boss = getState().boss!.ghost;
    dev.setGhost(boss, true);
    const before = getState().wish.energy;
    expect(dev.calmBoss()).toBe(true);
    expect(getState().wish.energy - before).toBeGreaterThanOrEqual(BOSS_DUPE_ENERGY);

    dev.replace({ ...defaultState(), onboarded: true, ghosts: { volti: { at: T0, via: 'start', seen: true } } });
    dev.addMinutes(5);
    const b2 = getState().boss!.ghost;
    dev.replace({ ...getState(), sparks: { target: null, have: { [b2]: 2 } } });
    const e2 = getState().wish.energy;
    dev.calmBoss();
    expect(getState().sparks.have[b2]).toBeUndefined();
    expect(getState().wish.energy - e2).toBeGreaterThanOrEqual(2 * SPARK_ENERGY);
  });
});

describe('developer menu: ghosts, styles, values', () => {
  it('gives and takes a single ghost, but never the active companion', () => {
    dev.setGhost('kitsune', true);
    expect(getState().ghosts.kitsune).toBeTruthy();
    dev.setGhost('kitsune', false);
    expect(getState().ghosts.kitsune).toBeUndefined();
    dev.setGhost(getState().companion, false);
    expect(getState().ghosts[getState().companion]).toBeTruthy();
  });

  it('a ghost that is given stops collecting sparks', () => {
    setSparkTarget('kitsune');
    dev.addSpark();
    expect(getState().sparks.have.kitsune).toBe(1);
    dev.setGhost('kitsune', true);
    expect(getState().sparks.have.kitsune).toBeUndefined();
    expect(getState().sparks.target).toBeNull();
    expect(sparkTarget()).not.toBe('kitsune');
  });

  it('gives and takes a single style; a taken one comes off every ghost', () => {
    dev.setStyle('charm_teacup', true);
    wearStyle('volti', 'charm_teacup');
    expect(lookOf(getState(), 'volti').charm).toBe('charm_teacup');
    dev.setStyle('charm_teacup', false);
    expect(getState().styles.charm_teacup).toBeUndefined();
    expect(lookOf(getState(), 'volti').charm).toBeUndefined();
  });

  it('sparks add up until the ghost joins', () => {
    const id = COSTUME_GHOSTS[0].id;
    setSparkTarget(id);
    const need = sparksNeeded(id);
    for (let i = 1; i < need; i++) expect(dev.addSpark().joined).toBe(false);
    const last = dev.addSpark();
    expect(last.joined).toBe(true);
    expect(last.ghost).toBe(id);
    expect(getState().ghosts[id]).toBeTruthy();
  });

  it('adds wish energy and hearts', () => {
    dev.addWish(50);
    expect(getState().wish.energy).toBe(50);
    dev.addHearts('volti', 10);
    expect(bondOf(getState(), 'volti').hearts).toBe(10);
  });
});

describe('developer menu: look and starting over', () => {
  it('sets the sky to an hour and back to the real time', () => {
    dev.setSkyHour(19);
    expect(getState().dev.skyHour).toBe(19);
    dev.setSkyHour(null);
    expect(getState().dev.skyHour).toBeNull();
  });

  it('keeps its switches in the save, and an older save gets them', () => {
    dev.setActs(true);
    dev.setTools(true);
    expect(getState().dev.acts).toBe(true);
    expect(getState().dev.tools).toBe(true);
    expect(defaultState().dev).toEqual({ speed: false, dayOffset: 0, skyHour: null, acts: false, tools: false });
  });

  it('acts come every few seconds when asked, otherwise rarely', () => {
    for (const r of [0, 0.5, 1, Number.NaN, 9]) {
      expect(actGap(r, true)).toBeGreaterThanOrEqual(3);
      expect(actGap(r, true)).toBeLessThanOrEqual(5);
      expect(actGap(r, false)).toBeGreaterThanOrEqual(14);
      expect(actGap(r, false)).toBeLessThanOrEqual(26);
    }
  });

  it('restarting the onboarding keeps focus time and ghosts', () => {
    dev.addMinutes(25);
    dev.setStyle('aura_bubbles', true);
    dev.restartOnboarding();
    const s = getState();
    expect(s.onboarded).toBe(false);
    expect(s.styles).toEqual({});
    expect(s.pending).toEqual([]);
    expect(s.sessions.length).toBe(1);
    expect(s.ghosts.volti).toBeTruthy();
  });

  it('a reset gives a fresh save', () => {
    dev.addMinutes(25);
    dev.setGhost('kitsune', true);
    dev.reset();
    expect(getState()).toEqual(defaultState());
  });
});
