// The clocks of this zone are turned back on 25 October 2026 and forward on 29 March 2026.
process.env.TZ = 'Europe/Berlin';

import { describe, expect, it } from 'vitest';
import { DAY, addDays, lastWeeks, parseDay, weekKey } from '../src/logic/time';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('the last weeks of the trend', () => {
  it('are twelve different Mondays, a week apart, ending with this week', () => {
    // every hour of days around both clock changes, and of an ordinary day
    for (const [y, m, d] of [[2026, 11, 22], [2026, 10, 26], [2026, 10, 25], [2026, 4, 5], [2026, 3, 29], [2026, 7, 15]]) {
      for (let h = 0; h < 24; h++) {
        const ms = at(y, m, d, h, 45);
        const weeks = lastWeeks(ms, 12);
        const where = `${y}-${m}-${d} ${h}:45`;
        expect(weeks.length, where).toBe(12);
        expect(new Set(weeks).size, where).toBe(12);
        expect(weeks[11], where).toBe(weekKey(ms));
        weeks.forEach((w, i) => {
          expect(parseDay(w).getDay(), where).toBe(1);
          if (i) expect(w, where).toBe(addDays(weeks[i - 1], 7));
        });
      }
    }
  });

  it('do not double a week late in the evening after the clocks were turned back', () => {
    // 22 November, 23:45: five weeks earlier in hours is 19 October, 00:45 by the clock, already a Monday
    const ms = at(2026, 11, 22, 23, 45);
    if (new Date(ms - 5 * 7 * DAY).getHours() === 0) {
      // this is the zone the fault showed in: counting in hours gave the same Monday twice
      const byHours = Array.from({ length: 12 }, (_, i) => weekKey(ms - (11 - i) * 7 * DAY));
      expect(new Set(byHours).size).toBe(11);
    }
    expect(lastWeeks(ms, 12)).toContain('2026-10-12');
    expect(lastWeeks(ms, 12).filter((w) => w === '2026-10-19').length).toBe(1);
  });
});
