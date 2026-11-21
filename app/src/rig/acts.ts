/**
 * Little acts a ghost does on its own, and its reactions to what happens in the app.
 * An act is a pose over time: where he looks, what arms, mouth and lids do, how he stretches.
 * Pure, so every act can be tested: it starts and ends at rest and stays within what the rig can show.
 *
 * At rest, now and then: look up at the sun or moon, nudge the charm, stretch, a small twirl,
 * and a yawn when it is late. Reactions: a firm nod when a session starts, pride when the daily
 * goal is reached. A yawn also comes right before he falls asleep.
 */
export type ActName = 'moon' | 'charm' | 'stretch' | 'twirl' | 'yawn' | 'proud' | 'nod';

/** How long each act takes, in seconds. */
export const ACT_SECONDS: Record<ActName, number> = { moon: 2.8, charm: 1.7, stretch: 2.1, twirl: 0.9, yawn: 1.9, proud: 2.3, nod: 0.7 };
/** The acts he picks from at rest; the others are reactions. */
export const IDLE_ACTS: ActName[] = ['moon', 'charm', 'stretch', 'twirl', 'yawn'];
/** When the charm gets its push during the nudge, and when the sparkles of pride appear (seconds into the act). */
export const CHARM_PUSH_AT = 0.78;
export const PROUD_SPARKLE_AT = 0.35;

