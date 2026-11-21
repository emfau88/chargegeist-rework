import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dayKey } from '../src/logic/time';
import { dailyDropOpen, defaultState, dev, finishSession, getState, startSession, todayMinutes } from '../src/state/store';

const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at(16, 12, 0));
  dev.replace({ ...defaultState(), onboarded: true });
});

describe('a session that runs past midnight', () => {
  it('counts for the day on which it ends, and brings that day its drop', () => {
    vi.setSystemTime(at(16, 23, 58));
    startSession(5, 'study');
    vi.setSystemTime(at(17, 0, 3));
    const res = finishSession()!;

    const s = getState();
    expect(s.sessions[0].day).toBe(dayKey(at(17, 0, 3)));
    // the result speaks of the same day as the save
    expect(res.todayBefore).toBe(0);
    expect(res.todayAfter).toBe(5);
    expect(todayMinutes()).toBe(5);
    // five minutes make a charged day: the drop of the new day is there, and only once
    expect(res.dailyDrop).toBe(true);
    expect(s.pending.filter((p) => p.kind === 'daily')).toHaveLength(1);
    expect(dailyDropOpen()).toBe(false);
  });

  it('reaches the goal of the new day, not of the old one', () => {
    dev.replace({ ...defaultState(), onboarded: true, goal: 15 });
    vi.setSystemTime(at(16, 23, 50));
    startSession(15, 'study');
    vi.setSystemTime(at(17, 0, 5));
    const res = finishSession()!;
    expect(res.goalReachedNow).toBe(true);
    expect(getState().goalDays).toEqual([dayKey(at(17, 0, 5))]);
  });

  it('a session inside one day is booked as before', () => {
    vi.setSystemTime(at(16, 21, 0));
    startSession(25, 'study');
    vi.setSystemTime(at(16, 21, 25));
    finishSession();
    expect(getState().sessions[0].day).toBe(dayKey(at(16, 21, 0)));
    expect(todayMinutes()).toBe(25);
  });
});
