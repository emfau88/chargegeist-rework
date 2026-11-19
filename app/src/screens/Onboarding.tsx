import { useEffect, useState } from 'preact/hooks';
import { COMPANIONS, ghost, item } from '../data/catalog';
import { nameOf, t } from '../i18n';
import { setProgress } from '../logic/progress';
import { sfx } from '../platform/audio';
import { askNotifications, haptic } from '../platform/device';
import {
  TAGS,
  chooseCompanion,
  companionName,
  dresser,
  finishOnboarding,
  markPlusOfferSeen,
  mutate,
  setGoal,
  setSetting,
  setTags,
  skipTrial,
  startSession,
  ownedItems,
  useAppState,
  wearItem,
} from '../state/store';
import type { TagId } from '../state/store';
import { Bar, Btn, Chip, Icon } from '../ui/kit';
import { SetStrip } from '../ui/sheets';
import { CompanionStage, Portrait } from '../ui/stage';
import { Plus } from './Plus';

type Pre = 'welcome' | 'tags' | 'goal' | 'pick' | 'trial';
const PRE: Pre[] = ['welcome', 'tags', 'goal', 'pick', 'trial'];
const GOALS: [number, 'ob_goal_15' | 'ob_goal_30' | 'ob_goal_60' | 'ob_goal_120'][] = [
  [15, 'ob_goal_15'],
  [30, 'ob_goal_30'],
  [60, 'ob_goal_60'],
  [120, 'ob_goal_120'],
];
/** Costume ghosts floating around the welcome screen, a peek at what you can collect. */
const PREVIEW = ['pumpkin', 'witch', 'kitsune', 'pirate', 'starmage'];

function Dots({ step }: { step: number }) {
  return (
    <div class="ob-dots" aria-hidden="true">
      {PRE.map((p, i) => (
        <i key={p} class={i <= step ? 'on' : ''} />
      ))}
    </div>
  );
}

export function Onboarding({ openDrop }: { openDrop: (id: string) => void }) {
  const s = useAppState();
  const post = Object.keys(s.items).length > 0;
  return post ? <PostSteps /> : <PreSteps openDrop={openDrop} />;
}

