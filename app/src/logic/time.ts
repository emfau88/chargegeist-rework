export const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week that contains ms, as a day key. */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const wd = (d.getDay() + 6) % 7;
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd, 12).getTime());
}

/** The 7 day keys Monday..Sunday of the week that contains ms. */
export function weekDays(ms: number): string[] {
  const mon = parseDay(weekKey(ms));
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i, 12).getTime()));
}

export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** All day keys of the month that contains ms. */
export function monthDays(ms: number): string[] {
  const d = new Date(ms);
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => dayKey(new Date(d.getFullYear(), d.getMonth(), i + 1, 12).getTime()));
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12).getTime());
}

/** "1h 25m" style, or "25 min" under an hour. */
export function fmtMinutes(min: number, short = false): string {
  const m = Math.round(min);
  if (m < 60) return short ? `${m}m` : `${m} min`;
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}
