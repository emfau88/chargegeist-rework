/**
 * The living sky behind every screen: the time of day on the default sky, two slow fog veils,
 * now and then a shooting star, and a soft glow for the moment (focus, a waiting drop, a finished
 * session). Everything moves with CSS transform and opacity only; nothing moves when it is off.
 */
import type { CSSProperties } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SCENE, SCENE_PROPS } from '../data/scene.gen';
import { GROUND_LINE, SCROLL_RATE, groundY, onGround, scenePlace } from '../fx/ground';
import type { SceneLit } from '../fx/ground';
import { setSceneLight } from '../fx/light';
import { moonPhase, moonPlace, orbAlpha, skyLight, skyOpacities, skyWeights, starAlpha, sunPlace } from '../logic/sky';
import { now } from '../state/store';

export type SkyMood = 'idle' | 'focus' | 'drop' | 'done';

/** Whether the device asks for less motion (follows changes while the app runs). */
export function useReducedMotion(): boolean {
  const q = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [r, setR] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const f = () => setR(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return r;
}

/** Most stars are tiny, some are medium, and a few are bright ones with a glint. */
function useStars(n: number, seed0: number, maxY: number) {
  return useMemo(() => {
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: n }, () => {
      const size = rnd();
      const r = size < 0.7 ? 0.5 + rnd() * 0.4 : size < 0.94 ? 1 + rnd() * 0.5 : 1.6 + rnd() * 0.5;
      return { x: rnd() * 100, y: rnd() * maxY, r, bright: size >= 0.95, warm: rnd() < 0.18 };
    });
  }, []);
}

/**
 * Stars in three layers that twinkle out of step. Each layer fades as a whole, which the GPU does
 * on its own; fading every star by itself would cost the main thread on every frame.
 * Positions are a share of the sky and sizes are pixels, so stars stay round on every screen.
 */
function Stars({ n, seed, maxY, opacity, cls }: { n: number; seed: number; maxY: number; opacity: number; cls?: string }) {
  const stars = useStars(n, seed, maxY);
  return (
    <div class={`stars ${cls ?? ''}`} style={{ opacity }}>
      {[0, 1, 2].map((k) => (
        <svg key={k} class={`star-layer tw-${k}`}>
          {stars
            .filter((_, i) => i % 3 === k)
            .map((s, i) =>
              s.bright ? (
                <svg key={i} x={`${s.x}%`} y={`${s.y}%`} overflow="visible">
                  <circle class="halo" r={s.r * 3} />
                  <path class="glint" d="M0,-6 L0.7,-0.7 L6,0 L0.7,0.7 L0,6 L-0.7,0.7 L-6,0 L-0.7,-0.7Z" transform={`scale(${(s.r / 2.1).toFixed(2)})`} />
                  <circle r={s.r * 0.7} />
                </svg>
              ) : (
                <circle key={i} class={s.warm ? 'warm' : undefined} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} />
              ),
            )}
        </svg>
      ))}
    </div>
  );
}

/** The lit side of the moon for a phase (0 new, 0.5 full): the right limb plus the terminator. */
function moonLit(phase: number, r: number): { d: string; flip: boolean } {
  const waning = phase > 0.5;
  // always leave a slim crescent, so the night sky keeps its moon
  const p = Math.max(0.07, waning ? 1 - phase : phase);
  const k = Math.cos(2 * Math.PI * p);
  return { d: `M0,${-r} A${r},${r} 0 0 1 0,${r} A${(Math.abs(k) * r).toFixed(2)},${r} 0 0 ${k > 0 ? 0 : 1} 0,${-r}Z`, flip: waning };
}

/** After this many pixels of scrolling, sun and moon are gone; on the way they rise a little. */
const ORB_FADE_PX = 90;
const ORB_RISE = 0.3;

/**
 * Sun and moon cross the sky with the hour; the moon shows the phase of the real one.
 * The sky is fixed to the screen while the page scrolls over it. Left alone, sun and moon would
 * stay put while the ghost and the headings move up, and end up behind a line of text. So they
 * leave as the page scrolls and are back at the top.
 */
