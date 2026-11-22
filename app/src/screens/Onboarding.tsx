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
import { CompanionStage, Portrait } from '../ui/stage';

/** The ghosts to choose from, the first starter first. */
const STARTERS = [DEFAULT_COMPANION, ...COMPANIONS.filter((c) => c.starter && c.id !== DEFAULT_COMPANION).map((c) => c.id)];
/**
 * The entrance of the first screen, in ms from its start: the clearing lies dark, the two lanterns light
 * up one after the other, the ghost floats in and says hello, then the words, the choice and the button
 * come. The parts themselves are timed in CSS (.title.enter in styles.css) on the same beat.
 */
const ENTER = { lantern: 250, lantern2: 800, greet: 1500, done: 2700 };
const DARK = { first: false, goal: false };
const ONE = { first: true, goal: false };
const LIT = { first: true, goal: true };
/** The entrance waits for the ghost to load, at most this long. */
const ENTER_WAIT_MS = 1800;

/**
 * The whole onboarding is one screen with one job: pick the ghost you start with. From there the first
 * drop opens as a welcome gift and the app is yours. Tags, the daily goal and everything else have good
 * first values and are in the settings.
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
 * The name of the app, the question, and one ghost large on the clearing: the one that is picked. Under
 * it the three to choose from, as round portraits; a tap on one brings it onto the clearing. The screen
 * opens with a short entrance; a tap anywhere ends that at once, and with reduced motion the finished
 * picture is there from the start.
 */
function Title({ onGo }: { onGo: (id: string) => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'wait' | 'enter' | 'done'>(() => (reduce ? 'done' : 'wait'));
  const [pick, setPick] = useState(DEFAULT_COMPANION);
  const [cheer, setCheer] = useState(0);
  const hero = useRef<RigApi | null>(null);
  const g = ghost(pick);

  const choose = (id: string) => {
    if (id === pick) return;
    haptic.tap();
    sfx.tap();
    setPick(id);
    setCheer((c) => c + 1);
  };

  // the lanterns are this screen's while it shows
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
      Promise.resolve(hero.current?.ready).then(begin, begin);
      return () => {
        live = false;
        clearTimeout(id);
      };
    }
    const ids = [
      window.setTimeout(() => stageLights(ONE), ENTER.lantern),
      window.setTimeout(() => stageLights(LIT), ENTER.lantern2),
      window.setTimeout(() => hero.current?.greet(), ENTER.greet),
      window.setTimeout(() => setPhase('done'), ENTER.done),
    ];
    return () => ids.forEach(clearTimeout);
  }, [phase]);

  return (
    <div class={`ob-body title ${phase}`} style={{ '--cg': g.glow } as CSSProperties} onPointerDown={phase === 'done' ? undefined : () => setPhase('done')}>
      <header class="title-head">
        <p class="wordmark" aria-label="ChargeGeist">
          Charge<b>Geist</b>
        </p>
        <h1>{t('ob_pick_title')}</h1>
        <p class="title-sub">{t('ob_pick_body')}</p>
      </header>
      <CompanionStage
        ghostId={pick}
        level={0.55}
        interactive
        zoom={1.2}
        overscan={{ top: 0.25, side: 0.1, bottom: 0 }}
        class="ob-stage title-hero"
        cheer={cheer}
        cheerBig={false}
        onPoke={() => sfx.poke()}
        apiRef={hero}
        attend={['.title-foot .btn', '.pick-chip.on']}
        label={nameOf(g)}
        ground
      />
      <div class="pick-row" role="radiogroup" aria-label={t('ob_pick_title')}>
        {STARTERS.map((id) => {
          const c = ghost(id);
          return (
            <button type="button" key={id} role="radio" aria-checked={id === pick} class={`pick-chip ${id === pick ? 'on' : ''}`} style={{ '--cg': c.glow } as CSSProperties} onClick={() => choose(id)}>
              <span class="pick-face">
                <Portrait id={id} size={72} />
              </span>
              <b>{nameOf(c)}</b>
            </button>
          );
        })}
      </div>
      <p class="pick-quote" key={pick}>
        “{quoteOf(g)}”
      </p>
      <div class="stack bottom-actions title-foot">
        <Btn kind="primary" big onClick={() => onGo(pick)}>
          {t('ob_go', { name: nameOf(g) })}
        </Btn>
        <p class="title-fair">
          <Icon name="heart" size={14} /> {t('ob_welcome_fair')}
        </p>
      </div>
    </div>
  );
}
