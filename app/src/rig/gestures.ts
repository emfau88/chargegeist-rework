/**
 * Turns raw pointer input on a ghost into gestures: tap, tickle (quick taps in a row), hold and stroke.
 * Pure and clock-free (times come in as milliseconds), so it can be tested without a browser.
 *
 * On touch screens a vertical swipe belongs to the page (it scrolls). The browser then cancels the
 * pointer; until a touch moves sideways enough it is only "pending" and never starts a stroke.
 */
export type Gesture =
  | { kind: 'tap' }
  | { kind: 'tickle'; n: number }
  | { kind: 'holdStart' }
  | { kind: 'holdEnd'; ms: number }
  | { kind: 'strokeStart' }
  | { kind: 'stroke'; dx: number; dy: number; dist: number }
  | { kind: 'strokeEnd'; dist: number; ms: number };

export const GESTURE = {
  /** Movement (px) that still counts as holding still. */
  slop: 10,
  /** Holding still this long (ms) is a hold. */
  holdMs: 450,
  /** Taps closer than this (ms) form a chain; the third one in a chain tickles. */
  tickleGap: 400,
  tickleTaps: 3,
  /** A touch that starts mostly vertical needs this much sideways travel (px) to become a stroke. */
  touchSide: 24,
};

type St = 'idle' | 'down' | 'pending' | 'stroke' | 'hold';

export class GestureTracker {
  private st: St = 'idle';
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  private lx = 0;
  private ly = 0;
  private dist = 0;
  private touch = false;
  private chain = 0;
  private lastTap = -1e9;

  get active() {
    return this.st !== 'idle';
  }
  get stroking() {
    return this.st === 'stroke';
  }
  get holding() {
    return this.st === 'hold';
  }

  down(x: number, y: number, t: number, touch = false): Gesture[] {
    const out = this.st === 'idle' ? [] : this.cancel(t);
    this.st = 'down';
    this.x0 = this.lx = x;
    this.y0 = this.ly = y;
    this.t0 = t;
    this.dist = 0;
    this.touch = touch;
    return out;
  }

  move(x: number, y: number, _t: number): Gesture[] {
    const dx = x - this.lx,
      dy = y - this.ly;
    this.lx = x;
    this.ly = y;
    if (this.st === 'down' || this.st === 'pending') {
      const ox = x - this.x0,
        oy = y - this.y0;
      if (Math.hypot(ox, oy) < GESTURE.slop) return [];
      // a touch that heads up or down is most likely the page scrolling: wait for sideways travel
      if (this.touch && Math.abs(ox) < GESTURE.touchSide && Math.abs(oy) > Math.abs(ox) * 1.5) {
        this.st = 'pending';
        return [];
      }
      this.st = 'stroke';
      this.dist = Math.hypot(ox, oy);
      return [{ kind: 'strokeStart' }, { kind: 'stroke', dx: ox, dy: oy, dist: this.dist }];
    }
    if (this.st === 'stroke') {
      this.dist += Math.hypot(dx, dy);
      return [{ kind: 'stroke', dx, dy, dist: this.dist }];
    }
    return [];
  }

  /** Call every frame: turns a still press into a hold. */
  update(t: number): Gesture[] {
    if (this.st === 'down' && t - this.t0 >= GESTURE.holdMs) {
      this.st = 'hold';
      this.chain = 0;
      return [{ kind: 'holdStart' }];
    }
    return [];
  }

  up(t: number): Gesture[] {
    const st = this.st;
    this.st = 'idle';
    if (st === 'stroke') {
      this.chain = 0;
      return [{ kind: 'strokeEnd', dist: this.dist, ms: t - this.t0 }];
    }
    if (st === 'hold') return [{ kind: 'holdEnd', ms: t - this.t0 }];
    if (st !== 'down') return [];
    // a tap; quick taps in a row turn into tickling
    this.chain = t - this.lastTap <= GESTURE.tickleGap ? this.chain + 1 : 1;
    this.lastTap = t;
    return this.chain >= GESTURE.tickleTaps ? [{ kind: 'tickle', n: this.chain - GESTURE.tickleTaps + 1 }] : [{ kind: 'tap' }];
  }

  /** The browser took the pointer (usually to scroll) or it left the window. */
  cancel(t: number): Gesture[] {
    const st = this.st;
    this.st = 'idle';
    if (st === 'stroke') return [{ kind: 'strokeEnd', dist: this.dist, ms: t - this.t0 }];
    if (st === 'hold') return [{ kind: 'holdEnd', ms: t - this.t0 }];
    return [];
  }
}
