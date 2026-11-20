/** Sound and vibration for gestures on a ghost (a tap keeps its own poke sound on each screen). */
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import type { Gesture } from '../rig/gestures';

let lastBeat = 0;
export function gestureFx(g: Gesture) {
  if (g.kind === 'strokeStart') sfx.purr(true);
  else if (g.kind === 'strokeEnd') sfx.purr(false);
  else if (g.kind === 'stroke') {
    const n = performance.now();
    if (n - lastBeat > 170) {
      lastBeat = n;
      haptic.purr();
    }
  } else if (g.kind === 'holdStart') {
    sfx.squeak();
    haptic.press();
  } else if (g.kind === 'holdEnd') {
    sfx.pop();
    haptic.tap();
  } else if (g.kind === 'tickle') {
    sfx.giggle();
    haptic.tickle();
  }
}