function PreSteps({ openDrop }: { openDrop: (id: string) => void }) {
  const s = useAppState();
  const [step, setStep] = useState<Pre>('welcome');
  const [tags, setLocalTags] = useState<TagId[]>(['study']);
  const [goal, setLocalGoal] = useState(30);
  const [pick, setPick] = useState('volti');
  const [name, setName] = useState('Volti');
  const [cheer, setCheer] = useState(0);
  const idx = PRE.indexOf(step);
  const go = (p: Pre) => {
    setStep(p);
    setCheer((c) => c + 1);
  };

  return (
    <div class={`page onboarding ob-${step}`}>
      {idx > 0 && (
        <header class="ob-head">
          <button type="button" class="icon-btn" aria-label={t('back')} onClick={() => setStep(PRE[idx - 1])}>
            <Icon name="chevron" size={20} class="flip" />
          </button>
          <Dots step={idx} />
          <span class="icon-btn-space" />
        </header>
      )}

      {step === 'welcome' && (
        <div class="ob-body" key="welcome">
          <div class="ob-preview" aria-hidden="true">
            {PREVIEW.map((id, i) => (
              <span key={id} class={`ob-float f${i}`}>
                <Portrait id={id} size={i === 2 ? 86 : 66} />
              </span>
            ))}
          </div>
          <CompanionStage ghostId="volti" level={0.55} interactive zoom={1.15} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage" cheer={cheer} onPoke={() => sfx.poke()} />
          <h1 class="ob-title">{t('ob_welcome_title')}</h1>
          <p class="ob-text">{t('ob_welcome_body')}</p>
          <div class="stack bottom-actions">
            <Btn kind="primary" big onClick={() => go('tags')}>
              {t('ob_welcome_cta')}
            </Btn>
          </div>
        </div>
      )}

      {step === 'tags' && (
        <div class="ob-body" key="tags">
          <h1 class="ob-title">{t('ob_tags_title')}</h1>
          <p class="ob-text">{t('ob_tags_body')}</p>
          <div class="chips center big-chips">
            {TAGS.map((tg) => (
              <Chip key={tg} icon="tag" active={tags.includes(tg)} onClick={() => setLocalTags(tags.includes(tg) ? tags.filter((x) => x !== tg) : [...tags, tg])}>
                {t(`tag_${tg}`)}
              </Chip>
            ))}
          </div>
          <div class="stack bottom-actions">
            <Btn
              kind="primary"
              big
              disabled={!tags.length}
              onClick={() => {
                setTags(tags);
                mutate((x) => {
                  x.lastTag = tags[0];
                });
                go('goal');
              }}
            >
              {t('continue')}
            </Btn>
          </div>
        </div>
      )}

      {step === 'goal' && (
        <div class="ob-body" key="goal">
          <h1 class="ob-title">{t('ob_goal_title')}</h1>
          <p class="ob-text">{t('ob_goal_body')}</p>
          <div class="goal-grid">
            {GOALS.map(([g, label]) => (
              <button
                type="button"
                key={g}
                class={`goal-card ${goal === g ? 'active' : ''}`}
                onClick={() => {
                  haptic.tap();
                  sfx.tap();
                  setLocalGoal(g);
                }}
              >
                <b>{g}</b>
                <span>{t('min')}</span>
                <small>{t(label)}</small>
              </button>
            ))}
          </div>
          <div class="stack bottom-actions">
            <Btn
              kind="primary"
              big
              onClick={() => {
                setGoal(goal);
                go('pick');
              }}
            >
              {t('continue')}
            </Btn>
          </div>
        </div>
      )}

      {step === 'pick' && (
        <div class="ob-body" key="pick">
          <h1 class="ob-title">{t('ob_pick_title')}</h1>
          <p class="ob-text">{t('ob_pick_body')}</p>
          <CompanionStage ghostId={pick} level={0.35} interactive zoom={1.2} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage small" cheer={cheer} onPoke={() => sfx.poke()} />
          <div class="pick-row">
            {COMPANIONS.filter((c) => c.starter).map((c) => (
              <button
                type="button"
                key={c.id}
                class={`pick-comp ${pick === c.id ? 'active' : ''}`}
                style={{ '--cg': c.glow } as never}
                onClick={() => {
                  haptic.tap();
                  sfx.tap();
                  if (name === nameOf(ghost(pick))) setName(nameOf(c));
                  setPick(c.id);
                  setCheer((x) => x + 1);
                }}
              >
                <Portrait id={c.id} size={64} />
                <b>{nameOf(c)}</b>
              </button>
            ))}
          </div>
          <label class="name-field">
            <span>{t('ob_name_label')}</span>
            <input value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </label>
          <div class="stack bottom-actions">
            <Btn
              kind="primary"
              big
              disabled={!name.trim()}
              onClick={() => {
                chooseCompanion(pick, name);
                go('trial');
              }}
            >
              {t('continue')}
            </Btn>
          </div>
        </div>
      )}

      {step === 'trial' && (
        <div class="ob-body" key="trial">
          <CompanionStage ghostId={s.companion} level={0} interactive zoom={1.15} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage" cheer={cheer} onPoke={() => sfx.poke()} />
          <h1 class="ob-title">{t('ob_trial_title', { name: s.names[s.companion] ?? name })}</h1>
          <p class="ob-text">{t('ob_trial_body', { name: s.names[s.companion] ?? name })}</p>
          <div class="stack bottom-actions">
            <Btn
              kind="primary"
              big
              icon="bolt"
              onClick={() => {
                sfx.start();
                haptic.success();
                startSession(1, s.lastTag, true);
              }}
            >
              {t('ob_trial_cta')}
            </Btn>
            <button type="button" class="link-btn" onClick={() => openDrop(skipTrial())}>
              {t('ob_trial_skip')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostSteps() {
  const s = useAppState();
  const [step, setStep] = useState<'outfit' | 'remind' | 'plus'>('outfit');
  const [time, setTime] = useState(s.settings.reminderTime);
  const [cheer, setCheer] = useState(0);
  const who = dresser(s);
  // the piece from the first drop goes straight on
  const first = Object.entries(s.items).sort((a, b) => a[1].at - b[1].at)[0]?.[0];

  useEffect(() => {
    if (step !== 'outfit' || !first) return;
    wearItem(who, first);
    const a = setTimeout(() => {
      setCheer(1);
      sfx.unlock();
      haptic.success();
    }, 500);
    return () => clearTimeout(a);
  }, []);

  const finish = () => {
    markPlusOfferSeen();
    finishOnboarding();
  };

  if (step === 'plus') return <Plus onClose={finish} />;

  const set = first ? item(first).set : null;
  const prog = set ? setProgress(set, ownedItems(s)) : null;

  return (
    <div class={`page onboarding ob-${step}`}>
      {step === 'outfit' && (
        <div class="ob-body" key="outfit">
          <CompanionStage ghostId={who} level={0.4} interactive zoom={1.15} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage" cheer={cheer} onPoke={() => sfx.poke()} />
          <h1 class="ob-title">{t('ob_outfit_title', { name: companionName(s, who) })}</h1>
          <p class="ob-text">{t('ob_outfit_body')}</p>
          {set && prog && (
            <div class="card set-progress" style={{ '--sc': ghost(set).glow } as never}>
              <div class="res-row set-row">
                <Portrait id={set} size={40} silhouette={!s.ghosts[set]} />
                <b>{t('drop_set', { name: nameOf(ghost(set)), have: prog.have, total: prog.total })}</b>
              </div>
              <Bar value={prog.have / prog.total} color="var(--sc)" />
              <SetStrip setId={set} size={40} />
            </div>
          )}
          <div class="stack bottom-actions">
            <Btn kind="primary" big onClick={() => setStep('remind')}>
              {t('continue')}
            </Btn>
          </div>
        </div>
      )}

      {step === 'remind' && (
        <div class="ob-body" key="remind">
          <div class="remind-art">
            <Portrait id={s.companion} size={150} outfit={s.outfits[s.companion]} />
            <span class="remind-bell">
              <Icon name="bell" size={28} />
            </span>
          </div>
          <h1 class="ob-title">{t('ob_remind_title')}</h1>
          <p class="ob-text">{t('ob_remind_body')}</p>
          <label class="time-field big">
            <Icon name="clock" size={20} />
            <input type="time" value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value)} aria-label={t('set_reminder')} />
          </label>
          <div class="stack bottom-actions">
            <Btn
              kind="primary"
              big
              icon="bell"
              onClick={async () => {
                setSetting('reminderTime', time);
                await askNotifications();
                setSetting('reminder', true);
                if (s.plusOfferSeen) finish();
                else setStep('plus');
              }}
            >
              {t('ob_remind_yes')}
            </Btn>
            <button
              type="button"
              class="link-btn"
              onClick={() => {
                if (s.plusOfferSeen) finish();
                else setStep('plus');
              }}
            >
              {t('not_now')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
