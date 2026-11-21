import { describe, expect, it } from 'vitest';
import { COMPANIONS, COSTUME_GHOSTS, DROP_STYLES, GHOSTS, ODDS, POOL_BY_RARITY, STYLES, ghost, rarityRank, sparksNeeded, style, stylesOf } from '../src/data/catalog';
import { RIGS } from '../src/data/rigs.gen';
import { CARDS_PER_DROP, PITY_EPIC, PITY_RARE, mulberry32, rollDrop, rollRarity } from '../src/logic/drops';
import type { Pity } from '../src/logic/drops';
import { ACHIEVEMENTS, CHARGE_DAY_MIN, bossGoal, chargeWeek, dayRun, dueAchievements, minutesByDay, pickBoss } from '../src/logic/progress';
import type { SessionRec } from '../src/logic/progress';
import { addDays, dayKey, fmtClock, fmtMinutes, weekDays, weekKey } from '../src/logic/time';

describe('catalog', () => {
  it('has 6 companions and 16 costume ghosts, each with a rig', () => {
    expect(COMPANIONS).toHaveLength(6);
    expect(COSTUME_GHOSTS).toHaveLength(16);
    expect(GHOSTS).toHaveLength(22);
    expect(new Set(GHOSTS.map((g) => g.id)).size).toBe(22);
    expect(COMPANIONS.filter((c) => c.starter).map((c) => c.id)).toEqual(['volti', 'ember', 'luna']);
    for (const g of GHOSTS) expect(RIGS[g.id]).toBeTruthy();
  });
  it('costume ghosts need 3 sparks when epic and 5 when mythic, companions none', () => {
    for (const g of COSTUME_GHOSTS) expect(sparksNeeded(g.id)).toBe(g.rarity === 'mythic' ? 5 : 3);
    for (const g of COMPANIONS) expect(sparksNeeded(g.id)).toBe(0);
  });
  it('has 10 auras, 9 shimmers and 10 charms with unique ids; the Plus shimmer never drops', () => {
    expect(stylesOf('aura')).toHaveLength(10);
    expect(stylesOf('shimmer')).toHaveLength(9);
    expect(stylesOf('charm')).toHaveLength(10);
    // charms come in every rarity, so they can show up in any drop
    expect(new Set(stylesOf('charm').map((x) => x.rarity))).toEqual(new Set(['common', 'rare', 'epic', 'mythic']));
    expect(DROP_STYLES.filter((x) => x.kind === 'charm')).toHaveLength(10);
    expect(new Set(STYLES.map((x) => x.id)).size).toBe(STYLES.length);
    for (const x of STYLES) expect(x.id.startsWith(`${x.kind}_`)).toBe(true);
    expect(STYLES.filter((x) => x.plus).map((x) => x.id)).toEqual(['shimmer_heart']);
    expect(DROP_STYLES.some((x) => x.plus)).toBe(false);
  });
  it('every rarity has enough styles for a full drop', () => {
    for (const list of Object.values(POOL_BY_RARITY)) expect(list.length).toBeGreaterThanOrEqual(CARDS_PER_DROP);
  });
});

describe('rarity odds', () => {
  it('matches the published odds over 100,000 cards', () => {
    const rng = mulberry32(42);
    const n = 100_000;
    const count = { common: 0, rare: 0, epic: 0, mythic: 0 };
    for (let i = 0; i < n; i++) count[rollRarity(rng)]++;
    for (const r of Object.keys(count) as (keyof typeof count)[]) {
      expect(Math.abs((count[r] / n) * 100 - ODDS[r])).toBeLessThan(0.6);
    }
  });
  it('respects a minimum rarity', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) expect(rarityRank(rollRarity(rng, 'epic'))).toBeGreaterThanOrEqual(2);
  });
});

