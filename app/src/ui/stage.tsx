import { useEffect, useRef, useState } from 'preact/hooks';
import { ghost } from '../data/catalog';
import { nameOf } from '../i18n';
import { createRig, renderPortrait } from '../rig/rig';
import type { RigApi, RigMode, RigOptions, RigStyle } from '../rig/rig';
import { lookOf, useAppState } from '../state/store';

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
    });
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
  useEffect(() => rig.current?.setLevel(p.level ?? 0), [p.level]);
  useEffect(() => rig.current?.setRing(p.ring ?? null), [p.ring]);
  useEffect(() => {
    if (p.cheer) rig.current?.celebrate(p.cheerBig ?? true);
  }, [p.cheer]);

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
