import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { RARITY_COLOR, WISH_COST, ghost, item } from '../data/catalog';
import { nameOf, t } from '../i18n';
import type { Key } from '../i18n';
import { ACHIEVEMENTS } from '../logic/progress';
import { WEEK_TARGET } from '../logic/progress';
import { fmtClock, fmtMinutes } from '../logic/time';
import { sfx } from '../platform/audio';
import { cancelSessionEnd, haptic, scheduleSessionEnd } from '../platform/device';
import { companionName, now, useAppState } from '../state/store';
import type { SessionResult } from '../state/store';
import { Bar, Btn, Icon, ItemImg, toast, useCountUp } from '../ui/kit';
import { CompanionStage, Portrait } from '../ui/stage';
import { WeekDots } from './Home';

export function Complete({ res, onDrop, onBreak, onClose }: { res: SessionResult; onDrop: (id: string) => void; onBreak: () => void; onClose: () => void }) {
  const s = useAppState();
  const [cheer, setCheer] = useState(0);
  const name = companionName(s);
  const mins = useCountUp(res.minutes, 1200);
  const drop = s.pending.find((p) => p.kind === 'first') ?? s.pending.find((p) => p.kind === 'daily') ?? s.pending[0];
  const wish = res.wish.target ? item(res.wish.target) : null;

  useEffect(() => {
    const a = setTimeout(() => setCheer(1), 200);
    const b = setTimeout(() => {
      if (res.achievements.length || res.boss.calmedNow || res.companionsUnlocked.length) {
        sfx.unlock();
        haptic.success();
      }
    }, 1300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const dropLabel = drop?.kind === 'first' ? t('done_open_first') : drop?.kind === 'week' ? t('done_open_week') : t('done_open_drop');

  return (
    <div class="page complete">
      <CompanionStage ghostId={s.companion} level={1} mode="idle" cheer={cheer} zoom={1.15} overscan={{ top: 0.35, side: 0.15, bottom: 0.05 }} class="complete-stage" interactive onPoke={() => sfx.poke()} />
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
            <div class="unlock-card boss" style={{ '--rc': ghost(res.boss.ghost).glow } as CSSProperties}>
              <Portrait id={res.boss.ghost} size={56} />
              <span>
                <b>{t('done_boss_calmed')}</b>
                <small>{res.boss.wasOwned ? t('home_boss_calmed_dupe') : `${nameOf(ghost(res.boss.ghost))} ${t('done_unlocked')}`}</small>
              </span>
            </div>
          )}
          {res.companionsUnlocked.map((id) => (
            <div class="unlock-card" key={id} style={{ '--rc': ghost(id).glow } as CSSProperties}>
              <Portrait id={id} size={56} />
              <span>
                <b>{t('done_companion', { name: nameOf(ghost(id)) })}</b>
              </span>
            </div>
          ))}
          {res.achievements.map((id) => (
            <div class="unlock-card" key={id}>
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
          <div class="res-row">
            <span class="res-label">
              <Icon name="bolt" size={15} /> {t('done_today', { n: Math.round(res.todayAfter), goal: res.goal })}
            </span>
            {res.goalReachedNow && <span class="ok-chip">{t('done_goal_hit')}</span>}
          </div>
          <Bar value={res.todayAfter / res.goal} color="var(--charge)" />
          <div class="res-row">
            <span class="res-label">
              <Icon name="star" size={15} /> {t('done_wish')}
            </span>
            <span class="res-val">
              +{res.minutes}
              {wish ? ` · ${Math.min(res.wish.after, WISH_COST[wish.rarity])}/${WISH_COST[wish.rarity]}` : ''}
            </span>
          </div>
          {wish && (
            <div class="wish-line">
              <ItemImg id={wish.id} size={30} />
              <Bar value={res.wish.after / WISH_COST[wish.rarity]} color={RARITY_COLOR[wish.rarity]} />
            </div>
          )}
          <div class="res-row">
            <span class="res-label">
              <Icon name="flame" size={15} /> {t('done_boss')} · {nameOf(ghost(res.boss.ghost))}
            </span>
            <span class="res-val">
              {fmtMinutes(Math.min(res.boss.after, res.boss.goal), true)} / {fmtMinutes(res.boss.goal, true)}
            </span>
          </div>
          <Bar value={res.boss.after / res.boss.goal} color="var(--season)" />
          {s.settings.showWeek && (
            <div class="res-row week-res">
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
      <CompanionStage ghostId={s.companion} mode="sleep" level={0.2} zoom={1.1} class="focus-stage" ring={1 - left / total} />
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
