import { useEffect, useState } from 'preact/hooks';
import {
  BOSS_DUPE_ENERGY,
  COMPANION_UNLOCK_HOURS,
  DUPE_ENERGY,
  WISH_COST,
  canWear,
  ghost,
  item,
  unlockOrder,
} from '../data/catalog';
import type { Outfit } from '../data/rigTypes';
import { nameOf } from '../i18n';
import { rollDrop } from '../logic/drops';
import type { Pity } from '../logic/drops';
import {
  CHARGE_DAY_MIN,
  bossGoal,
  chargeWeek,
  completeSets,
  dueAchievements,
  minutesByDay,
  pickBoss,
  setProgress,
  totalMinutes,
} from '../logic/progress';
import type { Counters, SessionRec } from '../logic/progress';
import { DAY, dayKey, weekKey } from '../logic/time';

export type Lang = 'auto' | 'en' | 'de';
export type AmbientId = 'off' | 'rain' | 'brown' | 'fire' | 'forest' | 'ocean' | 'cafe';
export type ThemeId = 'night' | 'cozynight' | 'forestglow' | 'cottonsky' | 'mysticpurple' | 'aurora' | 'dusk';
export type Via = 'start' | 'hours' | 'drop' | 'wish' | 'boss' | 'set';
export type TagId = 'study' | 'work' | 'create' | 'read' | 'home' | 'other';
export const TAGS: TagId[] = ['study', 'work', 'create', 'read', 'home', 'other'];

export interface OwnedRec {
  at: number;
  via: Via;
  seen: boolean;
}
export type { Outfit };
export interface PendingDrop {
  id: string;
  kind: 'first' | 'daily' | 'week';
  at: number;
  cards: string[] | null;
}
export interface ActiveSession {
  id: string;
  startedAt: number;
  planned: number;
  tag: TagId;
  pausedMs: number;
  pausedAt: number | null;
  trial: boolean;
  /** Focus minutes per real minute (60 in demo speed). */
  speed: number;
}
export interface Settings {
  sound: boolean;
  haptics: boolean;
  ambient: AmbientId;
  volume: number;
  reminder: boolean;
  reminderTime: string;
  theme: ThemeId;
  keepAwake: boolean;
  breakOffer: boolean;
  showWeek: boolean;
  lang: Lang;
}
export interface State {
  v: 2;
  onboarded: boolean;
  createdAt: number;
  /** The active ghost: any ghost you own can charge with you. */
  companion: string;
  firstCompanion: string;
  ghosts: Record<string, OwnedRec>;
  items: Record<string, OwnedRec>;
  outfits: Record<string, Outfit>;
  /** Achievement id -> when it was reached. */
  achievements: Record<string, number>;
  names: Record<string, string>;
  goal: number;
  tags: TagId[];
  lastTag: TagId;
  lastDuration: number;
  sessions: SessionRec[];
  pending: PendingDrop[];
  dailyDropDay: string | null;
  weekDropWeeks: string[];
  goalDays: string[];
  dropsOpened: number;
  pity: Pity;
  wish: { target: string | null; energy: number };
  boss: { week: string; ghost: string; goal: number; done: boolean } | null;
  active: ActiveSession | null;
  settings: Settings;
  plus: boolean;
  plusOfferSeen: boolean;
  dev: { speed: boolean; dayOffset: number };
}

const KEY = 'chargegeist.v2';

