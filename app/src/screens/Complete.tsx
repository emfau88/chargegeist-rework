import type { CSSProperties } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RARITY_COLOR, WISH_COST, ghost, style } from '../data/catalog';
import { nameOf, t } from '../i18n';
import type { Key } from '../i18n';
import { bondProgress } from '../logic/bond';
import { ACHIEVEMENTS } from '../logic/progress';
import { WEEK_TARGET } from '../logic/progress';
import { fmtClock, fmtMinutes } from '../logic/time';
import { sfx } from '../platform/audio';
import { cancelSessionEnd, haptic, scheduleSessionEnd } from '../platform/device';
import { bondOf, companionName, now, useAppState } from '../state/store';
import type { SessionResult } from '../state/store';
import { Bar, Btn, Icon, toast, useCountUp } from '../ui/kit';
import { StyleBadge } from '../ui/style';
import { CompanionStage, Portrait } from '../ui/stage';
import { WeekDots } from './Home';

/**
 * The result builds up step by step: the first step after START ms, the next every GAP ms.
 * With many steps the gap shrinks so the last one still starts within SPAN ms of the first,
 * which keeps the whole run under two and a half seconds.
 */
const START = 400;
const GAP = 250;
const SPAN = 1400;
/** How long a number takes to count up once its line is there. */
const COUNT = 550;

/**
 * Shows `n` steps one after another and calls `onStep` as each one appears.
 * `skip` shows the rest at once, without their sounds. With reduced motion everything is there
 * from the start, and `onStep` is called once with -1.
 */
function useSteps(n: number, onStep: (i: number) => void) {
  const still = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [shown, setShown] = useState(still ? n : 0);
  const [all, setAll] = useState(still);
  const timers = useRef<number[]>([]);
  // the clock starts with the first render: setting up the ghost's stage takes a moment of its own
  const born = useRef(performance.now()).current;
  useEffect(() => {
    const late = performance.now() - born;
    if (still) {
      timers.current = [window.setTimeout(() => onStep(-1), Math.max(0, START - late))];
    } else {
      const gap = n > 1 ? Math.min(GAP, SPAN / (n - 1)) : 0;
      timers.current = Array.from({ length: n }, (_, i) =>
        window.setTimeout(() => {
          setShown(i + 1);
          onStep(i);
        }, Math.max(0, START + i * gap - late)),
      );
    }
    return () => timers.current.forEach(clearTimeout);
  }, []);
  const skip = () => {
    timers.current.forEach(clearTimeout);
    setShown(n);
    setAll(true);
  };
  return { shown, all, skip };
}

