import { useEffect, useState } from 'preact/hooks';
import { GHOSTS, ghost } from '../data/catalog';
import { fmtDate, fmtNum, nameOf, t } from '../i18n';
import type { Key } from '../i18n';
import { ACHIEVEMENTS, WEEK_TARGET, achievementValue, chargeWeek, dayRun, minutesByDay, totalMinutes } from '../logic/progress';
import { DAY, dayKey, fmtMinutes, monthDays, parseDay, weekKey } from '../logic/time';
import { shareImage } from '../platform/device';
import { TAGS, counters, currentBoss, now, useAppState } from '../state/store';
import type { State } from '../state/store';
import { Bar, Btn, Icon, Sheet } from '../ui/kit';
import { Portrait } from '../ui/stage';
import { monthStats, renderRecap } from '../ui/recap';
import { WeekDots } from './Home';

function WeekChart({ s }: { s: State }) {
  const wk = chargeWeek(minutesByDay(s.sessions), now());
  const max = Math.max(s.goal, ...wk.days.map((d) => d.minutes)) * 1.15;
  const letters = t('wd').split(',');
  const W = 320,
    H = 150,
    base = 122,
    bw = 26;
  const gy = base - (s.goal / max) * 100;
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('prog_week')}>
      <line x1="8" x2={W - 8} y1={gy} y2={gy} class="goal-line" />
      <text x={W - 8} y={gy - 5} text-anchor="end" class="chart-note">
        {s.goal} {t('min')}
      </text>
      {wk.days.map((d, i) => {
        const x = 20 + i * ((W - 40) / 6) - bw / 2;
        const h = Math.max(d.minutes > 0 ? 5 : 2, (d.minutes / max) * 100);
        return (
          <g key={d.key}>
            <rect x={x} y={base - h} width={bw} height={h} rx="7" class={`cbar ${d.minutes >= s.goal ? 'full' : d.charged ? 'on' : ''} ${d.today ? 'today' : ''}`} />
            {d.minutes > 0 && (
              <text x={x + bw / 2} y={base - h - 6} text-anchor="middle" class="chart-val">
                {Math.round(d.minutes)}
              </text>
            )}
            <text x={x + bw / 2} y={base + 20} text-anchor="middle" class={`chart-lbl ${d.today ? 'today' : ''}`}>
              {letters[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthHeat({ s }: { s: State }) {
  const by = minutesByDay(s.sessions);
  const days = monthDays(now());
  const lead = (parseDay(days[0]).getDay() + 6) % 7;
  const today = dayKey(now());
  const letters = t('wd').split(',');
  return (
    <div class="heat">
      {letters.map((l, i) => (
        <span class="heat-lbl" key={`l${i}`}>
          {l}
        </span>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`e${i}`} />
      ))}
      {days.map((d) => {
        const m = by.get(d) ?? 0;
        const lvl = m === 0 ? 0 : m < s.goal / 2 ? 1 : m < s.goal ? 2 : 3;
        return (
          <span key={d} class={`heat-cell l${lvl} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`} title={`${d}: ${m} min`}>
            {parseDay(d).getDate()}
          </span>
        );
      })}
    </div>
  );
}

function TagSplit({ s }: { s: State }) {
  const by = new Map<string, number>();
  for (const x of s.sessions) by.set(x.tag, (by.get(x.tag) ?? 0) + x.min);
  const total = Math.max(1, totalMinutes(s.sessions));
  const rows = TAGS.map((tg) => [tg, by.get(tg) ?? 0] as const)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p class="muted small">—</p>;
  return (
    <div class="split">
      {rows.map(([tg, m]) => (
        <div class="split-row" key={tg}>
          <span>{t(`tag_${tg}`)}</span>
          <Bar value={m / total} thin color="var(--charge)" />
          <b>{fmtMinutes(m, true)}</b>
        </div>
      ))}
    </div>
  );
}

function HourChart({ s }: { s: State }) {
  const buckets = new Array(8).fill(0);
  for (const x of s.sessions) buckets[Math.floor(new Date(x.at).getHours() / 3)] += x.min;
  const max = Math.max(1, ...buckets);
  return (
    <div class="hours">
      {buckets.map((m, i) => (
        <div class="hour-col" key={i}>
          <span class="hour-bar" style={{ height: `${Math.max(4, (m / max) * 100)}%` }} />
          <small>{String(i * 3).padStart(2, '0')}</small>
        </div>
      ))}
    </div>
  );
}

function Trend({ s }: { s: State }) {
  const by = new Map<string, number>();
  for (const x of s.sessions) {
    const wk = weekKey(parseDay(x.day).getTime());
    by.set(wk, (by.get(wk) ?? 0) + x.min);
  }
  const weeks = Array.from({ length: 12 }, (_, i) => weekKey(now() - (11 - i) * 7 * DAY));
  const max = Math.max(60, ...weeks.map((w) => by.get(w) ?? 0));
  return (
    <div class="hours trend">
      {weeks.map((w, i) => (
        <div class="hour-col" key={w}>
          <span class={`hour-bar ${i === 11 ? 'now' : ''}`} style={{ height: `${Math.max(4, ((by.get(w) ?? 0) / max) * 100)}%` }} />
          <small>{i % 3 === 2 ? fmtDate(parseDay(w).getTime(), { day: 'numeric', month: 'numeric' }) : ''}</small>
        </div>
      ))}
    </div>
  );
}

function RecapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setUrl(null);
    renderRecap(s).then((cv) =>
      cv.toBlob((b) => {
        if (!live || !b) return;
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      }, 'image/png'),
    );
    return () => {
      live = false;
    };
  }, [open]);
  const m = monthStats(s);
  return (
    <Sheet open={open} onClose={onClose} title={t('prog_recap')}>
      <div class="recap-preview">{url ? <img src={url} alt={t('recap_title', { month: m.label })} /> : <span class="spinner" />}</div>
      <Btn kind="primary" big icon="share" disabled={!blob} onClick={() => blob && void shareImage(blob, `chargegeist-${m.label.toLowerCase()}.png`, t('recap_title', { month: m.label }))}>
        {t('prog_share')}
      </Btn>
    </Sheet>
  );
}

export function Progress({ openPlus }: { openPlus: () => void }) {
  const s = useAppState();
  const [recap, setRecap] = useState(false);
  const by = minutesByDay(s.sessions);
  const total = totalMinutes(s.sessions);
  const best = Math.max(0, ...by.values());
  const run = dayRun(by, now());
  const wk = chargeWeek(by, now());
  const boss = currentBoss(s);
  const ghostsOwned = Object.keys(s.ghosts).length;
  const c = counters(s);
  const achDone = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

  return (
    <div class="page progress">
      <header class="page-head">
        <h1>{t('prog_title')}</h1>
      </header>

      <div class="tiles4">
        <div class="stat">
          <Icon name="bolt" size={18} />
          <b>{fmtMinutes(total, true)}</b>
          <small>{t('prog_total')}</small>
        </div>
        <div class="stat">
          <Icon name="check" size={18} />
          <b>{fmtNum(s.sessions.length)}</b>
          <small>{t('prog_sessions')}</small>
        </div>
        <div class="stat">
          <Icon name="ghost" size={18} />
          <b>
            {ghostsOwned}
            <span>/{GHOSTS.length}</span>
          </b>
          <small>{t('prog_ghosts')}</small>
        </div>
        <div class="stat">
          <Icon name="calendar" size={18} />
          <b>{run}</b>
          <small>{t('prog_run')}</small>
        </div>
      </div>

      <section class="card">
        <header class="card-head">
          <h2>{t('prog_week')}</h2>
          <span class="muted small">{fmtMinutes(wk.minutes, true)}</span>
        </header>
        <WeekChart s={s} />
        {s.settings.showWeek && (
          <div class="week-foot">
            <WeekDots />
            <div>
              <b>{wk.done ? t('home_week_done') : t('home_week_count', { n: wk.count, target: WEEK_TARGET })}</b>
              <small class="muted">{t('prog_week_hint')}</small>
            </div>
          </div>
        )}
        <p class="muted small gentle">{t('prog_run_hint')}</p>
      </section>

      <section class={`card boss-card ${boss.done ? 'done' : ''}`}>
        <Portrait id={boss.ghost} size={92} float />
        <div class="card-text">
          <span class="eyebrow">
            <Icon name="flame" size={14} /> {t('home_boss')}
          </span>
          <b>{nameOf(ghost(boss.ghost))}</b>
          <Bar value={wk.minutes / boss.goal} color="var(--season)" />
          <small>{boss.done ? t('home_boss_calmed') : t('home_boss_body', { goal: fmtMinutes(boss.goal) })}</small>
        </div>
      </section>

      <section class="card ach-card">
        <header class="card-head">
          <h2>{t('prog_achievements')}</h2>
          <span class="muted small">
            {achDone}/{ACHIEVEMENTS.length}
          </span>
        </header>
        <div class="ach-list">
          {ACHIEVEMENTS.map((a) => {
            const done = !!s.achievements[a.id];
            const v = Math.min(achievementValue(a, c), a.target);
            return (
              <div class={`ach ${done ? 'done' : ''}`} key={a.id}>
                <span class="ach-icon">
                  <Icon name={done ? a.icon : 'lock'} size={18} />
                </span>
                <span class="ach-text">
                  <b>{t(`ach_${a.id}` as Key)}</b>
                  <small>{t(`ach_${a.id}_d` as Key)}</small>
                  {!done && <Bar value={v / a.target} thin color="var(--warm)" />}
                </span>
                <span class={`ach-reward ${done ? 'got' : ''}`}>
                  {done ? <Icon name="check" size={15} /> : <Icon name="star" size={13} />} {a.energy}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {s.plus ? (
        <>
          <section class="card">
            <header class="card-head">
              <h2>{fmtDate(now(), { month: 'long', year: 'numeric' })}</h2>
              <span class="plus-tag">Plus</span>
            </header>
            <MonthHeat s={s} />
          </section>
          <div class="duo">
            <section class="card">
              <h2 class="card-title">{t('prog_tags')}</h2>
              <TagSplit s={s} />
            </section>
            <section class="card">
              <h2 class="card-title">{t('prog_hours')}</h2>
              <HourChart s={s} />
            </section>
          </div>
          <section class="card">
            <h2 class="card-title">{t('prog_trend')}</h2>
            <Trend s={s} />
          </section>
        </>
      ) : (
        <button type="button" class="card plus-teaser" onClick={openPlus}>
          <span class="teaser-art" aria-hidden="true">
            {Array.from({ length: 21 }, (_, i) => (
              <i key={i} class={`l${(i * 7) % 4}`} />
            ))}
          </span>
          <span class="card-text">
            <b>
              <Icon name="sparkle" size={15} /> {t('plus_b3_t')}
            </b>
            <small>{t('prog_plus_teaser')}</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}

      <section class="card recap-card">
        <div class="card-text">
          <b>{t('prog_recap')}</b>
          <small>{t('prog_recap_body')}</small>
        </div>
        <Btn kind="secondary" icon="share" onClick={() => setRecap(true)}>
          {t('prog_recap_cta')}
        </Btn>
      </section>

      <p class="muted small center">
        {t('prog_best_day')}: {fmtMinutes(best)}
      </p>
      <RecapSheet open={recap} onClose={() => setRecap(false)} />
    </div>
  );
}