export function defaultState(): State {
  return {
    v: 2,
    onboarded: false,
    createdAt: Date.now(),
    companion: 'volti',
    firstCompanion: 'volti',
    ghosts: { volti: { at: Date.now(), via: 'start', seen: true } },
    items: {},
    outfits: {},
    achievements: {},
    names: {},
    goal: 30,
    tags: ['study', 'work'],
    lastTag: 'study',
    lastDuration: 25,
    sessions: [],
    pending: [],
    dailyDropDay: null,
    weekDropWeeks: [],
    goalDays: [],
    dropsOpened: 0,
    pity: { sinceRare: 0, sinceEpic: 0 },
    wish: { target: null, energy: 0 },
    boss: null,
    active: null,
    settings: {
      sound: true,
      haptics: true,
      ambient: 'off',
      volume: 0.6,
      reminder: false,
      reminderTime: '19:00',
      theme: 'night',
      keepAwake: true,
      breakOffer: true,
      showWeek: true,
      lang: 'auto',
    },
    plus: false,
    plusOfferSeen: false,
    dev: { speed: false, dayOffset: 0 },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw) as State;
    if (s.v !== 2) return defaultState();
    const d = defaultState();
    return { ...d, ...s, settings: { ...d.settings, ...s.settings }, dev: { ...d.dev, ...s.dev } };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const subs = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the session keeps working in memory */
  }
}

export function getState(): State {
  return state;
}

export function mutate(fn: (s: State) => void) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  save();
  subs.forEach((f) => f());
}

export function useAppState(): State {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return state;
}

/** Current time, shifted by the prototype's "skip a day" tool. */
export function now(): number {
  return Date.now() + state.dev.dayOffset * DAY;
}

const rid = () => Math.random().toString(36).slice(2, 10);

/* ---------- selectors ---------- */
export function ownedGhosts(s: State = state): Set<string> {
  return new Set(Object.keys(s.ghosts));
}
export function ownedItems(s: State = state): Set<string> {
  return new Set(Object.keys(s.items));
}
/** What a ghost wears right now (empty for costume ghosts). */
export function outfitOf(s: State, id: string): Outfit {
  return canWear(id) ? (s.outfits[id] ?? {}) : {};
}
export function todayMinutes(s: State = state): number {
  const d = dayKey(now());
  return s.sessions.filter((x) => x.day === d).reduce((a, x) => a + x.min, 0);
}
export function companionName(s: State = state, id = s.companion): string {
  return s.names[id] ?? nameOf(ghost(id));
}
export function counters(s: State): Counters {
  const byDay = minutesByDay(s.sessions);
  return {
    sessions: s.sessions.length,
    days: [...byDay.values()].filter((m) => m >= CHARGE_DAY_MIN).length,
    goalDays: s.goalDays.length,
    drops: s.dropsOpened,
    minutes: totalMinutes(s.sessions),
    weeks: s.weekDropWeeks.length,
    sets: completeSets(ownedItems(s)).length,
  };
}
export function currentBoss(s: State = state) {
  const wk = weekKey(now());
  if (s.boss && s.boss.week === wk) return s.boss;
  return { week: wk, ghost: pickBoss(wk, ownedGhosts(s)), goal: bossGoal(s.goal), done: false };
}
export function dailyDropOpen(s: State = state): boolean {
  return s.dailyDropDay !== dayKey(now());
}
/** The companion that tries on new pieces: the active one if it can wear, else the first one you picked. */
export function dresser(s: State = state): string {
  return canWear(s.companion) ? s.companion : s.firstCompanion;
}

/* ---------- internal helpers (run inside mutate) ---------- */
function ownGhost(s: State, id: string, via: Via) {
  if (!s.ghosts[id]) s.ghosts[id] = { at: now(), via, seen: false };
}
function ensureBoss(s: State) {
  const b = currentBoss(s);
  if (!s.boss || s.boss.week !== b.week) s.boss = { ...b };
}
/** Grants every achievement that is due and adds its wish energy. */
function grantAchievements(s: State): string[] {
  const got: string[] = [];
  for (const a of dueAchievements(counters(s), s.achievements)) {
    s.achievements[a.id] = now();
    s.wish.energy += a.energy;
    got.push(a.id);
  }
  return got;
}
function grantCompanions(s: State): string[] {
  const hours = totalMinutes(s.sessions) / 60;
  const order = unlockOrder(s.firstCompanion);
  const got: string[] = [];
  order.forEach((id, i) => {
    if (hours >= COMPANION_UNLOCK_HOURS[i] && !s.ghosts[id]) {
      ownGhost(s, id, 'hours');
      got.push(id);
    }
  });
  return got;
}
/** Adds a piece. A completed outfit brings its ghost. Returns the ghost that joined, if any. */
function ownItem(s: State, id: string, via: Via): string | null {
  if (!s.items[id]) s.items[id] = { at: now(), via, seen: false };
  const set = item(id).set;
  if (setProgress(set, ownedItems(s)).done && !s.ghosts[set]) {
    ownGhost(s, set, 'set');
    return set;
  }
  return null;
}

