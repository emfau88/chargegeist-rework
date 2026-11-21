/**
 * The eyes of a ghost: where the inside of an eye sits for a gaze, and where the lids are while it
 * closes. Pure, so the limits can be tested: the inside of an eye never leaves its rim.
 */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The highlights move this much of the way with the inside of the eye, so they nearly stay. */
export const GLINT_FOLLOW = 0.12;

/** A gaze as the eyes can show it: x and y from -1 to 1, never longer than 1. */
export function gazeOf(x: number, y: number): [number, number] {
  const gx = Number.isFinite(x) ? clamp(x, -1, 1) : 0,
    gy = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
  const len = Math.hypot(gx, gy);
  return len > 1 ? [gx / len, gy / len] : [gx, gy];
}

/**
 * How far the inside of an eye moves for a gaze, in pixels of the eye part. Never further than
 * `max` in any direction: sideways the full way, up and down a little less.
 */
export function pupilShift(x: number, y: number, max: number): [number, number] {
  const [gx, gy] = gazeOf(x, y);
  const m = Number.isFinite(max) ? Math.max(0, max) : 0;
  return [gx * m, gy * m * 0.8];
}

/**
 * The lids of an eye. top and bot: the upper and the lower edge at the middle of the eye, as a
 * share of its height (0 top, 1 bottom). bow: how far the edges move towards the corners
 * (positive: the corners hang lower, an arch; negative: they rise, a bowl).
 */
export interface Lids {
  top: number;
  bot: number;
  bow: number;
}

const ease = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Where the lids are for an eye that is shut by 0 (open) to 1 (closed). Open, both edges lie outside
 * the eye; they never cross. A blinking or sleeping eye closes from above with an arched lid; only
 * at the very end the lower lid comes up and both bend into the bowl of the closed eye, low in the
 * eye, where the picture of the closed eye takes over. A smiling eye closes from above and below
 * into an arch.
 */
export function lids(shut: number, smile: boolean): Lids {
  const c = Number.isFinite(shut) ? clamp(shut, 0, 1) : 0;
  if (smile) return { top: mix(-0.3, 0.2, c), bot: mix(1.3, 0.36, c), bow: mix(0.05, 0.4, c) };
  return { top: mix(-0.14, 0.69, c), bot: mix(1.3, 0.83, ease(0.45, 1, c)), bow: mix(0.1, -0.34, ease(0.7, 1, c)) };
}

/** A fixed pose for the eyes, set by the preview tools: gaze, how far shut, and whether they smile. */
export interface EyePose {
  x: number;
  y: number;
  shut: number;
  smile?: boolean;
  /** Draw the eyes as one flat picture each, as before the layers (to compare). */
  flat?: boolean;
}
let pose: EyePose | null = null;
export function setEyePose(p: EyePose | null) {
  pose = p;
}
export function eyePose(): EyePose | null {
  return pose;
}
