import { useState } from 'preact/hooks';
import { GHOSTS } from '../data/catalog';
import { t } from '../i18n';
import { plusForSale, plusPrice } from '../platform/billing';
import { RELEASE } from '../platform/build';
import { askNotifications, dailyReminderSupported, sessionNoticeSupported } from '../platform/device';
import { stopAmbient } from '../platform/audio';
import {
  TAGS,
  companionName,
  dev,
  setGoal,
  setSetting,
  setTags,
  useAppState,
} from '../state/store';
import type { Lang } from '../state/store';
import { Btn, Chip, Row, Sheet, Toggle, toast } from '../ui/kit';
import { AmbientSheet, CompanionSheet, OddsSheet, ThemeSheet } from '../ui/sheets';
import { useReducedMotion } from '../ui/sky';
import { Portrait } from '../ui/stage';
import { theme } from '../ui/themes';
import { DevMenu } from './DevMenu';

const GOALS = [15, 30, 45, 60, 90, 120];

export function Settings({ openPlus }: { openPlus: () => void }) {
  const s = useAppState();
  const reduce = useReducedMotion();
  const [sheet, setSheet] = useState<null | 'companion' | 'goal' | 'tags' | 'theme' | 'ambient' | 'lang' | 'privacy' | 'odds' | 'reset' | 'reminder' | 'dev'>(null);
  const close = () => setSheet(null);
  const langName = s.settings.lang === 'auto' ? t('set_lang_auto') : s.settings.lang === 'de' ? 'Deutsch' : 'English';

  return (
    <div class="page settings">
      <header class="page-head">
        <h1>{t('set_title')}</h1>
      </header>

      <button type="button" class="card comp-row" onClick={() => setSheet('companion')}>
        <Portrait id={s.companion} size={64} />
        <span class="card-text">
          <small class="eyebrow">{t('set_companion')}</small>
          <b>{companionName(s)}</b>
        </span>
        <span class="muted small">{Object.keys(s.ghosts).length}/{GHOSTS.length}</span>
      </button>

      <div class="group">
        <Row icon="bolt" label={t('set_goal')} value={`${s.goal} ${t('min')}`} onClick={() => setSheet('goal')} />
        <Row icon="tag" label={t('set_tags')} value={s.tags.map((x) => t(`tag_${x}`)).join(', ')} onClick={() => setSheet('tags')} />
        {/* only where a reminder can really be delivered (see dailyReminderSupported) */}
        {dailyReminderSupported() && <Row icon="bell" label={t('set_reminder')} hint={s.settings.reminder ? s.settings.reminderTime : t('set_reminder_hint')} onClick={() => setSheet('reminder')} />}
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
        {sessionNoticeSupported() && (
          <Row icon="bell" label={t('set_notice')}>
            <Toggle
              on={s.settings.endNotice}
              onChange={async (v) => {
                setSetting('endNotice', v);
                // switching it on asks Android for the permission; if that was refused before, only the system settings help
                if (v && !(await askNotifications(true))) {
                  setSetting('endNotice', false);
                  toast(t('set_notice_denied'), { icon: 'bell' });
                }
              }}
              label={t('set_notice')}
            />
          </Row>
        )}
        <Row icon="cup" label={t('set_break')}>
          <Toggle on={s.settings.breakOffer} onChange={(v) => setSetting('breakOffer', v)} label={t('set_break')} />
        </Row>
        <Row icon="calendar" label={t('set_week')}>
          <Toggle on={s.settings.showWeek} onChange={(v) => setSetting('showWeek', v)} label={t('set_week')} />
        </Row>
        <Row icon="star" label={t('set_sky')} hint={reduce ? t('set_sky_reduced') : undefined}>
          <Toggle on={s.settings.sky && !reduce} onChange={(v) => setSetting('sky', v)} label={t('set_sky')} />
        </Row>
        <Row icon="globe" label={t('set_lang')} value={langName} onClick={() => setSheet('lang')} />
      </div>

      <div class="group">
        {(plusForSale() || s.plus) && <Row icon="crown" label={t('set_plus')} value={s.plus ? '✓' : (plusPrice() ?? t('plus_price'))} onClick={openPlus} />}
        <Row icon="info" label={t('set_odds')} onClick={() => setSheet('odds')} />
        <Row icon="shield" label={t('set_privacy')} onClick={() => setSheet('privacy')} />
        <Row icon="trash" label={t('set_reset')} onClick={() => setSheet('reset')} />
      </div>

      {!RELEASE && (
        <div class="group dev">
          <Row icon="wand" label={t('dev_title')} hint={t('dev_open_hint')} onClick={() => setSheet('dev')} />
        </div>
      )}
      {/* the store release is no prototype any more */}
      <p class="muted small center">{RELEASE ? 'Version 2.0.0' : t('set_version', { v: '2.0.0' })}</p>

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
      {!RELEASE && <DevMenu open={sheet === 'dev'} onClose={close} />}

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
        <p class="muted">{t('set_reminder_body')}</p>
        <Row icon="bell" label={t('set_reminder')}>
          <Toggle
            on={s.settings.reminder}
            onChange={async (v) => {
              // on only with the permission: a switch that is on must mean a reminder comes
              setSetting('reminder', v && (await askNotifications()));
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