/* ---------- onboarding ---------- */
export function chooseCompanion(id: string, name: string) {
  mutate((s) => {
    s.companion = id;
    s.firstCompanion = id;
    s.ghosts = { [id]: { at: now(), via: 'start', seen: true } };
    s.names[id] = name.trim() || companionName(s, id);
  });
}

export function finishOnboarding() {
  mutate((s) => {
    s.onboarded = true;
    ensureBoss(s);
  });
}

/* ---------- sessions ---------- */
export function startSession(planned: number, tag: TagId, trial = false) {
  mutate((s) => {
    s.active = {
      id: rid(),
      startedAt: now(),
      planned,
      tag,
      pausedMs: 0,
      pausedAt: null,
      trial,
      speed: s.dev.speed ? 60 : 1,
    };
    if (!trial) {
      s.lastDuration = planned;
      s.lastTag = tag;
    }
  });
}

export function elapsedMin(a: ActiveSession, t = now()): number {
  const end = a.pausedAt ?? t;
  return (Math.max(0, end - a.startedAt - a.pausedMs) / 60000) * a.speed;
}

export function pauseSession() {
  mutate((s) => {
    if (s.active && s.active.pausedAt === null) s.active.pausedAt = now();
  });
}
export function resumeSession() {
  mutate((s) => {
    if (s.active && s.active.pausedAt !== null) {
      s.active.pausedMs += now() - s.active.pausedAt;
      s.active.pausedAt = null;
    }
  });
}

export interface SessionResult {
  minutes: number;
  planned: number;
  completed: boolean;
  trial: boolean;
  tag: TagId;
  todayBefore: number;
  todayAfter: number;
  goal: number;
  goalReachedNow: boolean;
  dailyDrop: boolean;
  weekDrop: boolean;
  firstDrop: boolean;
  weekCount: number;
  weekDoneNow: boolean;
  boss: { ghost: string; before: number; after: number; goal: number; calmedNow: boolean; wasOwned: boolean };
  wish: { before: number; after: number; target: string | null };
  achievements: string[];
  companionsUnlocked: string[];
}

function credit(s: State, min: number, planned: number, tag: TagId, completed: boolean, trial: boolean, at: number): SessionResult {
  ensureBoss(s);
  const t = now();
  const today = dayKey(t);
  const byDayBefore = minutesByDay(s.sessions);
  const todayBefore = byDayBefore.get(today) ?? 0;
  const weekBefore = chargeWeek(byDayBefore, t);
  const wishBefore = s.wish.energy;
  const boss = s.boss!;
  const bossBefore = weekBefore.minutes;

  s.sessions.push({ id: rid(), at, day: dayKey(at), min, planned, tag, done: completed });
  s.wish.energy += min;

  const byDay = minutesByDay(s.sessions);
  const todayAfter = byDay.get(today) ?? 0;
  const week = chargeWeek(byDay, t);

  let firstDrop = false,
    dailyDrop = false,
    weekDrop = false;
  if (trial) {
    s.pending.push({ id: rid(), kind: 'first', at: t, cards: null });
    firstDrop = true;
  } else if (todayAfter >= CHARGE_DAY_MIN && s.dailyDropDay !== today) {
    s.pending.push({ id: rid(), kind: 'daily', at: t, cards: null });
    s.dailyDropDay = today;
    dailyDrop = true;
  }
  const goalReachedNow = !trial && todayBefore < s.goal && todayAfter >= s.goal;
  if (goalReachedNow && !s.goalDays.includes(today)) s.goalDays.push(today);
  const weekDoneNow = week.done && !s.weekDropWeeks.includes(week.key);
  if (weekDoneNow) {
    s.weekDropWeeks.push(week.key);
    s.pending.push({ id: rid(), kind: 'week', at: t, cards: null });
    weekDrop = true;
  }

  const wasOwned = !!s.ghosts[boss.ghost];
  let calmedNow = false;
  if (!boss.done && week.minutes >= boss.goal) {
    boss.done = true;
    calmedNow = true;
    if (wasOwned) s.wish.energy += BOSS_DUPE_ENERGY;
    else ownGhost(s, boss.ghost, 'boss');
  }

  const achievements = grantAchievements(s);
  const companionsUnlocked = grantCompanions(s);
  return {
    minutes: min,
    planned,
    completed,
    trial,
    tag,
    todayBefore,
    todayAfter,
    goal: s.goal,
    goalReachedNow,
    dailyDrop,
    weekDrop,
    firstDrop,
    weekCount: week.count,
    weekDoneNow,
    boss: { ghost: boss.ghost, before: bossBefore, after: week.minutes, goal: boss.goal, calmedNow, wasOwned },
    wish: { before: wishBefore, after: s.wish.energy, target: s.wish.target },
    achievements,
    companionsUnlocked,
  };
}

