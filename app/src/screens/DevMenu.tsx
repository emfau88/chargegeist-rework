/**
 * The developer menu, for testing: skip time and waiting, give or take single ghosts and styles,
 * add sparks, wish energy and hearts, set the sky to an hour, go fullscreen, start over.
 * Everything here changes the save, through the dev functions of the store.
 */
import { useEffect, useState } from 'preact/hooks';
import { GHOSTS, STYLES, ghost } from '../data/catalog';
import type { StyleKind } from '../data/types';
import { nameOf, t } from '../i18n';
import type { Key } from '../i18n';
import { canFullscreen, isFullscreen, isStandalone, setFullscreen } from '../platform/device';
import { companionName, dev, setPlus, sparkTarget, todayMinutes, useAppState } from '../state/store';
import type { SessionResult } from '../state/store';
import { Chip, Row, Sheet, Toggle, toast } from '../ui/kit';

/** Hours to set the sky to: morning, day, evening, night. */
const SKY_HOURS = [8, 13, 19, 23];
const KINDS: [StyleKind, Key][] = [
  ['aura', 'col_auras'],
  ['shimmer', 'col_shimmers'],
  ['charm', 'col_charms'],
];

/** Says what a credited session brought, as the screens after a real session would. */
function tell(r: SessionResult) {
  toast(`+${r.minutes} ${t('min')}`, { icon: 'bolt' });
  if (r.dailyDrop || r.weekDrop) toast(t('home_drop_ready_title'), { icon: 'gift' });
  r.achievements.forEach((a) => toast(`${t(`ach_${a}` as Key)} · ${t('done_achievement')}`, { icon: 'trophy' }));
  r.companionsUnlocked.forEach((id) => toast(`${nameOf(ghost(id))} ${t('done_unlocked')}`, { ghost: id }));
  if (r.boss.calmedNow) toast(t('done_boss_calmed'), { ghost: r.boss.ghost });
}