export function Complete({ res, onDrop, onBreak, onClose }: { res: SessionResult; onDrop: (id: string) => void; onBreak: () => void; onClose: () => void }) {
  const s = useAppState();
  const [cheer, setCheer] = useState(0);
  // the daily goal reached with this session: he is proud of it
  const [proud, setProud] = useState(0);
  const name = companionName(s);
  const drop = s.pending.find((p) => p.kind === 'first') ?? s.pending.find((p) => p.kind === 'daily') ?? s.pending[0];
  const wish = res.wish.target ? style(res.wish.target) : null;
  const wishCost = wish ? WISH_COST[wish.rarity] : 1;

  // what appears, in order: the news first ("news:" ids), then the lines of the result
  const order = useMemo(() => {
    const o: string[] = [];
    if (res.boss.calmedNow) o.push('news:boss');
    for (const id of res.companionsUnlocked) o.push(`news:ghost:${id}`);
    for (const id of res.achievements) o.push(`news:ach:${id}`);
    if (res.trial) return o;
    o.push('today');
    if (res.goalReachedNow) o.push('goal');
    o.push('wish');
    if (res.bond.gained > 0) o.push('bond');
    o.push('boss');
    if (s.settings.showWeek) o.push('week');
    return o;
  }, []);
  const { shown, all, skip } = useSteps(order.length, (i) => {
    // everything at once (reduced motion): one sound for the best of it
    const id = i < 0 ? (order.find((x) => x.startsWith('news:')) ?? order.find((x) => x === 'goal') ?? 'none') : (order[i] ?? '');
    if (id === 'none') return;
    if (id.startsWith('news:')) {
      // one fanfare for all the news
      if (i <= 0) {
        sfx.unlock();
        haptic.success();
      }
    } else if (id === 'goal') {
      sfx.goal();
      setProud((n) => n + 1);
      haptic.success();
    } else {
      sfx.tick(order.slice(0, i).filter((x) => !x.startsWith('news:') && x !== 'goal').length);
    }
  });
  const on = (id: string) => shown > order.indexOf(id);
  const line = (id: string, cls: string) => `res-step ${cls} ${on(id) ? 'in' : ''}`;
  const news = (id: string, cls = '') => `unlock-card ${cls} ${on(id) ? '' : 'wait'}`;

  const mins = useCountUp(res.minutes, 900, 0, true, all);
  const today = useCountUp(res.todayAfter, COUNT, res.todayBefore, on('today'), all);
  const wishNow = useCountUp(res.wish.after, COUNT, res.wish.before, on('wish'), all);
  const bossNow = useCountUp(res.boss.after, COUNT, res.boss.before, on('boss'), all);
  const bond = bondOf(s, res.bond.ghost);
  // a new stage starts a new bar, so that one fills from empty
  const bondFrom = res.bond.after > res.bond.before ? 0 : bondProgress({ ...bond, hearts: Math.max(0, bond.hearts - res.bond.gained) }).frac;

  useEffect(() => {
    const a = setTimeout(() => setCheer(1), 200);
    return () => clearTimeout(a);
  }, []);

  const dropLabel = drop?.kind === 'first' ? t('done_open_first') : drop?.kind === 'week' ? t('done_open_week') : t('done_open_drop');

  return (
    <div class={`page complete ${all ? 'skip' : ''}`} onPointerDown={skip}>
      <CompanionStage ghostId={s.companion} level={1} mode="idle" cheer={cheer} react={{ act: 'proud', n: proud }} zoom={1.15} overscan={{ top: 0.35, side: 0.15, bottom: 0.05 }} class="complete-stage" interactive onPoke={() => sfx.poke()} />
      <div class="complete-head">
        <h1>{res.completed ? t('done_title') : t('done_title_early')}</h1>
        <p class="big-num">
          +{Math.round(mins)}
          <span>{res.minutes === 1 ? t('done_minute') : t('done_minutes')}</span>
        </p>
      </div>

      {(res.achievements.length > 0 || res.boss.calmedNow || res.companionsUnlocked.length > 0) && (
        <div class="unlocks">
          {res.boss.calmedNow && (
            <div class={news('news:boss', 'boss')} style={{ '--rc': ghost(res.boss.ghost).glow } as CSSProperties}>
              <Portrait id={res.boss.ghost} size={56} />
              <span>
                <b>{t('done_boss_calmed')}</b>
                <small>
                  {res.boss.wasOwned ? t('home_boss_calmed_dupe') : `${nameOf(ghost(res.boss.ghost))} ${t('done_unlocked')}`}
                  {res.boss.sparkRefund > 0 ? ` · ${t('spark_refund', { n: res.boss.sparkRefund })}` : ''}
                </small>
              </span>
            </div>
          )}
          {res.companionsUnlocked.map((id) => (
            <div class={news(`news:ghost:${id}`)} key={id} style={{ '--rc': ghost(id).glow } as CSSProperties}>
              <Portrait id={id} size={56} />
              <span>
                <b>{t('done_companion', { name: nameOf(ghost(id)) })}</b>
              </span>
            </div>
          ))}
          {res.achievements.map((id) => (
            <div class={news(`news:ach:${id}`)} key={id}>
              <span class="ach-icon">
                <Icon name={ACHIEVEMENTS.find((a) => a.id === id)?.icon ?? 'trophy'} size={22} />
              </span>
              <span>
                <b>{t(`ach_${id}` as Key)}</b>
                <small>
                  {t('done_achievement')} · {t('ach_reward', { n: ACHIEVEMENTS.find((a) => a.id === id)?.energy ?? 0 })}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}

      {!res.trial && (
        <div class="card results">
          <div class={line('today', 'res-group')}>
            <div class="res-row">
              <span class="res-label">
                <Icon name="bolt" size={15} /> {t('done_today', { n: Math.round(today), goal: res.goal })}
              </span>
            </div>
            <Bar value={(on('today') ? res.todayAfter : res.todayBefore) / res.goal} color="var(--charge)" />
          </div>
          {res.goalReachedNow && (
            <div class={line('goal', 'goal-row')}>
              <span class="goal-check">
                <Icon name="check" size={15} />
              </span>
              <b>{t('done_goal_hit')}</b>
              <Icon name="sparkle" size={17} />
            </div>
          )}
          <div class={line('wish', 'res-group')}>
            <div class="res-row">
              <span class="res-label">
                <Icon name="star" size={15} /> {t('done_wish')}
              </span>
              <span class="res-val">
                +{res.minutes}
                {wish ? ` · ${Math.min(Math.round(wishNow), wishCost)}/${wishCost}` : ''}
              </span>
            </div>
            {wish && (
              <div class="wish-line">
                <StyleBadge id={wish.id} size={30} />
                <Bar value={(on('wish') ? res.wish.after : res.wish.before) / wishCost} color={RARITY_COLOR[wish.rarity]} />
              </div>
            )}
          </div>
          {res.bond.gained > 0 && (
            <div class={line('bond', 'res-group')}>
              <div class="res-row">
                <span class="res-label">
                  <Icon name="heart" size={15} /> {t('done_hearts', { name: companionName(s, res.bond.ghost) })}
                </span>
                <span class="res-val">
                  {res.bond.after > res.bond.before && <span class="ok-chip heart-chip">{t('done_bond_up', { stage: t(`bond_${res.bond.after}` as Key) })}</span>} +{res.bond.gained}
                </span>
              </div>
              <Bar value={on('bond') ? bondProgress(bond).frac : bondFrom} color="var(--heart)" />
            </div>
          )}
          <div class={line('boss', 'res-group')}>
            <div class="res-row">
              <span class="res-label">
                <Icon name="flame" size={15} /> {t('done_boss')} · {nameOf(ghost(res.boss.ghost))}
              </span>
              <span class="res-val">
                {fmtMinutes(Math.min(bossNow, res.boss.goal), true)} / {fmtMinutes(res.boss.goal, true)}
              </span>
            </div>
            <Bar value={(on('boss') ? res.boss.after : res.boss.before) / res.boss.goal} color="var(--season)" />
          </div>
          {s.settings.showWeek && (
            <div class={line('week', 'res-row week-res')}>
              <span class="res-label week-label-2">
                <Icon name="calendar" size={15} />
                <span>
                  {t('done_week')}
                  <small>{t('home_week_count', { n: res.weekCount, target: WEEK_TARGET })}</small>
                </span>
              </span>
              <WeekDots compact />
            </div>
          )}
        </div>
      )}

      <div class="stack bottom-actions">
        {drop ? (
          <Btn kind="warm" big icon="gift" onClick={() => onDrop(drop.id)}>
            {dropLabel}
          </Btn>
        ) : (
          <Btn kind="primary" big onClick={onClose}>
            {t('done')}
          </Btn>
        )}
        {s.onboarded && s.settings.breakOffer && (
          <Btn kind="ghost" icon="cup" onClick={onBreak}>
            {t('done_break')}
          </Btn>
        )}
        {drop && s.onboarded && (
          <Btn kind="ghost" onClick={onClose}>
            {t('done')}
          </Btn>
        )}
      </div>
      <span class="sr-only">{name}</span>
    </div>
  );
}

export function Break({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const [start] = useState(now());
  const [, setTick] = useState(0);
  const speed = s.dev.speed ? 60 : 1;
  const total = 5 * 60;
  const elapsed = ((now() - start) / 1000) * speed;
  const left = Math.max(0, total - elapsed);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 250);
    scheduleSessionEnd((total / speed) * 1000, t('break_title'), t('break_end'));
    return () => {
      clearInterval(id);
      cancelSessionEnd();
    };
  }, []);
  useEffect(() => {
    if (left <= 0) {
      sfx.softEnd();
      haptic.success();
      toast(t('break_end'), { icon: 'cup' });
      onClose();
    }
  }, [left <= 0]);
  return (
    <div class="page break">
      <CompanionStage ghostId={s.companion} mode="sleep" level={0.2} zoom={1.1} class="focus-stage" ring={1 - left / total} acts={false} />
      <div class="focus-clock">
        <span class="clock">{fmtClock(left)}</span>
        <p class="focus-sub">{t('break_title')}</p>
        <p class="focus-tip">{t('break_body')}</p>
      </div>
      <div class="focus-controls">
        <Btn kind="secondary" big onClick={onClose}>
          {t('break_end')}
        </Btn>
      </div>
    </div>
  );
}
