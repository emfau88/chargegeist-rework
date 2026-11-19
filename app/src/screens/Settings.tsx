import { useState } from 'preact/hooks';
import { GHOSTS, ITEMS, ghost } from '../data/catalog';
import { nameOf, t } from '../i18n';
import type { Key } from '../i18n';
import { askNotifications } from '../platform/device';
import { stopAmbient } from '../platform/audio';
import {
  TAGS,
  companionName,
  dev,
  outfitOf,
  mutate,
  setGoal,
  setPlus,
  setSetting,
  setTags,
  useAppState,
} from '../state/store';
import type { Lang } from '../state/store';
import { Btn, Chip, Row, Sheet, Toggle, toast } from '../ui/kit';
import { AmbientSheet, CompanionSheet, OddsSheet, ThemeSheet } from '../ui/sheets';
import { Portrait } from '../ui/stage';
import { theme } from '../ui/themes';

const GOALS = [15, 30, 45, 60, 90, 120];

export function Settings({ openPlus }: { openPlus: () => void }) {
  const s = useAppState();
  const [sheet, setSheet] = useState<null | 'companion' | 'goal' | 'tags' | 'theme' | 'ambient' | 'lang' | 'privacy' | 'odds' | 'reset' | 'reminder'>(null);
  const close = () => setSheet(null);
  const langName = s.settings.lang === 'auto' ? t('set_lang_auto') : s.settings.lang === 'de' ? 'Deutsch' : 'English';

  return (
    <div class="page settings">
      <header class="page-head">
        <h1>{t('set_title')}</h1>
      </header>

      <button type="button" class="card comp-row" onClick={() => setSheet('companion')}>
        <Portrait id={s.companion} size={64} outfit={outfitOf(s, s.companion)} />
        <span class="card-text">
          <small class="eyebrow">{t('set_companion')}</small>
          <b>{companionName(s)}</b>
        </span>
        <span class="muted small">{Object.keys(s.ghosts).length}/{GHOSTS.length}</span>
      </button>

      <div class="group">
        <Row icon="bolt" label={t('set_goal')} value={`${s.goal} ${t('min')}`} onClick={() => setSheet('goal')} />
        <Row icon="tag" label={t('set_tags')} value={s.tags.map((x) => t(`tag_${x}`)).join(', ')} onClick={() => setSheet('tags')} />
        <Row icon="bell" label={t('set_reminder')} hint={s.settings.reminder ? s.settings.reminderTime : t('set_reminder_hint')} onClick={() => setSheet('reminder')} />
      </div>

      <div class="group">
        <Row icon="palette" label={t('set_theme')} value={t(`th_${theme(s.settings.theme).id}`)} onClick={() => setSheet('theme')} />
        <Row icon="music" label={t('set_ambient')} value={t(`amb_${s.settings.ambient}`)} onClick={() => setSheet('ambient')} />
        <Row icon="sound" label={t('set_sound')}>
          <Toggle on={s.settings.sound} onChange={(v) => setSetting('sound', v)} label={t('set_sound')} />
        </Row>
        <Row icon="sparkle" label={t('set_haptics')}>
          <Toggle on={s.settings.haptics} onChange={(v) => setSetting('haptics', v)} label={t('set_haptics')} />
        </Row>
        <Row icon="moon" label={t('set_awake')}>
          <Toggle on={s.settings.keepAwake} onChange={(v) => setSetting('keepAwake', v)} label={t('set_awake')} />
        </Row>
        <Row icon="cup" label={t('set_break')}>
          <Toggle on={s.settings.breakOffer} onChange={(v) => setSetting('breakOffer', v)} label={t('set_break')} />
        </Row>
        <Row icon="calendar" label={t('set_week')}>
          <Toggle on={s.settings.showWeek} onChange={(v) => setSetting('showWeek', v)} label={t('set_week')} />
        </Row>
        <Row icon="globe" label={t('set_lang')} value={langName} onClick={() => setSheet('lang')} />
      </div>

      <div class="group">
        <Row icon="crown" label={t('set_plus')} value={s.plus ? '✓' : t('plus_price')} onClick={openPlus} />
        <Row icon="info" label={t('set_odds')} onClick={() => setSheet('odds')} />
        <Row icon="shield" label={t('set_privacy')} onClick={() => setSheet('privacy')} />
        <Row icon="trash" label={t('set_reset')} onClick={() => setSheet('reset')} />
      </div>

      <div class="group dev">
        <p class="group-title">
          {t('set_dev')} <small>{t('set_dev_hint')}</small>
        </p>
        <Row icon="wand" label={t('set_dev_speed')}>
          <Toggle on={s.dev.speed} onChange={(v) => dev.setSpeed(v)} label={t('set_dev_speed')} />
        </Row>
        <Row icon="crown" label={t('set_dev_plus')}>
          <Toggle on={s.plus} onChange={(v) => setPlus(v)} label={t('set_dev_plus')} />
        </Row>
        <Row
          icon="plus"
          label={t('set_dev_add')}
          onClick={() => {
            const r = dev.addMinutes(25);
            toast(`+25 ${t('min')}`, { icon: 'bolt' });
            if (r.dailyDrop || r.weekDrop) toast(t('home_drop_ready_title'), { icon: 'gift' });
            r.achievements.forEach((a) => toast(`${t(`ach_${a}` as Key)} · ${t('done_achievement')}`, { icon: 'trophy' }));
            r.companionsUnlocked.forEach((id) => toast(`${nameOf(ghost(id))} ${t('done_unlocked')}`, { ghost: id }));
          }}
        />
        <Row
          icon="calendar"
          label={t('set_dev_day')}
          onClick={() => {
            dev.nextDay();
            toast(t('set_dev_day'), { icon: 'calendar' });
          }}
        />
        <Row icon="gift" label={t('set_dev_drop')} onClick={() => dev.grantDrop()} />
        <Row
          icon="hanger"
          label={t('set_dev_all')}
          onClick={() => {
            dev.unlockAll(
              ITEMS.map((i) => i.id),
              GHOSTS.map((g) => g.id),
            );
            toast(t('set_dev_all'), { icon: 'sparkle' });
          }}
        />
        <Row
          icon="restore"
          label={t('set_dev_onboarding')}
          onClick={() =>
            mutate((x) => {
              x.onboarded = false;
              x.items = {};
              x.outfits = {};
              x.pending = [];
              x.plusOfferSeen = false;
            })
          }
        />
      </div>
      <p class="muted small center">{t('set_version', { v: '2.0.0' })}</p>

      <CompanionSheet open={sheet === 'companion'} onClose={close} />
      <ThemeSheet open={sheet === 'theme'} onClose={close} onPlus={openPlus} />
      <AmbientSheet
        open={sheet === 'ambient'}
        onClose={() => {
          stopAmbient();
          close();
        }}
        onPlus={openPlus}
        preview
      />
      <OddsSheet open={sheet === 'odds'} onClose={close} />

      <Sheet open={sheet === 'goal'} onClose={close} title={t('set_goal')}>
        <p class="muted">{t('ob_goal_body')}</p>
        <div class="chips center">
          {GOALS.map((g) => (
            <Chip key={g} active={s.goal === g} onClick={() => setGoal(g)}>
              {g} {t('min')}
            </Chip>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'tags'} onClose={close} title={t('set_tags')}>
        <div class="chips">
          {TAGS.map((tg) => (
            <Chip key={tg} icon="tag" active={s.tags.includes(tg)} onClick={() => setTags(s.tags.includes(tg) ? s.tags.filter((x) => x !== tg) : [...s.tags, tg])}>
              {t(`tag_${tg}`)}
            </Chip>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'reminder'} onClose={close} title={t('set_reminder')}>
        <p class="muted">{t('ob_remind_body')}</p>
        <Row icon="bell" label={t('set_reminder')}>
          <Toggle
            on={s.settings.reminder}
            onChange={async (v) => {
              if (v) await askNotifications();
              setSetting('reminder', v);
            }}
            label={t('set_reminder')}
          />
        </Row>
        <label class="time-field">
          <span>{t('set_reminder')}</span>
          <input type="time" value={s.settings.reminderTime} disabled={!s.settings.reminder} onInput={(e) => setSetting('reminderTime', (e.target as HTMLInputElement).value)} />
        </label>
      </Sheet>

      <Sheet open={sheet === 'lang'} onClose={close} title={t('set_lang')}>
        <div class="pick-list">
          {(['auto', 'en', 'de'] as Lang[]).map((l) => (
            <button type="button" key={l} class={`pick ${s.settings.lang === l ? 'active' : ''}`} onClick={() => setSetting('lang', l)}>
              <span>{l === 'auto' ? t('set_lang_auto') : l === 'de' ? 'Deutsch' : 'English'}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'privacy'} onClose={close} title={t('set_privacy')}>
        <p>{t('set_privacy_body')}</p>
      </Sheet>

      <Sheet open={sheet === 'reset'} onClose={close} title={t('set_reset_title')}>
        <p class="muted">{t('set_reset_body')}</p>
        <div class="stack">
          <Btn kind="secondary" big onClick={close}>
            {t('cancel')}
          </Btn>
          <Btn
            kind="danger"
            icon="trash"
            onClick={() => {
              close();
              dev.reset();
            }}
          >
            {t('set_reset_yes')}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}