export function DevMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const [full, setFull] = useState(isFullscreen());
  const [sure, setSure] = useState(false);
  useEffect(() => {
    const f = () => setFull(isFullscreen());
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  useEffect(() => {
    if (!open) setSure(false);
  }, [open]);

  const done = (icon = 'check') => toast(t('dev_done'), { icon });
  const target = sparkTarget(s);

  return (
    <Sheet open={open} onClose={onClose} title={t('dev_title')} class="dev-menu">
      <p class="muted small">{t('dev_hint')}</p>

      <div class="group dev">
        <p class="group-title">{t('dev_time')}</p>
        <Row icon="wand" label={t('set_dev_speed')}>
          <Toggle on={s.dev.speed} onChange={(v) => dev.setSpeed(v)} label={t('set_dev_speed')} />
        </Row>
        <Row icon="stop" label={t('dev_tools')}>
          <Toggle on={s.dev.tools} onChange={(v) => dev.setTools(v)} label={t('dev_tools')} />
        </Row>
        <Row icon="plus" label={t('set_dev_add')} onClick={() => tell(dev.addMinutes(25))} />
        <Row icon="bolt" label={t('dev_goal_now')} onClick={() => tell(dev.addMinutes(Math.max(1, s.goal - todayMinutes(s))))} />
        <Row
          icon="calendar"
          label={t('set_dev_day')}
          onClick={() => {
            dev.nextDay();
            done('calendar');
          }}
        />
        <Row
          icon="gift"
          label={t('set_dev_drop')}
          onClick={() => {
            dev.grantDrop();
            toast(t('home_drop_ready_title'), { icon: 'gift' });
          }}
        />
        <Row
          icon="restore"
          label={t('dev_free_drop')}
          onClick={() => {
            dev.freeDailyDrop();
            done('gift');
          }}
        />
        <Row
          icon="heart"
          label={t('dev_free_touch')}
          onClick={() => {
            dev.freeTouches();
            done('heart');
          }}
        />
        <Row
          icon="flame"
          label={t('dev_boss')}
          onClick={() => {
            if (dev.calmBoss()) toast(t('done_boss_calmed'), { icon: 'flame' });
            else toast(t('dev_boss_was'), { icon: 'flame' });
          }}
        />
      </div>

      <div class="group dev">
        <p class="group-title">
          {t('dev_ghosts')} <small>{t('dev_ghosts_hint')}</small>
        </p>
        <div class="chips dev-chips">
          {GHOSTS.map((g) => (
            <Chip key={g.id} active={!!s.ghosts[g.id]} onClick={() => dev.setGhost(g.id, !s.ghosts[g.id])}>
              {nameOf(g)}
            </Chip>
          ))}
        </div>
      </div>

      <div class="group dev">
        <p class="group-title">
          {t('dev_styles')} <small>{t('dev_styles_hint')}</small>
        </p>
        {KINDS.map(([kind, label]) => (
          <div key={kind}>
            <p class="dev-sub">{t(label)}</p>
            <div class="chips dev-chips">
              {STYLES.filter((x) => x.kind === kind && !x.plus).map((x) => (
                <Chip key={x.id} active={!!s.styles[x.id]} onClick={() => dev.setStyle(x.id, !s.styles[x.id])}>
                  {nameOf(x)}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        <Row
          icon="palette"
          label={t('set_dev_all')}
          onClick={() => {
            dev.unlockAll(
              STYLES.map((i) => i.id),
              GHOSTS.map((g) => g.id),
            );
            done('sparkle');
          }}
        />
      </div>

      <div class="group dev">
        <p class="group-title">{t('dev_values')}</p>
        <Row
          icon="sparkle"
          label={t('dev_spark')}
          value={target ? nameOf(ghost(target)) : t('dev_spark_none')}
          onClick={() => {
            const r = dev.addSpark();
            if (r.joined && r.ghost) toast(`${nameOf(ghost(r.ghost))} ${t('done_unlocked')}`, { ghost: r.ghost });
            else done('sparkle');
          }}
        />
        <Row
          icon="star"
          label={t('dev_wish')}
          value={String(s.wish.energy)}
          onClick={() => {
            dev.addWish(50);
            done('star');
          }}
        />
        <Row
          icon="heart"
          label={t('dev_hearts', { name: companionName(s) })}
          onClick={() => {
            dev.addHearts(s.companion, 10);
            done('heart');
          }}
        />
        <Row icon="crown" label={t('set_dev_plus')}>
          <Toggle on={s.plus} onChange={(v) => setPlus(v)} label={t('set_dev_plus')} />
        </Row>
      </div>

      <div class="group dev">
        <p class="group-title">{t('dev_look')}</p>
        <p class="dev-sub">{t('dev_sky')}</p>
        <div class="chips dev-chips">
          <Chip active={s.dev.skyHour === null} onClick={() => dev.setSkyHour(null)}>
            {t('dev_sky_live')}
          </Chip>
          {SKY_HOURS.map((h) => (
            <Chip key={h} active={s.dev.skyHour === h} onClick={() => dev.setSkyHour(h)}>
              {t('dev_sky_hour', { h })}
            </Chip>
          ))}
        </div>
        <Row icon="ghost" label={t('dev_acts')}>
          <Toggle on={s.dev.acts} onChange={(v) => dev.setActs(v)} label={t('dev_acts')} />
        </Row>
        {isStandalone() ? (
          <Row icon="share" label={t('dev_full')} hint={t('dev_full_home')} />
        ) : canFullscreen() ? (
          <Row icon="share" label={t('dev_full')}>
            <Toggle on={full} onChange={(v) => void setFullscreen(v).then(setFull)} label={t('dev_full')} />
          </Row>
        ) : (
          <Row icon="share" label={t('dev_full')} hint={t('dev_full_no')} />
        )}
      </div>

      <div class="group dev">
        <p class="group-title">{t('dev_restart')}</p>
        <Row
          icon="restore"
          label={t('set_dev_onboarding')}
          onClick={() => {
            onClose();
            dev.restartOnboarding();
          }}
        />
        <Row
          icon="trash"
          label={t('dev_reset_all')}
          hint={sure ? t('dev_reset_sure') : undefined}
          onClick={() => {
            if (!sure) {
              setSure(true);
              return;
            }
            onClose();
            dev.reset();
          }}
        />
      </div>
    </Sheet>
  );
}
