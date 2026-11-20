import { useEffect, useState } from 'preact/hooks';
import {
  BOSS_DUPE_ENERGY,
  COMPANION_UNLOCK_HOURS,
  COSTUME_GHOSTS,
  DUPE_ENERGY,
  SPARK_ENERGY,
  STYLE_KINDS,
  WISH_COST,
  ghost,
  hasStyle,
  sparksNeeded,
  style,
  unlockOrder,
} from '../data/catalog';
import { nameOf } from '../i18n';
import { addFocus, addTouch, bondLevel, emptyBond, levelFor } from '../logic/bond';
import type { BondLevel, BondRec, BondTouch } from '../logic/bond';
import { rollDrop } from '../logic/drops';
import type { Pity } from '../logic/drops';
import {
  CHARGE_DAY_MIN,
  bossGoal,
  chargeWeek,
  dueAchievements,
  minutesByDay,
  pickBoss,
  totalMinutes,
} from '../logic/progress';
import type { Counters, SessionRec } from '../logic/progress';
import { DAY, dayKey, weekKey } from '../logic/time';

export type Lang = 'auto' | 'en' | 'de';
export type AmbientId = 'off' | 'rain' | 'brown' | 'fire' | 'forest' | 'ocean' | 'cafe';
export type ThemeId = 'night' | 'cozynight' | 'forestglow' | 'cottonsky' | 'mysticpurple' | 'aurora' | 'dusk';
export type Via = 'start' | 'hours' | 'drop' | 'wish' | 'boss' | 'spark';
export type TagId = 'study' | 'work' | 'create' | 'read' | 'home' | 'other';
export const TAGS: TagId[] = ['study', 'work', 'create', 'read', 'home', 'other'];

export interface OwnedRec {
  at: number;
  via: Via;
  seen: boolean;
}
/** The style a ghost shows: one per kind. */
export interface StyleLook {
  aura?: string;
  shimmer?: string;
  charm?: string;
}
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
  v: 3;
  onboarded: boolean;
  createdAt: number;
  /** The active ghost: any ghost you own can charge with you. */
  companion: string;
  firstCompanion: string;
  ghosts: Record<string, OwnedRec>;
  styles: Record<string, OwnedRec>;
  /** Ghost id -> the style it shows. */
  looks: Record<string, StyleLook>;
  /** Ghost sparks: the costume ghost you charge (null: the one furthest along), and the sparks each ghost has. */
  sparks: { target: string | null; have: Record<string, number> };
  /** Achievement id -> when it was reached. */
  achievements: Record<string, number>;
  /** Ghost id -> the bond with it (hearts and stage). */
  bonds: Record<string, BondRec>;
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

const KEY = 'chargegeist.v3';
const OLD_KEY = 'chargegeist.v2';

