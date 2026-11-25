/**
 * What the widget on the home screen of the phone shows (android/…/WidgetPlugin.java keeps it for the
 * widget). The widget cannot read the save and draws nothing of its own: the app hands it these values
 * and every text in the language the app speaks.
 */
import { fmtDate, t } from '../i18n';
import { DAY, dayKey, fmtMinutes } from './time';
import { companionName } from '../state/store';
import type { State } from '../state/store';

export interface WidgetData {
  /** The first ride through the app is done: only then may the widget start a session. */
  ready: boolean;
  /** Until this moment (real time, ms) the minutes below are today's. After it the widget shows none. */
  until: number;
  /** Today's focus minutes and the daily goal. */
  today: number;
  goal: number;
  /** The companion: its id names the portrait. */
  ghost: string;
  name: string;
  /** The running session: when it ends (real time, ms), or null while it is paused. */
  session: { ends: number | null } | null;
  /** The minutes the start button starts with: the last ones chosen. */
  start: number;
  text: {
    today: string;
    /** today, once the day is over */
    zero: string;
    start: string;
    /** spoken by a screen reader for the start button */
    startHint: string;
    ends: string;
    paused: string;
    done: string;
  };
}

/** real: the clock of the phone. The tool that skips days only moves the app's clock, not the widget's. */
export function widgetData(s: State, real: number): WidgetData {
  const off = s.dev.dayOffset * DAY;
  const at = real + off;
  const day = dayKey(at);
  const today = Math.round(s.sessions.filter((x) => x.day === day).reduce((a, x) => a + x.min, 0));
  const d = new Date(at);
  const until = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - off;

  const a = s.active;
  // the minutes reach the plan when the clock, less the pauses, stands at the planned span (see elapsedMin)
  const ends = a && a.pausedAt === null ? a.startedAt - off + a.pausedMs + (a.planned * 60_000) / a.speed : null;
  return {
    ready: s.onboarded,
    until,
    today,
    goal: s.goal,
    ghost: s.companion,
    name: companionName(s),
    session: a ? { ends } : null,
    start: s.lastDuration,
    text: {
      today: t('home_goal_of', { n: today, goal: s.goal }),
      zero: t('home_goal_of', { n: 0, goal: s.goal }),
      start: `▶ ${fmtMinutes(s.lastDuration)}`,
      startHint: t('home_start'),
      ends: ends === null ? '' : t('widget_ends', { time: fmtDate(ends, { hour: 'numeric', minute: '2-digit' }) }),
      paused: t('focus_paused'),
      done: t('widget_done'),
    },
  };
}
