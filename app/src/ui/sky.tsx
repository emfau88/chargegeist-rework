/**
 * The living sky behind every screen: the time of day on the default sky, two slow fog veils,
 * now and then a shooting star, and a soft glow for the moment (focus, a waiting drop, a finished
 * session). Everything moves with CSS transform and opacity only; nothing moves when it is off.
 */
import type { CSSProperties } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { skyOpacities, skyWeights, starAlpha } from '../logic/sky';
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

function useStars(n: number, seed0: number, maxY: number) {
  return useMemo(() => {
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: n }, () => ({ x: rnd() * 100, y: rnd() * maxY, r: 0.6 + rnd() * 1.3 }));
  }, []);
}

/**
 * Stars in three layers that twinkle out of step. Each layer fades as a whole, which the GPU does
 * on its own; fading every star by itself would cost the main thread on every frame.
 */
function Stars({ n, seed, maxY, opacity, cls }: { n: number; seed: number; maxY: number; opacity: number; cls?: string }) {
  const stars = useStars(n, seed, maxY);
  return (
    <div class={`stars ${cls ?? ''}`} style={{ opacity }}>
      {[0, 1, 2].map((k) => (
        <svg key={k} class={`star-layer tw-${k}`} viewBox="0 0 100 100" preserveAspectRatio="none">
          {stars
            .filter((_, i) => i % 3 === k)
            .map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} />
            ))}
        </svg>
      ))}
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
}

export function Sky({ timeOfDay, stars, moving, mood, glow, hour }: SkyProps) {
  const h = useHour(hour);
  const w = timeOfDay ? skyWeights(h) : { morning: 0, day: 0, evening: 0, night: 1 };
  const o = skyOpacities(w);
  const sa = starAlpha(w);
  const star = useShootingStar(moving && sa > 0.3);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const f = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  return (
    <div class={`sky ${moving ? 'moving' : 'still'} ${hidden ? 'paused' : ''}`} style={{ '--sky-glow': glow } as CSSProperties} aria-hidden="true">
      {timeOfDay && (
        <>
          <div class="sky-layer sky-morning" style={{ opacity: o.morning }} />
          <div class="sky-layer sky-day" style={{ opacity: o.day }} />
          <div class="sky-layer sky-evening" style={{ opacity: o.evening }} />
        </>
      )}
      {stars && <Stars n={70} seed={7} maxY={70} opacity={sa} />}
      {stars && timeOfDay && <Stars n={55} seed={23} maxY={85} opacity={Math.max(0, w.night - 0.2) / 0.8} cls="more" />}
      {moving && (
        <>
          <div class="fog fog-a" />
          <div class="fog fog-b" />
        </>
      )}
      {star && <i class="shoot" key={star.key} style={{ left: `${star.x}%`, top: `${star.y}%`, '--a': `${star.a}deg` } as CSSProperties} />}
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