describe('drops', () => {
  it('shows 3 different pieces per drop', () => {
    const rng = mulberry32(7);
    let pity: Pity = { sinceRare: 0, sinceEpic: 0 };
    for (let i = 0; i < 10_000; i++) {
      const r = rollDrop(new Set(), pity, rng);
      expect(new Set(r.cards).size).toBe(3);
      pity = r.pity;
    }
  });
  it('keeps the pity promise over 10,000 drops', () => {
    const rng = mulberry32(99);
    let pity: Pity = { sinceRare: 0, sinceEpic: 0 };
    let gapRare = 0,
      gapEpic = 0,
      maxRare = 0,
      maxEpic = 0;
    for (let i = 0; i < 10_000; i++) {
      const r = rollDrop(new Set(), pity, rng);
      pity = r.pity;
      const top = Math.max(...r.cards.map((c) => rarityRank(style(c).rarity)));
      gapRare = top >= 1 ? 0 : gapRare + 1;
      gapEpic = top >= 2 ? 0 : gapEpic + 1;
      maxRare = Math.max(maxRare, gapRare);
      maxEpic = Math.max(maxEpic, gapEpic);
    }
    // a gap of N-1 drops without means the N-th drop always has one
    expect(maxRare).toBeLessThanOrEqual(PITY_RARE - 1);
    expect(maxEpic).toBeLessThanOrEqual(PITY_EPIC - 1);
  });
  it('guarantees rare or better on the first drop', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 2000; i++) {
      const r = rollDrop(new Set(), { sinceRare: 0, sinceEpic: 0 }, rng, { guarantee: 'rare' });
      expect(Math.max(...r.cards.map((c) => rarityRank(style(c).rarity)))).toBeGreaterThanOrEqual(1);
    }
  });
  it('favours styles you do not own yet', () => {
    const rng = mulberry32(11);
    const owned = new Set(POOL_BY_RARITY.common.slice(0, 2).map((g) => g.id));
    let fresh = 0,
      commons = 0;
    for (let i = 0; i < 5000; i++) {
      for (const c of rollDrop(owned, { sinceRare: 0, sinceEpic: 0 }, rng).cards) {
        if (style(c).rarity !== 'common') continue;
        commons++;
        if (!owned.has(c)) fresh++;
      }
    }
    // 85 % preference plus the share of unowned styles among the rest
    expect(fresh / commons).toBeGreaterThan(0.85);
  });
  it('still fills a drop when everything is owned', () => {
    const rng = mulberry32(5);
    const all = new Set(DROP_STYLES.map((g) => g.id));
    for (let i = 0; i < 500; i++) expect(rollDrop(all, { sinceRare: 0, sinceEpic: 0 }, rng).cards).toHaveLength(3);
  });
  it('the first drop shows three different auras with a rare or better', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 2000; i++) {
      const r = rollDrop(new Set(), { sinceRare: 0, sinceEpic: 0 }, rng, { guarantee: 'rare', kinds: ['aura'] });
      expect(new Set(r.cards).size).toBe(3);
      for (const c of r.cards) expect(style(c).kind).toBe('aura');
      expect(Math.max(...r.cards.map((c) => rarityRank(style(c).rarity)))).toBeGreaterThanOrEqual(1);
    }
  });
  it('never offers a Plus style', () => {
    const rng = mulberry32(13);
    for (let i = 0; i < 3000; i++) for (const c of rollDrop(new Set(), { sinceRare: 0, sinceEpic: 0 }, rng).cards) expect(style(c).plus).toBe(false);
  });
});

describe('time', () => {
  it('weeks start on Monday', () => {
    const thu = new Date(2026, 10, 19, 15).getTime();
    expect(weekKey(thu)).toBe('2026-11-16');
    expect(weekDays(thu)[0]).toBe('2026-11-16');
    expect(weekDays(thu)[6]).toBe('2026-11-22');
    expect(weekKey(new Date(2026, 10, 22, 23).getTime())).toBe('2026-11-16');
    expect(weekKey(new Date(2026, 10, 23, 1).getTime())).toBe('2026-11-23');
  });
  it('adds days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('formats', () => {
    expect(fmtMinutes(25)).toBe('25 min');
    expect(fmtMinutes(85)).toBe('1h 25m');
    expect(fmtMinutes(120)).toBe('2h');
    expect(fmtClock(25 * 60)).toBe('25:00');
    expect(fmtClock(61.2)).toBe('01:02');
    expect(fmtClock(3725)).toBe('1:02:05');
  });
});