export function defaultState(): State {
  return {
    v: 3,
    onboarded: false,
    createdAt: Date.now(),
    companion: 'volti',
    firstCompanion: 'volti',
    ghosts: { volti: { at: Date.now(), via: 'start', seen: true } },
    styles: {},
    looks: {},
    sparks: { target: null, have: {} },
    achievements: {},
    bonds: {},
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

function fill(s: State): State {
  const d = defaultState();
  return { ...d, ...s, settings: { ...d.settings, ...s.settings }, dev: { ...d.dev, ...s.dev }, sparks: { ...d.sparks, ...s.sparks } };
}

/** v2 pieces by id prefix -> the costume ghost they belonged to. */
const OLD_PIECE_GHOST: Record<string, string> = {
  pumpkin: 'pumpkin',
  samurai: 'samurai',
  witch: 'witch',
  owl: 'owl',
  pirate: 'pirate',
  aviator: 'aviator',
  kitsune: 'kitsune',
  reaper: 'reaper',
  star: 'starmage',
  forest: 'forest',
};

/**
 * Turns a v2 save (costume pieces and outfits) into v3. Every piece you had becomes a spark for its
 * ghost (one short of a full charge at most), outfits are dropped, open drops are rolled again.
 */
export function migrateV2(old: any): State {
  const d = defaultState();
  const { items, outfits: _outfits, ...rest } = old;
  const s: State = fill({ ...d, ...rest, v: 3 });
  s.styles = {};
  s.looks = {};
  s.sparks = { target: null, have: {} };
  for (const id of Object.keys(items ?? {})) {
    const g = OLD_PIECE_GHOST[id.split('_')[0]];
    if (!g || s.ghosts[g]) continue;
    s.sparks.have[g] = Math.min(sparksNeeded(g) - 1, (s.sparks.have[g] ?? 0) + 1);
  }
  for (const r of Object.values(s.ghosts)) if ((r.via as string) === 'set') r.via = 'spark';
  if (s.achievements.outfit1) {
    s.achievements.costume1 = s.achievements.outfit1;
    delete s.achievements.outfit1;
  }
  s.wish = { target: null, energy: old.wish?.energy ?? 0 };
  s.pending = (s.pending ?? []).map((p) => ({ ...p, cards: null }));
  return s;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      return s.v === 3 ? fill(s) : defaultState();
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old);
      if (o?.v === 2) {
        const s = migrateV2(o);
        localStorage.setItem(KEY, JSON.stringify(s));
        localStorage.removeItem(OLD_KEY);
        return s;
      }
    }
  } catch {
    /* no storage (tests, private mode) or a broken save: start fresh */
  }
  return defaultState();
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
export function ownedStyles(s: State = state): Set<string> {
  return new Set(Object.keys(s.styles));
}
/** Whether this style can be used: owned, or a Plus style while Plus is active. */
export function canUseStyle(s: State, id: string): boolean {
  if (!hasStyle(id)) return false;
  return style(id).plus ? s.plus : !!s.styles[id];
}
/** The style a ghost shows right now. */
export function lookOf(s: State, id: string): StyleLook {
  const l = s.looks[id] ?? {};
  const out: StyleLook = {};
  for (const k of STYLE_KINDS) {
    const v = l[k];
    if (v && canUseStyle(s, v)) out[k] = v;
  }
  return out;
}
/** The costume ghost the next spark goes to: your pick, else the one furthest along. Null once all are yours. */
export function sparkTarget(s: State = state): string | null {
  const t = s.sparks.target;
  if (t && !s.ghosts[t] && sparksNeeded(t) > 0) return t;
  let best: string | null = null,
    bestF = -1;
  for (const g of COSTUME_GHOSTS) {
    if (s.ghosts[g.id]) continue;
    const f = (s.sparks.have[g.id] ?? 0) / sparksNeeded(g.id);
    if (f > bestF) {
      best = g.id;
      bestF = f;
    }
  }
  return best;
}
/** Sparks of a costume ghost: a ghost you own counts as fully charged. */
export function sparkInfo(s: State, id: string): { have: number; need: number } {
  const need = sparksNeeded(id);
  return { have: s.ghosts[id] ? need : Math.min(need, s.sparks.have[id] ?? 0), need };
}
export function todayMinutes(s: State = state): number {
  const d = dayKey(now());
  return s.sessions.filter((x) => x.day === d).reduce((a, x) => a + x.min, 0);
}
/** The bond with a ghost; an empty one for ghosts never touched (and for old saves). */
export function bondOf(s: State, id: string): BondRec {
  return { ...emptyBond(), ...s.bonds[id] };
}
/** Ghosts you own that reached a stage that was not celebrated yet. */
export function bondUps(s: State = state): string[] {
  return Object.keys(s.ghosts).filter((id) => {
    const b = bondOf(s, id);
    return levelFor(b.hearts) > b.seen;
  });
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
    costumes: COSTUME_GHOSTS.filter((g) => s.ghosts[g.id]).length,
    bond: Object.keys(s.ghosts).reduce((m, id) => Math.max(m, bondLevel(bondOf(s, id))), 0),
  };
}
export function currentBoss(s: State = state) {
  const wk = weekKey(now());
  if (s.boss && s.boss.week === wk) return s.boss;
  return { week: wk, ghost: pickBoss(wk, ownedGhosts(s), sparkTarget(s)), goal: bossGoal(s.goal), done: false };
}
export function dailyDropOpen(s: State = state): boolean {
  return s.dailyDropDay !== dayKey(now());
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
function ownStyle(s: State, id: string, via: Via) {
  if (!s.styles[id]) s.styles[id] = { at: now(), via, seen: false };
}

export interface SparkResult {
  /** The ghost the spark went to; null when every costume ghost is already yours. */
  ghost: string | null;
  have: number;
  need: number;
  /** The ghost joined with this spark. */
  joined: boolean;
  /** Wish energy instead of a spark, once every costume ghost is yours. */
  energy: number;
}
/** Every drop brings one ghost spark. Enough sparks bring the ghost. */
function addSpark(s: State): SparkResult {
  const g = sparkTarget(s);
  if (!g) {
    s.wish.energy += SPARK_ENERGY;
    return { ghost: null, have: 0, need: 0, joined: false, energy: SPARK_ENERGY };
  }
  const need = sparksNeeded(g);
  const have = (s.sparks.have[g] ?? 0) + 1;
  if (have >= need) {
    delete s.sparks.have[g];
    if (s.sparks.target === g) s.sparks.target = null;
    ownGhost(s, g, 'spark');
    return { ghost: g, have: need, need, joined: true, energy: 0 };
  }
  s.sparks.have[g] = have;
  return { ghost: g, have, need, joined: false, energy: 0 };
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
  /** sparkRefund: wish energy for sparks the boss ghost already had. */
  boss: { ghost: string; before: number; after: number; goal: number; calmedNow: boolean; wasOwned: boolean; sparkRefund: number };
  wish: { before: number; after: number; target: string | null };
  /** Hearts the companion got from this session. */
  bond: { ghost: string; gained: number; hearts: number; before: BondLevel; after: BondLevel };
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
  const bg = addFocus(bondOf(s, s.companion), min);
  s.bonds[s.companion] = bg.bond;

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
  let calmedNow = false,
    sparkRefund = 0;
  if (!boss.done && week.minutes >= boss.goal) {
    boss.done = true;
    calmedNow = true;
    if (wasOwned) s.wish.energy += BOSS_DUPE_ENERGY;
    else {
      ownGhost(s, boss.ghost, 'boss');
      sparkRefund = (s.sparks.have[boss.ghost] ?? 0) * SPARK_ENERGY;
      s.wish.energy += sparkRefund;
      delete s.sparks.have[boss.ghost];
    }
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
    boss: { ghost: boss.ghost, before: bossBefore, after: week.minutes, goal: boss.goal, calmedNow, wasOwned, sparkRefund },
    wish: { before: wishBefore, after: s.wish.energy, target: s.wish.target },
    bond: { ghost: s.companion, gained: bg.gained, hearts: bg.bond.hearts, before: bg.before, after: bg.after },
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
  const r = rollDrop(ownedStyles(), state.pity, Math.random, {
    guarantee: d.kind === 'daily' ? undefined : 'rare',
    kinds: d.kind === 'first' ? ['aura'] : undefined,
  });
  mutate((s) => {
    const p = s.pending.find((x) => x.id === id)!;
    p.cards = r.cards;
    s.pity = r.pity;
  });
  return r.cards;
}

export interface KeepResult {
  style: string;
  /** You had this style already: it turned into wish energy. */
  dupe: boolean;
  energy: number;
  /** The ghost spark this drop brought. */
  spark: SparkResult;
  achievements: string[];
}
/** Keeps one card of a drop and adds the drop's ghost spark. */
export function keepFromDrop(dropId: string, styleId: string): KeepResult {
  let res!: KeepResult;
  mutate((s) => {
    s.pending = s.pending.filter((p) => p.id !== dropId);
    s.dropsOpened += 1;
    const dupe = !!s.styles[styleId];
    const energy = dupe ? DUPE_ENERGY[style(styleId).rarity] : 0;
    if (dupe) s.wish.energy += energy;
    else ownStyle(s, styleId, 'drop');
    if (s.wish.target && s.styles[s.wish.target]) s.wish.target = null;
    const spark = addSpark(s);
    const achievements = grantAchievements(s);
    res = { style: styleId, dupe, energy, spark, achievements };
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
  style: string;
  achievements: string[];
}
export function claimWish(): ClaimResult | null {
  const tgt = state.wish.target;
  if (!tgt || !hasStyle(tgt) || style(tgt).plus || state.styles[tgt]) return null;
  const cost = WISH_COST[style(tgt).rarity];
  if (state.wish.energy < cost) return null;
  let res: ClaimResult | null = null;
  mutate((s) => {
    s.wish.energy -= cost;
    ownStyle(s, tgt, 'wish');
    s.wish.target = null;
    res = { style: tgt, achievements: grantAchievements(s) };
  });
  return res;
}

/* ---------- style and sparks ---------- */
/** Puts a style on a ghost (one per kind), or takes it off when it is already on. */
export function toggleStyle(ghostId: string, styleId: string) {
  if (!state.ghosts[ghostId] || !canUseStyle(state, styleId)) return;
  mutate((s) => {
    const l = (s.looks[ghostId] ??= {});
    const k = style(styleId).kind;
    if (l[k] === styleId) delete l[k];
    else l[k] = styleId;
  });
}
export function wearStyle(ghostId: string, styleId: string) {
  if (!state.ghosts[ghostId] || !canUseStyle(state, styleId)) return;
  mutate((s) => {
    (s.looks[ghostId] ??= {})[style(styleId).kind] = styleId;
  });
}
export function clearLook(ghostId: string) {
  mutate((s) => {
    s.looks[ghostId] = {};
  });
}
/** Picks the costume ghost the next sparks go to (null: the one furthest along). */
export function setSparkTarget(id: string | null) {
  mutate((s) => {
    s.sparks.target = id;
  });
}

/* ---------- bond ---------- */
export interface TouchResult {
  gained: number;
  hearts: number;
  before: BondLevel;
  after: BondLevel;
  achievements: string[];
}
/** A stroke, hold or tickle on a ghost you own: a heart, once per kind of touch a day. */
export function touchBond(id: string, kind: BondTouch): TouchResult | null {
  if (!state.ghosts[id]) return null;
  const g = addTouch(bondOf(state, id), kind, dayKey(now()));
  if (!g.gained) return null;
  let achievements: string[] = [];
  mutate((s) => {
    s.bonds[id] = g.bond;
    achievements = grantAchievements(s);
  });
  return { gained: g.gained, hearts: g.bond.hearts, before: g.before, after: g.after, achievements };
}
/** The level-up of this ghost was celebrated. */
export function ackBond(id: string) {
  mutate((s) => {
    const b = bondOf(s, id);
    s.bonds[id] = { ...b, seen: bondLevel(b) };
  });
}

/* ---------- misc ---------- */
export function markSeen(kind: 'ghosts' | 'styles', ids: string[]) {
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
  /** Adds hearts to a ghost's bond, to try the stages. */
  addHearts(id: string, n: number) {
    mutate((s) => {
      const b = bondOf(s, id);
      s.bonds[id] = { ...b, hearts: b.hearts + n };
      grantAchievements(s);
    });
  },
  grantDrop() {
    mutate((s) => {
      s.pending.push({ id: rid(), kind: 'daily', at: now(), cards: null });
    });
  },
  /** Every style and every ghost, to try them all. */
  unlockAll(styleIds: string[], ghostIds: string[]) {
    mutate((s) => {
      for (const id of styleIds) if (!s.styles[id] && !style(id).plus) s.styles[id] = { at: now(), via: 'drop', seen: true };
      for (const id of ghostIds) if (!s.ghosts[id]) s.ghosts[id] = { at: now(), via: 'spark', seen: true };
      s.sparks.have = {};
    });
  },
  reset() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
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