/** Ends the running session. Whole minutes count, even when ended early. Returns null if under a minute. */
export function finishSession(): SessionResult | null {
  const a = state.active;
  if (!a) return null;
  const el = elapsedMin(a);
  const completed = el >= a.planned - 1e-6;
  const min = completed ? a.planned : Math.floor(el);
  let res: SessionResult | null = null;
  mutate((s) => {
    s.active = null;
    if (min < 1 && !(a.trial && completed)) return;
    res = credit(s, Math.max(min, 1), a.planned, a.tag, completed, a.trial, a.startedAt);
  });
  return res;
}

/** Skipping the trial session still opens the first drop. Returns its id. */
export function skipTrial(): string {
  const id = rid();
  mutate((s) => {
    s.active = null;
    if (!s.pending.some((p) => p.kind === 'first')) s.pending.push({ id, kind: 'first', at: now(), cards: null });
  });
  return state.pending.find((p) => p.kind === 'first')!.id;
}

export function discardSession() {
  mutate((s) => {
    s.active = null;
  });
}

/* ---------- drops ---------- */
export function revealDrop(id: string): string[] {
  const d = state.pending.find((p) => p.id === id);
  if (!d) return [];
  if (d.cards) return d.cards;
  const r = rollDrop(ownedItems(), state.pity, Math.random, { guarantee: d.kind === 'daily' ? undefined : 'rare' });
  mutate((s) => {
    const p = s.pending.find((x) => x.id === id)!;
    p.cards = r.cards;
    s.pity = r.pity;
  });
  return r.cards;
}

export interface KeepResult {
  item: string;
  dupe: boolean;
  energy: number;
  set: { have: number; total: number; done: boolean };
  /** The costume ghost that joined because its outfit is now complete. */
  ghostJoined: string | null;
  achievements: string[];
}
export function keepFromDrop(dropId: string, itemId: string): KeepResult {
  let res!: KeepResult;
  mutate((s) => {
    s.pending = s.pending.filter((p) => p.id !== dropId);
    s.dropsOpened += 1;
    const dupe = !!s.items[itemId];
    const energy = dupe ? DUPE_ENERGY[item(itemId).rarity] : 0;
    let ghostJoined: string | null = null;
    if (dupe) s.wish.energy += energy;
    else ghostJoined = ownItem(s, itemId, 'drop');
    if (s.wish.target && s.items[s.wish.target]) s.wish.target = null;
    const achievements = grantAchievements(s);
    res = { item: itemId, dupe, energy, set: setProgress(item(itemId).set, ownedItems(s)), ghostJoined, achievements };
  });
  return res;
}

