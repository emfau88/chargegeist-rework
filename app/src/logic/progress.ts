import { COSTUME_GHOSTS } from '../data/catalog';
import { addDays, dayKey, weekDays, weekKey } from './time';

/** A day counts for the charge week, and opens the daily drop, from this many focus minutes. */
export const CHARGE_DAY_MIN = 5;
/** Charged days needed in a week (Mon..Sun). */
export const WEEK_TARGET = 5;

export interface SessionRec {
  id: string;
  /** Start, epoch ms. */
  at: number;
  /** Local day key of the start. */
  day: string;
  /** Credited focus minutes. */
  min: number;
  planned: number;
  tag: string;
  done: boolean;
}

export function minutesByDay(sessions: SessionRec[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.day, (m.get(s.day) ?? 0) + s.min);
  return m;
}

export function totalMinutes(sessions: SessionRec[]): number {
  return sessions.reduce((a, s) => a + s.min, 0);
}

export interface WeekDay {
  key: string;
  minutes: number;
  charged: boolean;
  today: boolean;
  future: boolean;
}
export interface ChargeWeek {
  key: string;
  days: WeekDay[];
  count: number;
  done: boolean;
  minutes: number;
}

export function chargeWeek(byDay: Map<string, number>, now: number): ChargeWeek {
  const today = dayKey(now);
  const days = weekDays(now).map((key) => {
    const minutes = byDay.get(key) ?? 0;
    return { key, minutes, charged: minutes >= CHARGE_DAY_MIN, today: key === today, future: key > today };
  });
  const count = days.filter((d) => d.charged).length;
  return { key: weekKey(now), days, count, done: count >= WEEK_TARGET, minutes: days.reduce((a, d) => a + d.minutes, 0) };
}

/** Days in a row (ending today or yesterday) with at least CHARGE_DAY_MIN. Shown gently, never as a threat. */
export function dayRun(byDay: Map<string, number>, now: number): number {
  let key = dayKey(now);
  if ((byDay.get(key) ?? 0) < CHARGE_DAY_MIN) key = addDays(key, -1);
  let n = 0;
  while ((byDay.get(key) ?? 0) >= CHARGE_DAY_MIN) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

/* ---------- weekly boss ---------- */
export function bossGoal(dailyGoal: number): number {
  return Math.max(60, Math.round((dailyGoal * 5) / 15) * 15);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The boss of a week: a costume ghost, preferring one you do not own yet,
 * and never the ghost you are charging with sparks (unless it is the only one left).
 */
export function pickBoss(week: string, ownedGhosts: ReadonlySet<string>, charging: string | null = null): string {
  const fresh = COSTUME_GHOSTS.filter((g) => !ownedGhosts.has(g.id));
  const notCharging = fresh.filter((g) => g.id !== charging);
  const from = notCharging.length ? notCharging : fresh.length ? fresh : COSTUME_GHOSTS;
  return from[hash(week) % from.length].id;
}

/* ---------- achievements ---------- */
export type AchievementKind = 'sessions' | 'days' | 'goal' | 'drops' | 'hours' | 'weeks' | 'costumes' | 'bond';
export interface Achievement {
  id: string;
  kind: AchievementKind;
  target: number;
  /** Wish energy it brings. */
  energy: number;
  icon: string;
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', kind: 'sessions', target: 1, energy: 20, icon: 'bolt' },
  { id: 'days3', kind: 'days', target: 3, energy: 30, icon: 'calendar' },
  { id: 'goal1', kind: 'goal', target: 1, energy: 30, icon: 'check' },
  { id: 'sessions5', kind: 'sessions', target: 5, energy: 30, icon: 'clock' },
  { id: 'drops10', kind: 'drops', target: 10, energy: 50, icon: 'gift' },
  { id: 'hours10', kind: 'hours', target: 10, energy: 60, icon: 'flame' },
  { id: 'week1', kind: 'weeks', target: 1, energy: 80, icon: 'star' },
  { id: 'costume1', kind: 'costumes', target: 1, energy: 50, icon: 'ghost' },
  { id: 'friend1', kind: 'bond', target: 2, energy: 40, icon: 'heart' },
  { id: 'hours25', kind: 'hours', target: 25, energy: 100, icon: 'flame' },
  { id: 'hours50', kind: 'hours', target: 50, energy: 150, icon: 'crown' },
  { id: 'kindred1', kind: 'bond', target: 4, energy: 150, icon: 'heart' },
];

export interface Counters {
  sessions: number;
  days: number;
  goalDays: number;
  drops: number;
  minutes: number;
  weeks: number;
  /** Costume ghosts you own. */
  costumes: number;
  /** The highest bond stage with any ghost (0..4). */
  bond?: number;
}

export function achievementValue(a: Achievement, c: Counters): number {
  switch (a.kind) {
    case 'sessions':
      return c.sessions;
    case 'days':
      return c.days;
    case 'goal':
      return c.goalDays;
    case 'drops':
      return c.drops;
    case 'hours':
      return c.minutes / 60;
    case 'weeks':
      return c.weeks;
    case 'costumes':
      return c.costumes;
    case 'bond':
      return c.bond ?? 0;
  }
}

/** Achievements that are reached but not yet granted. */
export function dueAchievements(c: Counters, have: Readonly<Record<string, number>>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !have[a.id] && achievementValue(a, c) >= a.target);
}
