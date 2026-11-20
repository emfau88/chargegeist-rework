/**
 * Sound and vibration for gestures on a ghost (a tap keeps its own poke sound on each screen),
 * and the hearts a touch brings to the bond.
 */
import { t } from '../i18n';
import type { Key } from '../i18n';
import type { BondTouch } from '../logic/bond';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import type { Gesture } from '../rig/gestures';
import { companionName, getState, touchBond } from '../state/store';
import { toast } from './kit';

/** A stroke this long (ms) counts for the bond. */
const STROKE_HEART_MS = 1500;

let lastBeat = 0;
/** `bond` is the bond stage with the ghost: from Best Friend on, holding is a high five. */
export function gestureFx(g: Gesture, bond = 0) {
  if (g.kind === 'strokeStart') sfx.purr(true);
  else if (g.kind === 'strokeEnd') sfx.purr(false);
  else if (g.kind === 'stroke') {
    const n = performance.now();
    if (n - lastBeat > 170) {
      lastBeat = n;
      haptic.purr();
    }
  } else if (g.kind === 'holdStart') {
    if (bond >= 3) sfx.hello();
    else sfx.squeak();
    haptic.press();
  } else if (g.kind === 'holdEnd') {
    if (bond >= 3) {
      sfx.clap();
      haptic.success();
    } else {
      sfx.pop();
      haptic.tap();
    }
  } else if (g.kind === 'tickle') {
    sfx.giggle();
    haptic.tickle();
  }
}

/** The hug from the Friend stage on. */
export function hugFx() {
  sfx.hug();
  haptic.success();
}

/** A long stroke, a hold or a tickle brings a heart, once per kind a day and ghost. */
export function bondFromGesture(ghostId: string, g: Gesture) {
  const kind: BondTouch | null =
    g.kind === 'strokeEnd' && g.ms >= STROKE_HEART_MS ? 'stroke' : g.kind === 'holdEnd' ? 'hold' : g.kind === 'tickle' && g.n === 1 ? 'tickle' : null;
  if (!kind) return;
  const r = touchBond(ghostId, kind);
  if (!r) return;
  toast(t('bond_touch', { name: companionName(getState(), ghostId) }), { ghost: ghostId });
  r.achievements.forEach((a) => toast(`${t(`ach_${a}` as Key)} · ${t('done_achievement')}`, { icon: 'trophy' }));
}
