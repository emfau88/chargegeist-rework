import { useEffect, useRef, useState } from 'preact/hooks';
import { COMPANIONS, DEFAULT_COMPANION, ghost } from '../data/catalog';
import { stageLights } from '../fx/ground';
import { nameOf, t } from '../i18n';
import { sfx } from '../platform/audio';
import { askNotifications, haptic } from '../platform/device';
import {
  TAGS,
  chooseCompanion,
  companionName,
  finishOnboarding,
  markPlusOfferSeen,
  mutate,
  setGoal,
  setSetting,
  setTags,
  skipTrial,
  sparkTarget,
  startSession,
  useAppState,
  wearStyle,
} from '../state/store';
import type { TagId } from '../state/store';
import type { RigApi } from '../rig/rig';
import { Btn, Chip, Icon } from '../ui/kit';
import { SparkMeter } from '../ui/sheets';
import { useReducedMotion } from '../ui/sky';
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

/** The starters that stand beside the first one on the title screen. */
const FRIENDS = COMPANIONS.filter((c) => c.starter && c.id !== DEFAULT_COMPANION).map((c) => c.id);
const SCENE_IMG = (name: string) => `${import.meta.env.BASE_URL}assets/scene/${name}.webp`;
/** Fireflies over the meadow: where each one hovers (share of the width, pixels from the ground line), when it starts and how long one round takes (seconds). */
const FLIES: [number, number, number, number][] = [
  [7, -92, 0, 5.2],
  [21, 44, 1.4, 6.1],
  [34, -168, 2.6, 5.6],
  [66, -182, 0.8, 6.4],
  [80, 30, 3.1, 5],
  [93, -104, 1.9, 5.8],
  [52, 84, 4, 6.6],
  [13, 118, 2.2, 5.4],
  [88, 126, 0.4, 6],
];
/**
 * The entrance of the title screen, in ms from its start: the clearing lies dark, the lantern lights up,
 * the first ghost floats in and its friends join, they say hello, then the name and the button come.
 * The parts themselves are timed in CSS (.title.enter in styles.css) on the same beat.
 */
const ENTER = { lantern: 250, greet: 1550, wave: 1950, done: 3100 };
/** The lantern on the meadow is the scene's second one; the first would hang behind a ghost here and is not shown. */
const LIT = { first: false, goal: true };
const DARK = { first: false, goal: false };
/** The entrance waits for the three ghosts to load, at most this long. */
const ENTER_WAIT_MS = 1800;

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
  const post = Object.keys(s.styles).length > 0;
  return post ? <PostSteps /> : <PreSteps openDrop={openDrop} />;
}

