import type { CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { COMPANIONS, DEFAULT_COMPANION, ghost } from '../data/catalog';
import { stageLights } from '../fx/ground';
import { nameOf, quoteOf, t } from '../i18n';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import type { RigApi } from '../rig/rig';
import { beginWith } from '../state/store';
import { Btn, Icon } from '../ui/kit';
import { useReducedMotion } from '../ui/sky';
import { CompanionStage } from '../ui/stage';

/** The starters as they stand on the title screen at first: left, in front, right. The one in front is the one you start with. */
const OTHERS = COMPANIONS.filter((c) => c.starter && c.id !== DEFAULT_COMPANION).map((c) => c.id);
const FIRST_ORDER = [OTHERS[0], DEFAULT_COMPANION, OTHERS[1]];
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

/**
 * The whole onboarding is one screen: the title, on which you pick the ghost you start with. From there
 * the first drop opens as a welcome gift and the app is yours. Tags, the daily goal and everything else
 * have good first values and are in the settings.
 */
export function Onboarding({ openDrop }: { openDrop: (id: string) => void }) {
  return (
    <div class="page onboarding">
      <Title
        onGo={(id) => {
          const gift = beginWith(id);
          if (gift) openDrop(gift);
        }}
      />
    </div>
  );
}

/**
 * The name of the app over the clearing, with the three starters on it and a lantern lit. The ghost in
 * front is your pick; a tap on one of the others, or on an arrow beside the name, brings that one forward.
 * It opens with a short entrance; a tap anywhere ends that at once, and with reduced motion the finished
 * picture is there from the start.
 */
function Title({ onGo }: { onGo: (id: string) => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'wait' | 'enter' | 'done'>(() => (reduce ? 'done' : 'wait'));
  const [order, setOrder] = useState(FIRST_ORDER);
  const [cheer, setCheer] = useState(0);
  const hero = useRef<RigApi | null>(null);
  const left = useRef<RigApi | null>(null);
  const right = useRef<RigApi | null>(null);
  const pick = ghost(order[1]);

  /** The ghost on that side comes forward, the one in front takes its place. */
  const choose = (side: 0 | 2) => {
    haptic.tap();
    sfx.tap();
    setOrder((o) => {
      const n = [...o];
      [n[1], n[side]] = [n[side], n[1]];
      return n;
    });
    setCheer((c) => c + 1);
  };

  // the lantern is this screen's while it shows
  useEffect(() => () => stageLights(null), []);
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

  const side = (i: 0 | 2) => (
    <button type="button" class={`title-pick ${i ? 'right' : 'left'}`} aria-label={t('ob_pick_choose', { name: nameOf(ghost(order[i])) })} onClick={() => choose(i)} />
  );
  return (
    <div class={`ob-body title ${phase}`} style={{ '--cg': pick.glow } as CSSProperties} onPointerDown={phase === 'done' ? undefined : () => setPhase('done')}>
      <header class="title-head">
        <h1 class="wordmark" aria-label="ChargeGeist">
          Charge<b>Geist</b>
        </h1>
        <p class="title-claim">{t('ob_welcome_title')}</p>
      </header>
      <div class="title-cast">
        <CompanionStage ghostId={order[0]} level={0.3} zoom={1} overscan={{ top: 0.3, side: 0.15, bottom: 0 }} class="title-friend left" apiRef={left} />
        <CompanionStage ghostId={order[2]} level={0.3} zoom={1} overscan={{ top: 0.3, side: 0.15, bottom: 0 }} class="title-friend right" apiRef={right} />
        <CompanionStage
          ghostId={order[1]}
          level={0.55}
          interactive
          zoom={1.02}
          overscan={{ top: 0.25, side: 0.1, bottom: 0 }}
          class="ob-stage title-hero"
          cheer={cheer}
          cheerBig={false}
          onPoke={() => sfx.poke()}
          apiRef={hero}
          attend={['.title-foot .btn']}
          ground
        />
        {side(0)}
        {side(2)}
        <div class="title-meadow" aria-hidden="true">
          <img class="m-left" src={SCENE_IMG('mushrooms_glow')} alt="" draggable={false} />
          <img class="m-right" src={SCENE_IMG('flowers_open')} alt="" draggable={false} />
          {FLIES.map(([x, y, d, dur], i) => (
            <i key={i} class={`fly ${y > 60 ? 'low' : ''}`} style={{ left: `${x}%`, top: `${y}px`, animationDelay: `${d}s`, animationDuration: `${dur}s` }} />
          ))}
        </div>
        {/* who is in front, said in words: the pick, with a way to change it */}
        <div class="title-plate" aria-live="polite">
          <small>{t('ob_pick_eyebrow')}</small>
          <div class="title-plate-row">
            <button type="button" class="title-arrow" aria-label={t('ob_pick_choose', { name: nameOf(ghost(order[0])) })} onClick={() => choose(0)}>
              <Icon name="chevron" size={18} class="flip" />
            </button>
            <b key={pick.id}>{nameOf(pick)}</b>
            <button type="button" class="title-arrow" aria-label={t('ob_pick_choose', { name: nameOf(ghost(order[2])) })} onClick={() => choose(2)}>
              <Icon name="chevron" size={18} />
            </button>
          </div>
          <p class="title-quote" key={pick.id}>
            “{quoteOf(pick)}”
          </p>
        </div>
      </div>
      <div class="stack bottom-actions title-foot">
        <p class="title-fair">
          <Icon name="heart" size={15} /> {t('ob_welcome_fair')}
        </p>
        <Btn kind="primary" big onClick={() => onGo(pick.id)}>
          {t('ob_go', { name: nameOf(pick) })}
        </Btn>
      </div>
    </div>
  );
}