function Orbs({ hour }: { hour: number }) {
  const sun = sunPlace(hour);
  const moon = moonPlace(hour);
  const lit = useMemo(() => moonLit(moonPhase(now()), 26), []);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const el = box.current;
      if (!el) return;
      const y = Math.max(0, window.scrollY);
      // opacity and transform only: the browser moves them without laying out the page again
      el.style.opacity = String(Math.max(0, 1 - y / ORB_FADE_PX));
      el.style.transform = `translate3d(0, ${(-Math.min(y, ORB_FADE_PX) * ORB_RISE).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div class="sky-orbs" ref={box}>
      {sun && <i class="sky-sun" style={{ left: `${sun.x * 100}%`, top: `${sun.y * 100}%`, opacity: orbAlpha(sun.alt), '--low': (1 - sun.alt).toFixed(3) } as CSSProperties} />}
      {moon && (
        <svg class="sky-moon" viewBox="-60 -60 120 120" style={{ left: `${moon.x * 100}%`, top: `${moon.y * 100}%`, opacity: orbAlpha(moon.alt) }}>
          <defs>
            <radialGradient id="cg-moon-halo">
              <stop offset="0.4" stop-color="#cfd2ff" stop-opacity="0.34" />
              <stop offset="1" stop-color="#cfd2ff" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="cg-moon-face" cx="0.4" cy="0.35" r="0.75">
              <stop offset="0" stop-color="#fffdf4" />
              <stop offset="0.7" stop-color="#ece8ff" />
              <stop offset="1" stop-color="#cdc7f2" />
            </radialGradient>
          </defs>
          <circle r="60" fill="url(#cg-moon-halo)" />
          <circle r="26" fill="#b9b6ee" opacity="0.14" />
          <g transform={lit.flip ? 'scale(-1,1)' : undefined}>
            <path d={lit.d} fill="url(#cg-moon-face)" />
          </g>
        </svg>
      )}
    </div>
  );
}

// One tile of the land, 400 wide. Every ridge starts and ends level, so the tiles join without a kink,
// and reaches one unit past each side, so no hairline shows between two tiles.
const HILL_FAR = 'M-1,80 H0 C25,80 40,40 75,40 S150,120 200,120 S280,30 325,30 S375,80 400,80 H401 V440 H-1Z';
const HILL_MID = 'M-1,150 H0 C30,150 60,120 100,128 S165,190 205,190 S270,140 300,132 S370,150 400,150 H401 V440 H-1Z';
const PINES = 'M48,140 l7,-28 l7,28Z M62,138 l8,-36 l8,36Z M82,136 l6,-24 l6,24Z M282,142 l6,-24 l6,24Z M296,140 l8,-36 l8,36Z M316,142 l7,-28 l7,28Z';
const HILL_NEAR = 'M-1,215 H0 C30,215 70,205 100,225 S160,268 200,268 S270,245 300,225 S370,215 400,215 H401 V440 H-1Z';
const TILES = [-3, -2, -1, 0, 1, 2, 3];

/**
 * The land under the sky: a valley between three ridges of hills with a few pines. The hills are high
 * at the sides and low in the middle, so the ghost floats over the valley and sun and moon rise and
 * set behind them. The tile repeats sideways, so the land keeps its shape on any width.
 * A glow in the valley lifts the ridges out of the sky; it takes the colour of the time of day.
 */
function Horizon({ glow }: { glow: { morning: number; day: number; evening: number } }) {
  return (
    <div class="horizon">
      <i class="hz-glow night" />
      <i class="hz-glow morning" style={{ opacity: glow.morning }} />
      <i class="hz-glow day" style={{ opacity: glow.day }} />
      <i class="hz-glow evening" style={{ opacity: glow.evening }} />
      <svg viewBox="0 0 400 440" preserveAspectRatio="xMidYMax meet" overflow="visible">
        {(['far', 'mid', 'near'] as const).map((layer) => (
          <g key={layer} class={`hill ${layer}`}>
            {TILES.map((k) => (
              <path key={k} transform={`translate(${k * 400} 0)`} d={layer === 'far' ? HILL_FAR : layer === 'mid' ? `${HILL_MID} ${PINES}` : HILL_NEAR} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

const SCENE_URL = (name: string) => `${import.meta.env.BASE_URL}assets/scene/${name}.webp`;
const LAYERS = ['far', 'mid', 'ground'] as const;
/** Things that stand in the scene: where their foot is on the canvas (x of the middle, y of the lower edge) and how large they are drawn. */
const LANTERNS = [
  { off: 'lantern_hang_off', on: 'lantern_hang_on', x: 96, y: 742, k: 0.44, lit: 'first' },
  { off: 'lantern_stand_off', on: 'lantern_stand_on', x: 884, y: GROUND_LINE + 14, k: 0.4, lit: 'goal' },
] as const;

let sceneLoad: Promise<boolean> | null = null;
/** The pictures of the scene, loaded once. False when one of them does not come: then the drawn hills stay. */
function loadScene(): Promise<boolean> {
  sceneLoad ??= Promise.all(
    [...LAYERS, ...LANTERNS.flatMap((l) => [l.off, l.on])].map(
      (n) =>
        new Promise<boolean>((res) => {
          const im = new Image();
          im.onload = () => res(true);
          im.onerror = () => res(false);
          im.src = SCENE_URL(n);
        }),
    ),
  ).then((all) => all.every(Boolean));
  return sceneLoad;
}

/**
 * The painted land: far mountains, hills, and in front a clearing between firs. It hangs so that the
 * clearing lies under the shadow of the ghost on the screen (see fx/ground.ts); without one it rests
 * low. The ground goes along as the page scrolls, the land behind it lags a little. Two lanterns
 * stand in it: the first burns once there was focus today, the second when the daily goal is reached.
 */
function Scene({ glow, lit }: { glow: { morning: number; day: number; evening: number }; lit: SceneLit }) {
  const [state, setState] = useState<'wait' | 'ok' | 'none'>('wait');
  const root = useRef<HTMLDivElement>(null);
  const parts = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    let live = true;
    loadScene().then((ok) => live && setState(ok ? 'ok' : 'none'));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (state !== 'ok') return;
    const el = root.current!;
    let raf = 0;
    let first = true;
    const place = () => {
      const p = scenePlace(window.innerWidth, window.innerHeight, groundY());
      el.style.setProperty('--sc-s', p.scale.toFixed(5));
      el.style.setProperty('--sc-top', `${p.top}px`);
      el.style.setProperty('--sc-gtop', `${p.groundTop}px`);
      el.classList.toggle('rest', groundY() === null);
      onScroll();
      if (first) {
        // the first place is taken at once; from then on the land glides to where the next ghost stands
        first = false;
        requestAnimationFrame(() => el.classList.add('glide'));
      }
    };
    const scroll = () => {
      raf = 0;
      // at rest the hills stand still behind the page, as a far horizon does
      const y = groundY() === null ? 0 : Math.max(0, window.scrollY);
      for (const n of LAYERS) {
        const e = parts.current[n];
        if (e) e.style.transform = `translate3d(0, ${(-y * SCROLL_RATE[n]).toFixed(1)}px, 0)`;
      }
    };
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(scroll);
    }
    place();
    scroll();
    const off = onGround(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      off();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [state]);

  if (state === 'none') return <Horizon glow={glow} />;
  return (
    <div class={`scene ${state === 'ok' ? 'on' : ''}`} ref={root} style={{ '--sc-w': `${SCENE.w}px`, '--sc-h': `${SCENE.h}px`, '--sc-end': SCENE.ground.bottom } as CSSProperties}>
      <div class="scene-glow">
        <i class="hz-glow night" />
        <i class="hz-glow morning" style={{ opacity: glow.morning }} />
        <i class="hz-glow day" style={{ opacity: glow.day }} />
        <i class="hz-glow evening" style={{ opacity: glow.evening }} />
      </div>
      <div
        class="scene-move scene-far"
        ref={(e) => {
          parts.current.far = e;
        }}
      >
        <div class="scene-layer" style={{ backgroundImage: `url(${SCENE_URL('far')})` }} />
      </div>
      <div
        class="scene-move"
        ref={(e) => {
          parts.current.mid = e;
        }}
      >
        <div class="scene-layer" style={{ backgroundImage: `url(${SCENE_URL('mid')})` }} />
      </div>
      <div
        class="scene-move scene-ground"
        ref={(e) => {
          parts.current.ground = e;
        }}
      >
        <div class="scene-layer" style={{ backgroundImage: `url(${SCENE_URL('ground')})` }} />
        <div class="scene-end" />
        <div class="scene-props">
          {LANTERNS.map((l) => {
            const [w, h] = SCENE_PROPS[l.off];
            const on = lit[l.lit];
            return (
              <div key={l.off} class={`scene-prop ${on ? 'lit' : ''}`} style={{ '--px': l.x, '--py': l.y, '--pw': w * l.k, '--ph': h * l.k } as CSSProperties}>
                <i class="pool" />
                <img src={SCENE_URL(l.off)} alt="" draggable={false} />
                <img class="glowing" src={SCENE_URL(l.on)} alt="" draggable={false} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The fractional hour now, checked once a minute. */
function useHour(fixed: number | null | undefined): number {
  const read = () => {
    const d = new Date(now());
    return d.getHours() + d.getMinutes() / 60;
  };
  const [h, setH] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setH(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return fixed ?? h;
}

/** A shooting star every 25 to 45 seconds while the sky is dark enough and the app is in front. */
function useShootingStar(on: boolean): { key: number; x: number; y: number; a: number } | null {
  const [star, setStar] = useState<{ key: number; x: number; y: number; a: number } | null>(null);
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const fire = () => setStar({ key: Date.now(), x: 8 + Math.random() * 60, y: 4 + Math.random() * 30, a: 18 + Math.random() * 20 });
    const plan = () => {
      id = window.setTimeout(() => {
        if (!document.hidden) fire();
        plan();
      }, 25_000 + Math.random() * 20_000);
    };
    plan();
    // the preview tools can ask for one right away
    window.addEventListener('cg:shoot', fire);
    return () => {
      clearTimeout(id);
      window.removeEventListener('cg:shoot', fire);
    };
  }, [on]);
  return on ? star : null;
}

export interface SkyProps {
  /** The default sky follows the time of day; theme pictures keep their own look. */
  timeOfDay: boolean;
  stars: boolean;
  moving: boolean;
  mood: SkyMood;
  /** The companion's colour, for the focus glow. */
  glow: string;
  /** A fixed hour for previews (dev tools). */
  hour?: number | null;
  /** Sun and moon show where the sky is the stage. Behind screens full of cards they would shine through, and a focus session stays calm. */
  orbs?: boolean;
  /** What the day has lit in the painted scene (see fx/ground.ts). */
  lit?: SceneLit;
}

const DARK: SceneLit = { first: false, goal: false };

export function Sky({ timeOfDay, stars, moving, mood, glow, hour, orbs = true, lit = DARK }: SkyProps) {
  const h = useHour(hour);
  const w = timeOfDay ? skyWeights(h) : { morning: 0, day: 0, evening: 0, night: 1 };
  const o = skyOpacities(w);
  const sa = starAlpha(w);
  const star = useShootingStar(moving && sa > 0.3);
  // the ghosts pick up the light of this sky; a theme picture has no sun, so its light is neutral
  useEffect(() => setSceneLight(timeOfDay ? skyLight(h) : null), [timeOfDay, h]);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const f = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  return (
    <div class={`sky ${moving ? 'moving' : 'still'} ${hidden ? 'paused' : ''} ${orbs ? '' : 'orbs-off'}`} style={{ '--sky-glow': glow } as CSSProperties} aria-hidden="true">
      {timeOfDay && (
        <>
          <div class="sky-layer sky-morning" style={{ opacity: o.morning }} />
          <div class="sky-layer sky-day" style={{ opacity: o.day }} />
          <div class="sky-layer sky-evening" style={{ opacity: o.evening }} />
        </>
      )}
      {stars && <Stars n={70} seed={7} maxY={70} opacity={sa} />}
      {stars && timeOfDay && <Stars n={55} seed={23} maxY={85} opacity={Math.max(0, w.night - 0.2) / 0.8} cls="more" />}
      {timeOfDay && <Orbs hour={h} />}
      {moving && (
        <>
          <div class="fog fog-a" />
          <div class="fog fog-b" />
        </>
      )}
      {star && <i class="shoot" key={star.key} style={{ left: `${star.x}%`, top: `${star.y}%`, '--a': `${star.a}deg` } as CSSProperties} />}
      {timeOfDay && <Scene glow={o} lit={lit} />}
      <div class={`sky-mood mood-${mood}`} />
      {mood === 'done' && moving && <SparkRain />}
    </div>
  );
}

/** A short rain of sparks after a session. */
function SparkRain() {
  const drops = useMemo(
    () => Array.from({ length: 34 }, () => ({ x: Math.random() * 100, d: Math.random() * 1.4, t: 1.8 + Math.random() * 1.2, s: 3 + Math.random() * 3.5 })),
    [],
  );
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setOn(false), 4800);
    return () => clearTimeout(id);
  }, []);
  if (!on) return null;
  return (
    <div class="spark-rain">
      {drops.map((p, i) => (
        <i key={i} style={{ left: `${p.x}%`, width: `${p.s}px`, height: `${p.s}px`, animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} />
      ))}
    </div>
  );
}
