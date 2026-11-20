/**
 * Small views of style and sparks: a live or frozen preview of an aura, shimmer or charm, a badge for lists,
 * and the charge view of a costume ghost (its silhouette fills up with every spark).
 */
import type { CSSProperties } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { RARITY_COLOR, charmImg, ghost, style } from '../data/catalog';
import { AuraSim, SvgAura } from '../fx/aura';
import type { AuraBox } from '../fx/aura';
import { rgbCss, shimmerMoves, shimmerRgb, shimmerSwatch } from '../fx/shimmer';
import type { Rgb } from '../fx/shimmer';
import { nameOf, t } from '../i18n';
import { mulberry32 } from '../logic/drops';
import { Icon } from './kit';
import { usePortrait } from './stage';

/* ---------- one shared animation loop for all previews ---------- */
type Tick = (dt: number, time: number) => void;
const ticks = new Set<Tick>();
let raf = 0,
  last = 0,
  clock = 0;
function loop(n: number) {
  const dt = Math.min(0.05, Math.max(0, (n - last) / 1000));
  last = n;
  clock += dt;
  ticks.forEach((f) => f(dt, clock));
  raf = ticks.size ? requestAnimationFrame(loop) : 0;
}
function addTick(f: Tick) {
  ticks.add(f);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  return () => {
    ticks.delete(f);
  };
}
/** Runs f every frame while the element is on screen. */
function useVisibleTick(ref: { current: Element | null }, f: Tick | null, deps: unknown[]) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !f) return;
    let stop: (() => void) | null = null;
    const io = new IntersectionObserver((es) => {
      const on = es.some((e) => e.isIntersecting);
      if (on && !stop) stop = addTick(f);
      if (!on && stop) {
        stop();
        stop = null;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      stop?.();
    };
  }, deps);
}

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function hexRgb(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const BOX = (glow: Rgb): AuraBox => ({ cx: 300, cy: 310, rx: 150, ry: 190, glow });
// without a ghost the preview zooms in on a small orb, so particles stay readable on small cards
const ORB_BOX = (glow: Rgb): AuraBox => ({ cx: 300, cy: 300, rx: 100, ry: 100, glow });

/**
 * A style shown around a ghost (or around a soft orb when ghostId is null).
 * live: animated while visible; otherwise one frozen frame.
 */
export function StylePreview({ id, ghostId, size, live = true, class: cls }: { id: string; ghostId: string | null; size: number; live?: boolean; class?: string }) {
  const st = style(id);
  const ref = useRef<SVGSVGElement>(null);
  const url = usePortrait(ghostId ?? 'volti', 320);
  const base = ghostId ? ghost(ghostId).glow : RARITY_COLOR[st.rarity];
  const uid = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current;
  const orb = !ghostId;
  const charm = st.kind === 'charm';
  const scale = orb ? 1 : 0.9;
  // a charm floats beside the left shoulder on a ghost, or fills the orb on its own
  const charmBox = orb ? 220 : 128;
  const charmAt = orb ? [300, 300] : [126, 186];
  const ringR = orb ? 128 : 235;

  // auras
  const auraRef = useRef<{ sim: AuraSim; svg: SvgAura } | null>(null);
  useEffect(() => {
    if (st.kind !== 'aura') return;
    const svg = ref.current!;
    const back = svg.querySelector('[data-k="back"]') as SVGGElement;
    const front = svg.querySelector('[data-k="front"]') as SVGGElement;
    back.replaceChildren();
    front.replaceChildren();
    const sim = new AuraSim(id, live ? Math.random : mulberry32(id.length * 97 + 7), reduce());
    // without a ghost the preview is small: bigger particles keep it readable
    const r = new SvgAura(back, front, orb ? (size < 70 ? 2.1 : 1.6) : 1);
    const glow = hexRgb(base);
    r.setGlow(glow);
    const box = orb ? ORB_BOX(glow) : BOX(glow);
    // warm up, so the preview never starts empty
    for (let i = 0; i < 60; i++) sim.step(0.05, box);
    r.sync(sim);
    auraRef.current = { sim, svg: r };
    return () => {
      sim.clear();
      auraRef.current = null;
    };
  }, [id, ghostId, live, size]);
  useVisibleTick(
    ref,
    live && st.kind === 'aura'
      ? (dt) => {
          const a = auraRef.current;
          if (!a) return;
          const glow = hexRgb(base);
          a.sim.step(dt, orb ? ORB_BOX(glow) : BOX(glow));
          a.svg.sync(a.sim);
        }
      : null,
    [id, ghostId, live],
  );

  // shimmers
  const paint = (time: number) => {
    const svg = ref.current;
    if (!svg) return;
    const c = rgbCss(shimmerRgb(id, base, time));
    svg.querySelectorAll('[data-k="sh"]').forEach((e) => e.setAttribute('stop-color', c));
    svg.querySelectorAll('[data-k="ring"]').forEach((e) => e.setAttribute('stroke', c));
  };
  useEffect(() => {
    if (st.kind === 'shimmer') paint(1.3);
  }, [id, ghostId]);
  useVisibleTick(ref, live && st.kind === 'shimmer' && shimmerMoves(id) ? (_dt, time) => paint(time) : null, [id, ghostId, live]);

  const ringC = 2 * Math.PI * ringR;
  return (
    <svg ref={ref} class={`style-preview ${cls ?? ''}`} viewBox={orb ? '125 125 350 350' : '0 0 600 600'} width={size} height={size} role="img" aria-label={nameOf(st)}>
      <defs>
        <radialGradient id={`${uid}g`}>
          <stop data-k="sh" offset="0" stop-color={base} stop-opacity={st.kind === 'shimmer' ? 0.85 : 0.45} />
          <stop data-k="sh" offset="0.45" stop-color={base} stop-opacity={st.kind === 'shimmer' ? 0.32 : 0.12} />
          <stop data-k="sh" offset="1" stop-color={base} stop-opacity="0" />
        </radialGradient>
        {charm && (
          <radialGradient id={`${uid}c`}>
            <stop offset="0" stop-color={RARITY_COLOR[st.rarity]} stop-opacity="0.55" />
            <stop offset="1" stop-color={RARITY_COLOR[st.rarity]} stop-opacity="0" />
          </radialGradient>
        )}
      </defs>
      <g transform={`translate(300 300) scale(${scale}) translate(-300 -300)`}>
        <circle cx="300" cy="300" r={orb ? 175 : 290} fill={`url(#${uid}g)`} opacity={charm && !orb ? 0.6 : 1} />
        {st.kind === 'shimmer' && (
          <g transform="rotate(-90 300 300)">
            <circle cx="300" cy="300" r={ringR} fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width={orb ? 10 : 12} />
            <circle data-k="ring" cx="300" cy="300" r={ringR} fill="none" stroke={base} stroke-width={orb ? 10 : 12} stroke-linecap="round" stroke-dasharray={`${ringC * 0.72} ${ringC}`} />
          </g>
        )}
        <g data-k="back" />
        {orb ? (
          !charm && <circle cx="300" cy="300" r="58" fill={`url(#${uid}g)`} opacity={st.kind === 'shimmer' ? 1 : 0.9} />
        ) : (
          url && <image href={url} x="74" y="54" width="453" height="453" />
        )}
        <g data-k="front" />
        {charm && (
          <g transform={`translate(${charmAt[0]} ${charmAt[1]})`}>
            <g class={live && !reduce() ? 'charm-bob' : undefined}>
              {!orb && <circle r={charmBox * 0.62} fill={`url(#${uid}c)`} />}
              <image href={charmImg(id)} x={-charmBox / 2} y={-charmBox / 2} width={charmBox} height={charmBox} preserveAspectRatio="xMidYMid meet" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}

/** A small, still badge for a style: in lists, toasts and wish cards. */
export function StyleBadge({ id, size }: { id: string; size: number }) {
  const st = style(id);
  return (
    <span class={`style-badge k-${st.kind}`} style={{ width: `${size}px`, height: `${size}px`, '--rc': RARITY_COLOR[st.rarity], '--sw': st.kind === 'shimmer' ? shimmerSwatch(id) : undefined } as CSSProperties}>
      {st.kind === 'shimmer' ? <i class="swatch" /> : <StylePreview id={id} ghostId={null} size={size} live={false} />}
    </span>
  );
}

/** The kind of a style, as a small label. */
export function KindTag({ id }: { id: string }) {
  const k = style(id).kind;
  return (
    <span class={`kind-tag k-${k}`}>
      <Icon name={k === 'aura' ? 'sparkle' : k === 'shimmer' ? 'palette' : 'star'} size={13} /> {t(`kind_${k}`)}
    </span>
  );
}

/** A costume ghost as a silhouette that fills up from the bottom with every spark. */
export function SparkPortrait({ id, size, have, need, class: cls }: { id: string; size: number; have: number; need: number; class?: string }) {
  const url = usePortrait(id, Math.round(size * 2));
  const f = need ? Math.min(1, have / need) : 1;
  // the ghost body sits roughly between 12 % and 88 % of the portrait
  const top = 88 - f * 76;
  return (
    <span
      class={`spark-portrait ${f >= 1 ? 'full' : f <= 0 ? 'empty' : ''} ${cls ?? ''}`}
      style={{ width: `${size}px`, height: `${size}px`, '--cg': ghost(id).glow, '--top': `${top}%`, '--f': f } as CSSProperties}
    >
      {url && (
        <>
          <img class="sp-sil" src={url} alt="" draggable={false} />
          <img class="sp-fill" src={url} alt="" draggable={false} />
          {f > 0 && f < 1 && <i class="sp-edge" style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` } as CSSProperties} />}
        </>
      )}
    </span>
  );
}

/** Spark pips: one per spark the ghost needs, filled for the ones it has. */
export function SparkPips({ have, need, size = 14 }: { have: number; need: number; size?: number }) {
  return (
    <span class="spark-pips" role="img" aria-label={t('spark_count', { have, need })}>
      {Array.from({ length: need }, (_, i) => (
        <i key={i} class={i < have ? 'on' : ''}>
          <Icon name="bolt" size={size} />
        </i>
      ))}
    </span>
  );
}
