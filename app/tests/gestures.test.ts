import { describe, expect, it } from 'vitest';
import { GESTURE, GestureTracker } from '../src/rig/gestures';
import type { Gesture } from '../src/rig/gestures';

const kinds = (gs: Gesture[]) => gs.map((g) => g.kind);

describe('gestures', () => {
  it('a short still press is a tap', () => {
    const g = new GestureTracker();
    g.down(100, 100, 0);
    g.move(103, 102, 60);
    expect(g.update(120)).toEqual([]);
    expect(kinds(g.up(150))).toEqual(['tap']);
  });

  it('three quick taps tickle; slow taps stay taps', () => {
    const g = new GestureTracker();
    const tap = (t: number) => {
      g.down(100, 100, t);
      return kinds(g.up(t + 80));
    };
    expect(tap(0)).toEqual(['tap']);
    expect(tap(300)).toEqual(['tap']);
    expect(tap(600)).toEqual(['tickle']);
    expect(tap(900)).toEqual(['tickle']); // keeps tickling while the taps keep coming
    expect(tap(2000)).toEqual(['tap']); // a pause starts over
    expect(tap(3000)).toEqual(['tap']);
  });

  it('holding still becomes a hold that ends on release', () => {
    const g = new GestureTracker();
    g.down(50, 50, 0);
    expect(g.update(GESTURE.holdMs - 10)).toEqual([]);
    expect(kinds(g.update(GESTURE.holdMs + 5))).toEqual(['holdStart']);
    expect(g.holding).toBe(true);
    g.move(56, 53, 700); // a trembling finger stays a hold
    const end = g.up(1200);
    expect(end).toEqual([{ kind: 'holdEnd', ms: 1200 }]);
  });

  it('moving over the ghost strokes, and the distance adds up', () => {
    const g = new GestureTracker();
    g.down(100, 100, 0);
    expect(kinds(g.move(130, 104, 40))).toEqual(['strokeStart', 'stroke']);
    g.move(160, 100, 80);
    g.move(120, 98, 120);
    const end = g.up(400);
    expect(end[0].kind).toBe('strokeEnd');
    if (end[0].kind === 'strokeEnd') {
      expect(end[0].dist).toBeGreaterThan(95);
      expect(end[0].ms).toBe(400);
    }
    expect(g.update(1000)).toEqual([]); // no hold after a stroke
  });

  it('a mouse can stroke up and down too', () => {
    const g = new GestureTracker();
    g.down(100, 100, 0, false);
    expect(kinds(g.move(102, 140, 40))).toEqual(['strokeStart', 'stroke']);
  });

  it('a vertical touch swipe is left to the page to scroll', () => {
    const g = new GestureTracker();
    g.down(100, 300, 0, true);
    expect(g.move(102, 260, 30)).toEqual([]);
    expect(g.move(103, 200, 60)).toEqual([]);
    // the browser scrolls and cancels the pointer: nothing happened on the ghost
    expect(g.cancel(90)).toEqual([]);
    expect(g.update(1000)).toEqual([]);
  });

  it('a touch that turns sideways becomes a stroke after all', () => {
    const g = new GestureTracker();
    g.down(100, 100, 0, true);
    expect(g.move(103, 118, 30)).toEqual([]);
    expect(kinds(g.move(140, 120, 60))).toEqual(['strokeStart', 'stroke']);
  });

  it('a cancelled stroke or hold still ends cleanly', () => {
    const g = new GestureTracker();
    g.down(0, 0, 0);
    g.move(40, 0, 20);
    expect(kinds(g.cancel(50))).toEqual(['strokeEnd']);
    g.down(0, 0, 100);
    g.update(100 + GESTURE.holdMs);
    expect(kinds(g.cancel(900))).toEqual(['holdEnd']);
    expect(g.active).toBe(false);
  });
});
