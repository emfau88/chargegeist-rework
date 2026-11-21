import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { fmtClock } from '../logic/time';
import { playAmbient, setAmbientVolume, sfx, stopAmbient } from '../platform/audio';
import { cancelSessionEnd, haptic, keepAwake, scheduleSessionEnd } from '../platform/device';
import {
  companionName,
  dev,
  discardSession,
  elapsedMin,
  finishSession,
  now,
  pauseSession,
  resumeSession,
  useAppState,
} from '../state/store';
import type { SessionResult } from '../state/store';
import { Btn, Icon, Sheet } from '../ui/kit';
import { AMBIENTS, AmbientSheet } from '../ui/sheets';
import { CompanionStage } from '../ui/stage';

export function Focus({ onDone, openPlus }: { onDone: (r: SessionResult | null) => void; openPlus: () => void }) {
  const s = useAppState();
  const a = s.active!;
  const [, setTick] = useState(0);
  const [endOpen, setEndOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const finished = useRef(false);
  // a session that has just begun: he nods once (not when the app comes back to a running one)
  const [fresh] = useState(() => (elapsedMin(a) / a.speed) * 60 < 3);
  const name = companionName(s);

  const el = elapsedMin(a);
  const progress = Math.min(1, el / a.planned);
  const paused = a.pausedAt !== null;
  const remaining = Math.max(0, (a.planned - el) * 60);
  const amb = AMBIENTS.find((x) => x.id === s.settings.ambient)!;
  const ambAllowed = !amb.plus || s.plus;

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), a.speed > 1 ? 100 : 250);
    const vis = () => setTick((x) => x + 1);
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    cancelSessionEnd();
    const res = finishSession();
    sfx.complete();
    haptic.big();
    onDone(res);
  };

  // complete when time is up (also after returning from the background)
  if (el >= a.planned && !finished.current) queueMicrotask(finish);

  // notification for when the app is in the background
  useEffect(() => {
    if (paused) {
      cancelSessionEnd();
      return;
    }
    const ms = ((a.planned - elapsedMin(a, now())) / a.speed) * 60000;
    scheduleSessionEnd(ms, t('focus_notif_title', { name }), t('focus_notif_body', { n: a.planned }));
    return cancelSessionEnd;
  }, [paused, a.id]);

  useEffect(() => {
    void keepAwake(s.settings.keepAwake && !paused);
    return () => void keepAwake(false);
  }, [paused, s.settings.keepAwake]);

  useEffect(() => {
    setAmbientVolume(s.settings.volume);
    if (!paused && ambAllowed && s.settings.ambient !== 'off') playAmbient(s.settings.ambient);
    else stopAmbient();
  }, [paused, s.settings.ambient, s.plus]);
  useEffect(() => setAmbientVolume(s.settings.volume), [s.settings.volume]);
  useEffect(() => () => stopAmbient(), []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !endOpen && !soundOpen) {
        e.preventDefault();
        if (paused) resumeSession();
        else pauseSession();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [paused, endOpen, soundOpen]);

  const tip = progress < 0.15 ? t('focus_tip_1', { name }) : progress < 0.45 ? t('focus_tip_2') : progress < 0.8 ? t('focus_tip_3', { name }) : t('focus_tip_4');
  const whole = Math.floor(el);

  return (
    <div class={`page focus ${paused ? 'is-paused' : ''}`}>
      <header class="focus-top">
        <span class="pill">
          <Icon name="tag" size={15} /> {t(`tag_${a.tag}`)}
        </span>
        <button type="button" class="pill pill-btn" onClick={() => setSoundOpen(true)}>
          <Icon name={s.settings.ambient === 'off' ? 'mute' : 'sound'} size={16} />
          {s.settings.ambient === 'off' ? t('focus_quiet') : t(`amb_${s.settings.ambient}`)}
        </button>
      </header>

      <CompanionStage
        ghostId={s.companion}
        mode={paused ? 'idle' : 'focus'}
        level={progress}
        ring={progress}
        zoom={1.05}
        overscan={{ top: 0.15, side: 0.1, bottom: 0.05 }}
        class="focus-stage"
        label={t('focus_charging', { name })}
        acts={false}
        react={{ act: 'nod', n: fresh ? 1 : 0 }}
      />

      <div class="focus-clock" aria-live="off">
        <span class="clock">{fmtClock(remaining)}</span>
        <p class="focus-sub">{paused ? t('focus_paused') : t('focus_charging', { name })}</p>
        <p class="focus-tip" key={tip}>
          {tip}
        </p>
        {a.speed > 1 && <span class="demo-badge">{t('focus_demo')}</span>}
        {s.dev.tools && (
          <button type="button" class="demo-badge dev-finish" onClick={() => dev.finishNow()}>
            {t('dev_finish')}
          </button>
        )}
      </div>

      <div class="focus-controls">
        <Btn kind="secondary" icon={paused ? 'play' : 'pause'} onClick={() => (paused ? resumeSession() : pauseSession())} big>
          {paused ? t('focus_resume') : t('focus_pause')}
        </Btn>
        <Btn kind="ghost" icon="stop" onClick={() => setEndOpen(true)} big>
          {t('focus_end')}
        </Btn>
      </div>

      <Sheet open={endOpen} onClose={() => setEndOpen(false)} title={t('focus_end_title')}>
        <p class="muted">{whole >= 1 ? t('focus_end_body', { n: whole }) : t('focus_end_body_short')}</p>
        <div class="stack">
          <Btn kind="primary" big onClick={() => setEndOpen(false)}>
            {t('focus_keep')}
          </Btn>
          <Btn
            kind="ghost"
            onClick={() => {
              setEndOpen(false);
              if (whole >= 1) finish();
              else {
                finished.current = true;
                cancelSessionEnd();
                sfx.softEnd();
                discardSession();
                onDone(null);
              }
            }}
          >
            {whole >= 1 ? t('focus_end_save') : t('focus_end_discard')}
          </Btn>
        </div>
      </Sheet>
      <AmbientSheet open={soundOpen} onClose={() => setSoundOpen(false)} onPlus={openPlus} />
    </div>
  );
}
