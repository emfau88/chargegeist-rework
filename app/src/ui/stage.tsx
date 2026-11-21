import { useEffect, useRef, useState } from 'preact/hooks';
import { ghost } from '../data/catalog';
import { nameOf } from '../i18n';
import { createRig, renderPortrait } from '../rig/rig';
import { bondLevel } from '../logic/bond';
import { bondFromGesture, gestureFx, hugFx } from './gestureFx';
import type { RigApi, RigMode, RigOptions, RigStyle } from '../rig/rig';
import { bondOf, lookOf, useAppState } from '../state/store';

interface StageProps {
  ghostId: string;
  /** The style it shows; defaults to its saved style. */
  look?: RigStyle;
  mode?: RigMode;
  level?: number;
  ring?: number | null;
  interactive?: boolean;
  zoom?: number;
  overscan?: RigOptions['overscan'];
  shiftY?: number;
  onPoke?: () => void;
  /** A touch woke the sleeping companion. */
  onWake?: () => void;
  /** Things on the screen he looks at now and then (CSS selectors), such as the start button. */
  attend?: string[];
  /** Change this value to make the companion cheer. */
  cheer?: number;
  cheerBig?: boolean;
  class?: string;
  label?: string;
  apiRef?: { current: RigApi | null };
}

const styleKey = (o: RigStyle) => `${o.aura ?? ''},${o.shimmer ?? ''},${o.charm ?? ''}`;

/** Hosts a live companion rig. The rig itself is created once and steered through props. */
export function CompanionStage(p: StageProps) {
  const s = useAppState();
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<RigApi | null>(null);
  const poke = useRef(p.onPoke);
  poke.current = p.onPoke;
  const wake = useRef(p.onWake);
  wake.current = p.onWake;
  // the bond with this ghost: touches bring hearts, higher stages hug and high-five
  const bond = s.ghosts[p.ghostId] ? bondLevel(bondOf(s, p.ghostId)) : 0;
  const cur = useRef({ id: p.ghostId, bond });
  cur.current = { id: p.ghostId, bond };
  const look = p.look ?? lookOf(s, p.ghostId);
  const key = `${p.ghostId}|${styleKey(look)}`;
  const shown = useRef(key);

  useEffect(() => {
    const r = createRig(host.current!, { ghost: p.ghostId, style: look }, {
      interactive: p.interactive,
      zoom: p.zoom,
      overscan: p.overscan,
      shiftY: p.shiftY,
      onPoke: () => poke.current?.(),
      onWake: () => wake.current?.(),
      onGesture: p.interactive
        ? (g) => {
            gestureFx(g, cur.current.bond);
            bondFromGesture(cur.current.id, g);
          }
        : undefined,
      onHug: hugFx,
    });
    r.setBond(bond);
    rig.current = r;
    if (p.apiRef) p.apiRef.current = r;
    r.setMode(p.mode ?? 'idle');
    r.setLevel(p.level ?? 0, true);
    r.setRing(p.ring ?? null);
    return () => {
      r.destroy();
      rig.current = null;
      if (p.apiRef) p.apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    rig.current?.setLook({ ghost: p.ghostId, style: look });
  }, [key]);
  useEffect(() => rig.current?.setMode(p.mode ?? 'idle'), [p.mode]);
  useEffect(() => rig.current?.setBond(bond), [bond]);
  useEffect(() => rig.current?.setLevel(p.level ?? 0), [p.level]);
  useEffect(() => rig.current?.setRing(p.ring ?? null), [p.ring]);
  useEffect(() => {
    if (p.cheer) rig.current?.celebrate(p.cheerBig ?? true);
  }, [p.cheer]);
  const attend = p.attend?.join('|') ?? '';
  useEffect(() => {
    if (!attend) return;
    let id = 0;
    const plan = () => {
      id = window.setTimeout(() => {
        const seen = attend
          .split('|')
          .map((q) => document.querySelector(q)?.getBoundingClientRect())
          .filter((r): r is DOMRect => !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight);
        const r = seen[Math.floor(Math.random() * seen.length)];
        if (r && !document.hidden) rig.current?.glance(r.left + r.width / 2, r.top + r.height / 2);
        plan();
      }, 6000 + Math.random() * 7000);
    };
    plan();
    return () => clearTimeout(id);
  }, [attend]);

  return <div class={`stage ${p.class ?? ''}`} ref={host} role={p.label ? 'img' : undefined} aria-label={p.label} />;
}

const portraitCache = new Map<string, string>();
/** A still image of a ghost, as a data URL (cached). */
export function usePortrait(id: string, size = 256): string | null {
  const key = `${id}|${size}`;
  const [url, setUrl] = useState<string | null>(portraitCache.get(key) ?? null);
  useEffect(() => {
    if (portraitCache.has(key)) {
      setUrl(portraitCache.get(key)!);
      return;
    }
    let live = true;
    renderPortrait({ ghost: id }, size).then((cv) => {
      const u = cv.toDataURL('image/png');
      portraitCache.set(key, u);
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return url;
}

/** A still ghost. Costume ghosts you have not met yet show as a silhouette. */
export function Portrait({ id, size, silhouette, float, class: cls }: { id: string; size: number; silhouette?: boolean; float?: boolean; class?: string }) {
  const url = usePortrait(id, Math.round(size * 2));
  const c = `portrait ${silhouette ? 'sil' : ''} ${float ? 'float' : ''} ${cls ?? ''}`;
  return url ? (
    <img class={c} src={url} width={size} height={size} alt={silhouette ? '' : nameOf(ghost(id))} draggable={false} />
  ) : (
    <span class={c} style={{ width: `${size}px`, height: `${size}px` }} />
  );
}
