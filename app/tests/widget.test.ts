import { beforeEach, describe, expect, it, vi } from 'vitest';
import { widgetData } from '../src/logic/widget';
import { defaultState, dev, finishSession, getState, pauseSession, resumeSession, startSession } from '../src/state/store';
import type { State } from '../src/state/store';

const at = (d: number, h: number, m: number, s = 0) => new Date(2026, 10, d, h, m, s).getTime();

function fresh(over: Partial<State> = {}, lang: 'en' | 'de' = 'en') {
  const d = defaultState();
  dev.replace({ ...d, onboarded: true, goal: 30, ...over, settings: { ...d.settings, lang } });
}
const data = () => widgetData(getState(), Date.now());

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at(16, 12, 0));
  fresh();
});

describe('what the widget shows', () => {
  it('today’s minutes against the goal, until midnight', () => {
    dev.addMinutes(18);
    const w = data();
    expect(w.today).toBe(18);
    expect(w.goal).toBe(30);
    expect(w.until).toBe(at(17, 0, 0));
    expect(w.text.today).toBe('18 of 30 min');
    expect(w.text.zero).toBe('0 of 30 min');
    expect(w.session).toBeNull();
    expect(w.ready).toBe(true);
  });

  it('yesterday’s minutes do not count, and the start button starts the last span chosen', () => {
    dev.addMinutes(40);
    vi.setSystemTime(at(17, 9, 0));
    startSession(45, 'work');
    vi.setSystemTime(at(17, 9, 45));
    finishSession();
    const w = data();
    expect(w.today).toBe(45);
    expect(w.start).toBe(45);
    expect(w.text.start).toBe('▶ 45 min');
  });

  it('a running session ends after its planned span, a pause moves the end', () => {
    startSession(25, 'study');
    expect(data().session).toEqual({ ends: at(16, 12, 25) });
    expect(data().text.ends).toContain('12:25');

    vi.setSystemTime(at(16, 12, 10));
    pauseSession();
    expect(data().session).toEqual({ ends: null });
    expect(data().text.ends).toBe('');

    vi.setSystemTime(at(16, 12, 20));
    resumeSession();
    expect(data().session).toEqual({ ends: at(16, 12, 35) });
  });

  it('in demo speed a minute lasts a second', () => {
    dev.setSpeed(true);
    startSession(25, 'study');
    expect(data().session).toEqual({ ends: at(16, 12, 0, 25) });
  });

  it('the tool that skips days moves the app’s day, not the phone’s clock', () => {
    dev.nextDay();
    dev.addMinutes(10);
    const w = data();
    expect(w.today).toBe(10);
    // the widget compares against the real clock: today's minutes hold until the real midnight
    expect(w.until).toBe(at(17, 0, 0));
    startSession(25, 'study');
    expect(data().session).toEqual({ ends: at(16, 12, 25) });
  });

  it('speaks the language of the app and names the companion', () => {
    fresh({}, 'de');
    dev.addMinutes(18);
    startSession(25, 'study');
    const w = data();
    expect(w.text.today).toBe('18 von 30 Min.');
    expect(w.text.ends).toBe('Ende 12:25');
    expect(w.text.paused).toBe('Pausiert');
    expect(w.text.done).toBe('Fertig – tippen');
    expect(w.ghost).toBe(getState().companion);
    expect(w.name.length).toBeGreaterThan(0);
  });

  it('before the first ride through the app it may not start a session', () => {
    fresh({ onboarded: false });
    expect(data().ready).toBe(false);
  });
});
