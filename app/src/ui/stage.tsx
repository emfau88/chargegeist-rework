import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ghost } from '../data/catalog';
import { nameOf } from '../i18n';
import { createRig, renderPortrait } from '../rig/rig';
import { bondLevel } from '../logic/bond';
import { bondFromGesture, gestureFx, hugFx } from './gestureFx';
import { setGround } from '../fx/ground';
import type { RigApi, RigMode, RigOptions, RigStyle } from '../rig/rig';
import type { ActName } from '../rig/acts';
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
  /** Things on the screen he looks at now and then (CSS selectors), such as the start button. The first one matters most: he looks at it first and most often. */
  attend?: string[];
  /** His little acts at rest; false where he should stay calm (focus, break). */
  acts?: boolean;
  /** It is late: now and then he yawns. */
  tired?: boolean;
  /** A reaction: change n to make him show it (a nod, pride). */
  react?: { act: ActName; n: number };
  /** Change this value to make the companion cheer. */
  cheer?: number;
  cheerBig?: boolean;
  class?: string;
  label?: string;
  apiRef?: { current: RigApi | null };
  /** He floats in front of the open sky: the painted scene puts its clearing under his shadow. */
  ground?: boolean;
  /** false: no shadow under him. */
  shadow?: boolean;
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

  // The canvas is there before the first frame. Added a frame later, it made the phone split what it had drawn
  // into new layers, and an Android WebView showed one frame with holes in it: the style sheet flickered.
  useLayoutEffect(() => {
    const r = createRig(host.current!, { ghost: p.ghostId, style: look }, {
      interactive: p.interactive,
      zoom: p.zoom,
      overscan: p.overscan,
      shiftY: p.shiftY,
      showShadow: p.shadow,
      onPoke: () => poke.current?.(),
      onWake: () => wake.current?.(),
      onGesture: p.interactive
        ? (g) => {
            gestureFx(g, cur.current.bond);
            bondFromGesture(cur.current.id, g);
          }
        : undefined,
      onHug: hugFx,
      idleActs: p.acts,
      tired: p.tired,
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
  useEffect(() => {
    if (!p.ground) return;
    const who = {};
    const tell = () => {
      const r = rig.current;
      if (r && host.current?.isConnected) setGround(who, r.groundY() + window.scrollY);
    };
    tell();
    // the stage moves when something above it comes or goes (a waiting drop), which no observer of its own size sees
    const id = window.setInterval(tell, 400);
    const ro = new ResizeObserver(tell);
    ro.observe(host.current!);
    window.addEventListener('resize', tell);
    return () => {
      clearInterval(id);
      ro.disconnect();
      window.removeEventListener('resize', tell);
      setGround(who, null);
    };
  }, [p.ground]);
  useEffect(() => rig.current?.setMode(p.mode ?? 'idle'), [p.mode]);
  useEffect(() => rig.current?.setBond(bond), [bond]);
  useEffect(() => rig.current?.setLevel(p.level ?? 0), [p.level]);
  useEffect(() => rig.current?.setRing(p.ring ?? null), [p.ring]);
  useEffect(() => {
    if (p.cheer) rig.current?.celebrate(p.cheerBig ?? true);
  }, [p.cheer]);
  useEffect(() => {
    if (p.react?.n) rig.current?.act(p.react.act);
  }, [p.react?.n]);
  const attend = p.attend?.join('|') ?? '';
  useEffect(() => {
    if (!attend) return;
    let id = 0;
    // the first look comes soon, so a waiting drop gets noticed; after that now and then
    const plan = (wait: number) => {
      id = window.setTimeout(() => {
        const seen = attend
          .split('|')
          .map((q) => document.querySelector(q)?.getBoundingClientRect())
          .filter((r): r is DOMRect => !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight);
        // what matters most comes first in the list and draws most of his looks
        const r = seen.length > 1 && Math.random() < 0.7 ? seen[0] : seen[Math.floor(Math.random() * seen.length)];
        if (r && !document.hidden) rig.current?.glance(r.left + r.width / 2, r.top + r.height / 2);
        plan(6000 + Math.random() * 7000);
      }, wait);
    };
    plan(2400 + Math.random() * 1200);
    return () => clearTimeout(id);
  }, [attend]);

  return <div class={`stage ${p.class ?? ''}`} ref={host} role={p.label ? 'img' : undefined} aria-label={p.label} />;
}

const portraitCache = new Map<string, string>();
const portraitWork = new Map<string, Promise<string>>();
let portraitLine: Promise<unknown> = Promise.resolve();
/**
 * Paints a portrait and gives its address. Portraits are painted one after the other, with a breath in
 * between, and packed into a picture file away from the main thread: a screen full of them (the collection
 * shows twenty) painted all at once held the app for a quarter of a second when it opened.
 */
function paintPortrait(id: string, size: number): Promise<string> {
  const key = `${id}|${size}`;
  let work = portraitWork.get(key);
  if (!work) {
    const paint = async () => {
      const cv = await renderPortrait({ ghost: id }, size);
      const blob = typeof cv.toBlob === 'function' ? await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png')) : null;
      const url = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png');
      portraitCache.set(key, url);
      await new Promise((res) => setTimeout(res));
      return url;
    };
    work = portraitLine.then(paint, paint);
    portraitLine = work.catch(() => {});
    portraitWork.set(key, work);
  }
  return work;
}
/** A still image of a ghost, as the address of a picture (cached for as long as the app runs). */
export function usePortrait(id: string, size = 256): string | null {
  const key = `${id}|${size}`;
  const [url, setUrl] = useState<string | null>(portraitCache.get(key) ?? null);
  useEffect(() => {
    if (portraitCache.has(key)) {
      setUrl(portraitCache.get(key)!);
      return;
    }
    let live = true;
    paintPortrait(id, size).then(
      (u) => live && setUrl(u),
      () => {},
    );
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