/* ---------- wish ---------- */
export function setWish(id: string | null) {
  mutate((s) => {
    s.wish.target = id;
  });
}
export interface ClaimResult {
  item: string;
  ghostJoined: string | null;
  achievements: string[];
}
export function claimWish(): ClaimResult | null {
  const tgt = state.wish.target;
  if (!tgt || state.items[tgt]) return null;
  const cost = WISH_COST[item(tgt).rarity];
  if (state.wish.energy < cost) return null;
  let res: ClaimResult | null = null;
  mutate((s) => {
    s.wish.energy -= cost;
    const ghostJoined = ownItem(s, tgt, 'wish');
    s.wish.target = null;
    res = { item: tgt, ghostJoined, achievements: grantAchievements(s) };
  });
  return res;
}

/* ---------- wardrobe ---------- */
/** Puts a piece on a companion (one per spot), or takes it off when it is already worn. */
export function toggleItem(ghostId: string, itemId: string) {
  if (!canWear(ghostId) || !state.items[itemId]) return;
  mutate((s) => {
    const o = (s.outfits[ghostId] ??= {});
    const slot = item(itemId).slot;
    if (o[slot] === itemId) delete o[slot];
    else o[slot] = itemId;
  });
}
export function wearItem(ghostId: string, itemId: string) {
  if (!canWear(ghostId) || !state.items[itemId]) return;
  mutate((s) => {
    (s.outfits[ghostId] ??= {})[item(itemId).slot] = itemId;
  });
}
export function clearOutfit(ghostId: string) {
  mutate((s) => {
    s.outfits[ghostId] = {};
  });
}

/* ---------- misc ---------- */
export function markSeen(kind: 'ghosts' | 'items', ids: string[]) {
  if (!ids.some((id) => state[kind][id] && !state[kind][id].seen)) return;
  mutate((s) => {
    for (const id of ids) if (s[kind][id]) s[kind][id].seen = true;
  });
}
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  mutate((s) => {
    s.settings[k] = v;
  });
}
export function setActiveCompanion(id: string) {
  mutate((s) => {
    if (s.ghosts[id]) s.companion = id;
  });
}
export function renameCompanion(id: string, name: string) {
  mutate((s) => {
    if (name.trim()) s.names[id] = name.trim().slice(0, 16);
  });
}
export function setGoal(min: number) {
  mutate((s) => {
    s.goal = min;
    if (s.boss && !s.boss.done) s.boss.goal = bossGoal(min);
  });
}
export function setTags(tags: TagId[]) {
  mutate((s) => {
    s.tags = tags.length ? tags : ['other'];
    if (!s.tags.includes(s.lastTag)) s.lastTag = s.tags[0];
  });
}
export function setPlus(v: boolean) {
  mutate((s) => {
    s.plus = v;
  });
}
export function markPlusOfferSeen() {
  mutate((s) => {
    s.plusOfferSeen = true;
  });
}

/* ---------- prototype tools ---------- */
export const dev = {
  setSpeed(v: boolean) {
    mutate((s) => {
      s.dev.speed = v;
    });
  },
  addMinutes(n: number): SessionResult {
    let res!: SessionResult;
    mutate((s) => {
      res = credit(s, n, n, s.lastTag, true, false, now());
    });
    return res;
  },
  nextDay() {
    mutate((s) => {
      s.dev.dayOffset += 1;
    });
  },
  grantDrop() {
    mutate((s) => {
      s.pending.push({ id: rid(), kind: 'daily', at: now(), cards: null });
    });
  },
  /** Every piece and every ghost, to try the wardrobe. */
  unlockAll(itemIds: string[], ghostIds: string[]) {
    mutate((s) => {
      for (const id of itemIds) if (!s.items[id]) s.items[id] = { at: now(), via: 'drop', seen: true };
      for (const id of ghostIds) if (!s.ghosts[id]) s.ghosts[id] = { at: now(), via: 'set', seen: true };
    });
  },
  reset() {
    localStorage.removeItem(KEY);
    state = defaultState();
    save();
    subs.forEach((f) => f());
  },
  replace(next: State) {
    state = next;
    save();
    subs.forEach((f) => f());
  },
};