function sess(day: string, min: number): SessionRec {
  return { id: `${day}-${min}`, at: new Date(`${day}T10:00:00`).getTime(), day, min, planned: min, tag: 'study', done: true };
}

describe('charge week and runs', () => {
  const now = new Date(2026, 10, 20, 12).getTime(); // Friday
  it('counts days with at least 5 minutes', () => {
    const list = [sess('2026-11-16', 25), sess('2026-11-17', 4), sess('2026-11-18', 3), sess('2026-11-18', 2), sess('2026-11-20', 50), sess('2026-11-13', 60)];
    const w = chargeWeek(minutesByDay(list), now);
    expect(w.days.map((d) => d.charged)).toEqual([true, false, true, false, true, false, false]);
    expect(w.count).toBe(3);
    expect(w.done).toBe(false);
    expect(w.minutes).toBe(84);
    expect(w.days[4].today).toBe(true);
    expect(w.days[5].future).toBe(true);
  });
  it('is done at 5 of 7 days', () => {
    const list = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((d) => sess(d, CHARGE_DAY_MIN));
    expect(chargeWeek(minutesByDay(list), now).done).toBe(true);
  });
  it('counts a run that ended yesterday without punishing today', () => {
    const list = ['2026-11-17', '2026-11-18', '2026-11-19'].map((d) => sess(d, 10));
    expect(dayRun(minutesByDay(list), now)).toBe(3);
    expect(dayRun(minutesByDay([...list, sess('2026-11-20', 10)]), now)).toBe(4);
  });
});

describe('boss and achievements', () => {
  it('picks a costume ghost as boss, the same all week, preferring unowned', () => {
    const b = pickBoss('2026-11-16', new Set());
    expect(ghost(b).kind).toBe('costume');
    expect(pickBoss('2026-11-16', new Set())).toBe(b);
    expect(pickBoss('2026-11-16', new Set([b]))).not.toBe(b);
    const all = new Set(COSTUME_GHOSTS.map((g) => g.id));
    expect(ghost(pickBoss('2026-11-23', all)).kind).toBe('costume');
  });
  it('the boss is never the ghost you charge, unless it is the last one', () => {
    for (let w = 0; w < 60; w++) {
      const wk = `2027-01-${String(1 + (w % 28)).padStart(2, '0')}-${w}`;
      expect(pickBoss(wk, new Set(), 'kitsune')).not.toBe('kitsune');
    }
    const allButOwl = new Set(COSTUME_GHOSTS.map((g) => g.id).filter((id) => id !== 'owl'));
    expect(pickBoss('2026-11-16', allButOwl, 'owl')).toBe('owl');
  });
  it('scales the boss goal with the daily goal', () => {
    expect(bossGoal(30)).toBe(150);
    expect(bossGoal(15)).toBe(75);
    expect(bossGoal(5)).toBe(60);
  });
  it('grants achievements exactly at their thresholds', () => {
    const base = { sessions: 0, days: 0, goalDays: 0, drops: 0, minutes: 0, weeks: 0, costumes: 0 };
    expect(dueAchievements(base, {})).toEqual([]);
    expect(dueAchievements({ ...base, sessions: 1 }, {}).map((a) => a.id)).toEqual(['first']);
    expect(dueAchievements({ ...base, sessions: 5 }, { first: 1 }).map((a) => a.id)).toEqual(['sessions5']);
    expect(dueAchievements({ ...base, minutes: 600 }, {}).map((a) => a.id)).toContain('hours10');
    expect(dueAchievements({ ...base, minutes: 599 }, {}).map((a) => a.id)).not.toContain('hours10');
    expect(dueAchievements({ ...base, costumes: 1 }, {}).map((a) => a.id)).toEqual(['costume1']);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('dates are local days', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
