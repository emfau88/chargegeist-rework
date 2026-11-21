/**
 * Where the land of the painted scene lies. A ghost that floats in front of the open sky says where its
 * shadow falls; the scene puts its clearing there, so the ghost has a place to be. Without such a
 * ghost on the screen the clearing sinks out of sight and only the hills stay, low and calm, behind
 * cards and buttons.
 */
import { SCENE } from '../data/scene.gen';

/** The row of the scene's canvas on which a ghost's shadow lies: just below the crest of the clearing. */
export const GROUND_LINE = SCENE.ground.mid + 26;
/** The scene is painted for a phone held upright. On a wider screen it keeps this width and repeats sideways. */
export const SCENE_MAX_W = 560;
/** At rest the valley between the hills lies this far above the bottom of the screen. */
export const REST_ABOVE_BOTTOM = 84;
/** How much of the page's scrolling each layer follows: the ground goes with the page, the land behind it lags. */
export const SCROLL_RATE = { far: 0.72, mid: 0.86, ground: 1 } as const;

type Listener = () => void;
let ground: number | null = null;
let owner: object | null = null;
const subs = new Set<Listener>();

/** A stage says where its ghost's shadow lies (pixels from the top of the page), or null when it leaves. */
export function setGround(who: object, y: number | null) {
  if (y === null) {
    // only the stage that set the ground may take it away again (a new screen mounts before the old one is gone)
    if (owner !== who) return;
    owner = null;
  } else owner = who;
  const next = y === null ? null : Math.round(y);
  if (next === ground) return;
  ground = next;
  for (const fn of subs) fn();
}
export function groundY(): number | null {
  return ground;
}
export function onGround(fn: Listener): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export interface ScenePlace {
  /** Screen pixels per pixel of the scene's canvas. */
  scale: number;
  /** Top edge of the canvas for the hills, in pixels from the top of the page. */
  top: number;
  /** Top edge of the canvas for the ground with its firs and lanterns. */
  groundTop: number;
  /** Width of one picture on the screen. */
  width: number;
}

/**
 * Where the scene hangs: scaled to the width of the screen, with its ground line on the ghost's shadow.
 * w, h: size of the screen; at: the shadow (from setGround) or null for the resting place, where the
 * hills lie low and the ground is below the screen.
 */
export function scenePlace(w: number, h: number, at: number | null): ScenePlace {
  const width = Math.max(240, Math.min(Number.isFinite(w) ? w : 390, SCENE_MAX_W));
  const scale = width / SCENE.w;
  if (at !== null) {
    const top = Math.round(at - GROUND_LINE * scale);
    return { scale, top, groundTop: top, width };
  }
  const bottom = Number.isFinite(h) ? h : 844;
  return {
    scale,
    top: Math.round(bottom - REST_ABOVE_BOTTOM - SCENE.mid.mid * scale),
    // its highest fir ends a little below the screen
    groundTop: Math.round(bottom + 24 - SCENE.ground.top * scale),
    width,
  };
}

/** What the day has lit in the scene so far. */
export interface SceneLit {
  /** The first lantern: there was focus today. */
  first: boolean;
  /** The second lantern: the daily goal is reached. */
  goal: boolean;
}
export function sceneLit(todayMin: number, goal: number): SceneLit {
  const m = Number.isFinite(todayMin) ? todayMin : 0;
  return { first: m > 0, goal: goal > 0 && m >= goal };
}

let staged: SceneLit | null = null;
const lightSubs = new Set<Listener>();
/**
 * A screen can light the lanterns itself, whatever the day has lit: the title screen does, as part of
 * its entrance. Null gives them back to the day.
 */
export function stageLights(l: SceneLit | null) {
  if (l === staged || (l && staged && l.first === staged.first && l.goal === staged.goal)) return;
  staged = l;
  for (const fn of lightSubs) fn();
}
export function stagedLights(): SceneLit | null {
  return staged;
}
export function onStagedLights(fn: Listener): () => void {
  lightSubs.add(fn);
  return () => lightSubs.delete(fn);
}