export interface ActPose {
  /** Where he looks, x and y from -1 to 1 (y up is negative). */
  look?: [number, number];
  /** Arm angles in degrees (positive raises the left arm, negative the right one). */
  armL?: number;
  armR?: number;
  mouth?: 'smile' | 'o' | 'line';
  /** Size of the mouth, 1 as usual. */
  mouthScale?: number;
  /** How far the eyes are shut, 0 to 1, and whether they close into a smile. */
  shut?: number;
  smile?: boolean;
  wide?: boolean;
  /** Height of the body, 1 as usual: above 1 he stretches, below he ducks. */
  squash?: number;
  /** Tilt in degrees, added to his usual lean. */
  lean?: number;
  /** A turn around his own axis, 0 to 1 for one full turn. */
  turn?: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 0 before a, 1 after b, smooth in between. */
const ease = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
/** Rises from 0 to 1 between a and b, stays, and falls back between c and d. */
const hold = (a: number, b: number, c: number, d: number, v: number) => ease(a, b, v) * (1 - ease(c, d, v));

/**
 * The pose of an act t seconds after it began; null once it is over (or for a time that is not a number).
 * light: where the sun or moon stands as seen from him (x right, y down, length 1), if there is a sky.
 */
export function actPose(name: ActName, t: number, light?: readonly [number, number] | null): ActPose | null {
  const T = ACT_SECONDS[name];
  if (!(t >= 0 && t < T)) return null;
  switch (name) {
    case 'moon': {
      // a long look up at the light in the sky, head tilted towards it
      const k = hold(0, 0.4, T - 0.55, T - 0.05, t);
      const [lx, ly] = light ?? [0, -1];
      return { look: [clamp(lx * 0.95, -1, 1) * k, clamp(ly * 1.1, -1, 0) * k], lean: lx * 5 * k, mouth: 'smile', wide: t > 0.25 && t < 0.8 };
    }
    case 'charm': {
      // he looks at his charm, lifts the arm on that side and gives it a little push
      const k = hold(0, 0.3, T - 0.5, T - 0.05, t);
      const reach = ease(0.15, 0.55, t) * (1 - ease(T - 0.55, T - 0.15, t));
      const poke = hold(CHARM_PUSH_AT - 0.1, CHARM_PUSH_AT, CHARM_PUSH_AT + 0.05, CHARM_PUSH_AT + 0.3, t);
      return { look: [-0.95 * k, -0.2 * k], armL: 72 * reach + 34 * poke, lean: -4 * k, mouth: 'smile', wide: poke > 0.5 };
    }
    case 'stretch': {
      // both arms up, tall and with eyes shut, then he sinks back with a small sigh
      const up = hold(0, 0.55, 1.2, 1.5, t);
      const sink = hold(1.35, 1.55, 1.6, 1.95, t);
      return { squash: 1 + 0.13 * up - 0.05 * sink, armL: 104 * up, armR: -104 * up, shut: up, mouth: up > 0.5 ? 'o' : 'smile', mouthScale: 1 + 0.15 * up, look: [0, -0.5 * up] };
    }
    case 'twirl': {
      // one turn around his own axis, with a hop; he lands smiling
      const turn = ease(0.05, 0.62, t);
      return { turn, armL: 40 * hold(0, 0.15, 0.55, 0.8, t), armR: -40 * hold(0, 0.15, 0.55, 0.8, t), mouth: 'smile', squash: 1 + 0.04 * hold(0.05, 0.3, 0.5, 0.7, t) };
    }
    case 'yawn': {
      // a deep breath, mouth wide, eyes squeezed shut, head back
      const k = hold(0.05, 0.6, 1.25, T - 0.1, t);
      return { mouth: 'o', mouthScale: 1 + 0.75 * k, shut: ease(0.1, 0.5, t) * (1 - ease(1.35, T - 0.05, t)), squash: 1 + 0.07 * k, lean: -5 * k, look: [0, -0.35 * k] };
    }
    case 'proud': {
      // chest out, hands on the hips, eyes closed in a smile
      const k = hold(0, 0.35, T - 0.6, T - 0.1, t);
      return { squash: 1 + 0.08 * k, lean: -4 * k, armL: -34 * k, armR: 34 * k, shut: k, smile: true, mouth: 'smile', mouthScale: 1 + 0.2 * k, look: [0, -0.3 * k] };
    }
    case 'nod': {
      // one firm nod: down and up again
      const k = Math.sin(Math.PI * clamp(t / 0.5, 0, 1));
      return { look: [0, 0.35 + 0.65 * k], squash: 1 - 0.07 * k, shut: 0.3 * k, mouth: 'line' };
    }
  }
}

/** What he can do right now. */
export interface ActRoom {
  /** There is a sky with a sun or moon to look at. */
  sky: boolean;
  /** He carries a charm. */
  charm: boolean;
  /** It is late: he may yawn. */
  tired: boolean;
}

/**
 * The next act at rest: one that is possible right now, and not the one he did last.
 * roll: a random number from 0 to 1.
 */
export function pickAct(room: ActRoom, last: ActName | null, roll: number): ActName | null {
  const can = IDLE_ACTS.filter((a) => (a !== 'moon' || room.sky) && (a !== 'charm' || room.charm) && (a !== 'yawn' || room.tired));
  const fresh = can.filter((a) => a !== last);
  const pool = fresh.length ? fresh : can;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(clamp(Number.isFinite(roll) ? roll : 0, 0, 1) * pool.length))] ?? null;
}

/** What he is doing, as far as it matters for an act. */
export interface ActState {
  mode: 'idle' | 'focus' | 'sleep';
  /** Something holds him already: a touch, a cheer, a glance, another act. */
  busy: boolean;
  /** Acts are switched off for this stage (the focus and break screens) or by reduced motion. */
  off: boolean;
}

/** Whether he may start an act of his own: only at rest. Never while he focuses or sleeps. */
export function mayAct(s: ActState): boolean {
  return s.mode === 'idle' && !s.busy && !s.off;
}

/* The preview tools can play an act on every ghost on screen, or freeze it at a moment. */
type Listener = (name: ActName | null, at?: number) => void;
const listeners = new Set<Listener>();
export function onPlayAct(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** name null ends a frozen act. at: freeze the act at this many seconds instead of playing it. */
export function playAct(name: ActName | null, at?: number) {
  for (const fn of listeners) fn(name, at);
}