function PreSteps({ openDrop }: { openDrop: (id: string) => void }) {
  const s = useAppState();
  const [step, setStep] = useState<Pre>('welcome');
  const [tags, setLocalTags] = useState<TagId[]>(['study']);
  const [goal, setLocalGoal] = useState(30);
  const [pick, setPick] = useState(DEFAULT_COMPANION);
  const [name, setName] = useState(() => nameOf(ghost(DEFAULT_COMPANION)));
  const [cheer, setCheer] = useState(0);
  // the title's entrance plays once per onboarding: coming back from the next step shows the finished picture
  const titleSeen = useRef(false);
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

      {step === 'welcome' && <Title key="welcome" entrance={!titleSeen.current} onShown={() => (titleSeen.current = true)} cheer={cheer} onGo={() => go('tags')} />}

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
          <CompanionStage ghostId={pick} level={0.35} interactive zoom={1.2} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage small" cheer={cheer} onPoke={() => sfx.poke()} ground />
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
          <CompanionStage ghostId={s.companion} level={0} interactive zoom={1.15} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage" cheer={cheer} onPoke={() => sfx.poke()} ground />
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

/**
 * The first screen: the name of the app over the clearing, with the three starters on it and a
 * lantern lit. With `entrance` it opens with a short one; a tap anywhere ends that at once, and with
 * reduced motion the finished picture is there from the start.
 */
function Title({ entrance, onShown, cheer, onGo }: { entrance: boolean; onShown: () => void; cheer: number; onGo: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'wait' | 'enter' | 'done'>(() => (entrance && !reduce ? 'wait' : 'done'));
  const hero = useRef<RigApi | null>(null);
  const left = useRef<RigApi | null>(null);
  const right = useRef<RigApi | null>(null);

  // the lantern is this screen's while it shows
  useEffect(() => {
    onShown();
    return () => stageLights(null);
  }, []);
  useEffect(() => {
    if (phase === 'done') {
      stageLights(LIT);
      return;
    }
    if (phase === 'wait') {
      stageLights(DARK);
      let live = true;
      const begin = () => {
        if (live) setPhase((p) => (p === 'wait' ? 'enter' : p));
      };
      const id = window.setTimeout(begin, ENTER_WAIT_MS);
      Promise.all([hero, left, right].map((r) => r.current?.ready)).then(begin, begin);
      return () => {
        live = false;
        clearTimeout(id);
      };
    }
    const ids = [
      window.setTimeout(() => stageLights(LIT), ENTER.lantern),
      window.setTimeout(() => hero.current?.greet(), ENTER.greet),
      window.setTimeout(() => {
        left.current?.wave();
        right.current?.wave();
      }, ENTER.wave),
      window.setTimeout(() => setPhase('done'), ENTER.done),
    ];
    return () => ids.forEach(clearTimeout);
  }, [phase]);

  return (
    <div class={`ob-body title ${phase}`} onPointerDown={phase === 'done' ? undefined : () => setPhase('done')}>
      <header class="title-head">
        <h1 class="wordmark" aria-label="ChargeGeist">
          Charge<b>Geist</b>
        </h1>
        <p class="title-claim">{t('ob_welcome_title')}</p>
      </header>
      <div class="title-cast">
        {FRIENDS.map((id, i) => (
          <CompanionStage key={id} ghostId={id} level={0.3} zoom={1} overscan={{ top: 0.3, side: 0.15, bottom: 0 }} class={`title-friend ${i ? 'right' : 'left'}`} apiRef={i ? right : left} />
        ))}
        <CompanionStage ghostId={DEFAULT_COMPANION} level={0.55} interactive zoom={1.02} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage title-hero" cheer={cheer} onPoke={() => sfx.poke()} apiRef={hero} attend={['.title-foot .btn']} ground />
        <div class="title-meadow" aria-hidden="true">
          <img class="m-left" src={SCENE_IMG('mushrooms_glow')} alt="" draggable={false} />
          <img class="m-right" src={SCENE_IMG('flowers_open')} alt="" draggable={false} />
          {FLIES.map(([x, y, d, dur], i) => (
            <i key={i} class={`fly ${y > 60 ? 'low' : ''}`} style={{ left: `${x}%`, top: `${y}px`, animationDelay: `${d}s`, animationDuration: `${dur}s` }} />
          ))}
        </div>
      </div>
      <div class="stack bottom-actions title-foot">
        <p class="title-fair">
          <Icon name="heart" size={15} /> {t('ob_welcome_fair')}
        </p>
        <Btn kind="primary" big onClick={onGo}>
          {t('ob_welcome_cta')}
        </Btn>
      </div>
    </div>
  );
}

function PostSteps() {
  const s = useAppState();
  const [step, setStep] = useState<'style' | 'remind' | 'plus'>('style');
  const [time, setTime] = useState(s.settings.reminderTime);
  const [cheer, setCheer] = useState(0);
  const who = s.companion;
  // the style from the first drop goes straight on
  const first = Object.entries(s.styles).sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  const target = sparkTarget(s);

  useEffect(() => {
    if (step !== 'style' || !first) return;
    wearStyle(who, first);
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

  return (
    <div class={`page onboarding ob-${step}`}>
      {step === 'style' && (
        <div class="ob-body" key="style">
          <CompanionStage ghostId={who} level={0.4} interactive zoom={1.15} overscan={{ top: 0.25, side: 0.1, bottom: 0 }} class="ob-stage" cheer={cheer} onPoke={() => sfx.poke()} ground />
          <h1 class="ob-title">{t('ob_style_title', { name: companionName(s, who) })}</h1>
          <p class="ob-text">{t('ob_style_body')}</p>
          {target && (
            <div class="ob-spark">
              <p class="spark-card-head">
                <Icon name="bolt" size={14} /> {t('ob_spark_head')}
              </p>
              <SparkMeter ghostId={target} />
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
            <Portrait id={s.companion} size={150} />
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
