import type { ComponentChildren, CSSProperties, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RARITY_COLOR } from '../data/catalog';
import type { Rarity } from '../data/types';
import { t } from '../i18n';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import { Portrait } from './stage';
import { StyleBadge } from './style';

/* ---------------- icons ---------------- */
const P: Record<string, JSX.Element> = {
  bolt: <path d="M13.2 2.5 4.8 13.6h6.4l-1 7.9 8.5-11.4h-6.5l1-7.6z" fill="currentColor" stroke="none" />,
  ghost: (
    <>
      <path d="M12 3.2a7 7 0 0 0-7 7v10.3l2.3-1.6 2.4 1.6 2.3-1.6 2.3 1.6 2.4-1.6 2.3 1.6V10.2a7 7 0 0 0-7-7z" />
      <circle cx="9.6" cy="10.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="10.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  chart: <path d="M5 20v-7M10 20V5M15 20v-9M20 20v-4" />,
  sliders: (
    <>
      <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
      <circle cx="15" cy="6.5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </>
  ),
  play: <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.2-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sparkle: <path d="M12 3c.6 4.3 1.8 5.5 6 6.1-4.2.6-5.4 1.8-6 6.1-.6-4.3-1.8-5.5-6-6.1 4.2-.6 5.4-1.8 6-6.1zM18.5 15.5c.3 1.8.8 2.3 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.2 2.2-.7 2.5-2.5z" fill="currentColor" stroke="none" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  sound: <path d="M4 9.8v4.4h3.6l4.9 4.1V5.7L7.6 9.8H4zM16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2" />,
  mute: <path d="M4 9.8v4.4h3.6l4.9 4.1V5.7L7.6 9.8H4zM16.5 9.5l5 5M21.5 9.5l-5 5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.8h.01" />
    </>
  ),
  share: <path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 13.5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  crown: <path d="M3.5 8.5l4.4 3.8L12 5.5l4.1 6.8 4.4-3.8-1.9 10H5.4l-1.9-10z" />,
  gift: (
    <>
      <path d="M4.5 11.5h15v8.5h-15zM3.5 7.5h17v4h-17zM12 7.5V20" />
      <path d="M12 7.5c-1.4-2.8-5-3.4-5-1.3 0 1.4 2.6 1.3 5 1.3zm0 0c1.4-2.8 5-3.4 5-1.3 0 1.4-2.6 1.3-5 1.3z" />
    </>
  ),
  star: <path d="M12 3.4l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" />,
  flame: <path d="M12 3c.6 3.4 5 5.2 5 10a5 5 0 0 1-10 0c0-2 .9-3.4 2-4.3.2 1.6 1 2.6 2.1 2.8C10.6 9 10.8 5.6 12 3z" />,
  tag: (
    <>
      <path d="M20 12.6 12.6 20a1.4 1.4 0 0 1-2 0L3.5 12.9V3.5h9.4l7.1 7.1a1.4 1.4 0 0 1 0 2z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.5-1.2-2.7 0-1 .8-1.6 1.8-1.6h2.2a3.9 3.9 0 0 0 3.9-3.9C20.5 6.8 16.7 3.5 12 3.5z" />
      <circle cx="7.6" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V5.8l10-2.3v11.8" />
      <circle cx="6.8" cy="17.6" r="2.3" />
      <circle cx="16.8" cy="15.4" r="2.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.4 5.3 3.4 8.5s-1 6-3.4 8.5c-2.4-2.5-3.4-5.3-3.4-8.5s1-6 3.4-8.5z" />
    </>
  ),
  bell: <path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.8 1.8H4.7zM10 20.5a2 2 0 0 0 4 0" />,
  shield: <path d="M12 3.5 5 6.2v5.3c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6.2z" />,
  trash: <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />,
  restore: <path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4M4.5 4.5v4h4" />,
  wand: <path d="M4 20 15 9M14 4.5v2M19.5 10h-2M17.5 6.5 16 8M10.5 6.5 12 8M17.5 13.5 16 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  edit: <path d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16.5z" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z" />,
  moon: <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" />,
  cup: <path d="M5 8.5h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  hanger: <path d="M12 8.2V7a2.3 2.3 0 1 0-2.3-2.3M12 8.2 3.6 14.6a1.4 1.4 0 0 0 .9 2.5h15a1.4 1.4 0 0 0 .9-2.5z" />,
  trophy: (
    <>
      <path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0zM12 14v3.5M8.5 20h7M7.5 6.5H4.8a2.6 2.6 0 0 0 2.9 3.6M16.5 6.5h2.7a2.6 2.6 0 0 1-2.9 3.6" />
    </>
  ),
};

export function Icon({ name, size = 22, class: cls }: { name: string; size?: number; class?: string }) {
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}

/* ---------------- buttons ---------------- */
interface BtnProps {
  kind?: 'primary' | 'secondary' | 'ghost' | 'warm' | 'danger';
  icon?: string;
  onClick?: () => void;
  children?: ComponentChildren;
  disabled?: boolean;
  class?: string;
  big?: boolean;
  label?: string;
}
export function Btn({ kind = 'primary', icon, onClick, children, disabled, class: cls, big, label }: BtnProps) {
  return (
    <button
      type="button"
      class={`btn btn-${kind} ${big ? 'btn-big' : ''} ${cls ?? ''}`}
      disabled={disabled}
      aria-label={label}
      onClick={() => {
        haptic.tap();
        sfx.tap();
        onClick?.();
      }}
    >
      {icon && <Icon name={icon} size={big ? 22 : 19} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, class: cls }: { icon: string; label: string; onClick: () => void; class?: string }) {
  return (
    <button
      type="button"
      class={`icon-btn ${cls ?? ''}`}
      aria-label={label}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      class={`toggle ${on ? 'on' : ''}`}
      onClick={() => {
        haptic.tap();
        sfx.toggle();
        onChange(!on);
      }}
    >
      <i />
    </button>
  );
}

export function Chip({ active, onClick, children, icon, locked }: { active?: boolean; onClick?: () => void; children: ComponentChildren; icon?: string; locked?: boolean }) {
  return (
    <button
      type="button"
      class={`chip ${active ? 'active' : ''}`}
      aria-pressed={active}
      onClick={() => {
        haptic.tap();
        sfx.tap();
        onClick?.();
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
      {locked && <Icon name="lock" size={13} class="chip-lock" />}
    </button>
  );
}

/* ---------------- bars, rings, numbers ---------------- */
export function Bar({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  return (
    <div class={`bar ${thin ? 'thin' : ''}`} role="presentation">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/** Counts from `from` up to `target`. It waits until `run` is set; `jump` puts it at the end at once. */
export function useCountUp(target: number, ms = 900, from = 0, run = true, jump = false): number {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!run) return;
    if (jump || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, jump]);
  return v;
}

export function RarityTag({ r }: { r: Rarity }) {
  return (
    <span class="rarity" style={{ '--rc': RARITY_COLOR[r] } as CSSProperties}>
      {t(`r_${r}`)}
    </span>
  );
}

/* ---------------- sheet ---------------- */
export function Sheet({ open, onClose, title, children, class: cls }: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren; class?: string }) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setShown(true);
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
      const id = setTimeout(() => {
        setShown(false);
        setLeaving(false);
      }, 220);
      return () => clearTimeout(id);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!shown) return null;
  return (
    <div class={`sheet-root ${leaving ? 'leaving' : ''}`}>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class={`sheet ${cls ?? ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <div class="sheet-grab" />
        {title && (
          <header class="sheet-head">
            <h2>{title}</h2>
            <IconBtn icon="close" label={t('close')} onClick={onClose} />
          </header>
        )}
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- toasts ---------------- */
interface ToastItem {
  id: number;
  text: string;
  ghost?: string;
  style?: string;
  icon?: string;
}
let toastSeq = 0;
let toastList: ToastItem[] = [];
const toastSubs = new Set<() => void>();
export function toast(text: string, opts: { ghost?: string; style?: string; icon?: string } = {}) {
  const item = { id: ++toastSeq, text, ...opts };
  toastList = [...toastList, item];
  toastSubs.forEach((f) => f());
  setTimeout(() => {
    toastList = toastList.filter((x) => x.id !== item.id);
    toastSubs.forEach((f) => f());
  }, 3600);
}
export function Toasts() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    toastSubs.add(f);
    return () => {
      toastSubs.delete(f);
    };
  }, []);
  return (
    <div class="toasts" aria-live="polite">
      {toastList.map((x) => (
        <div class="toast" key={x.id}>
          {x.ghost ? <Portrait id={x.ghost} size={36} /> : x.style ? <StyleBadge id={x.style} size={34} /> : <Icon name={x.icon ?? 'sparkle'} size={20} />}
          <span>{x.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- list rows ---------------- */
export function Row({ icon, label, value, onClick, children, hint }: { icon?: string; label: string; value?: ComponentChildren; onClick?: () => void; children?: ComponentChildren; hint?: string }) {
  const inner = (
    <>
      {icon && (
        <span class="row-icon">
          <Icon name={icon} size={19} />
        </span>
      )}
      <span class="row-text">
        <span class="row-label">{label}</span>
        {hint && <span class="row-hint">{hint}</span>}
      </span>
      {value !== undefined && <span class="row-value">{value}</span>}
      {children}
      {onClick && <Icon name="chevron" size={18} class="row-chev" />}
    </>
  );
  return onClick ? (
    <button
      type="button"
      class="row"
      onClick={() => {
        haptic.tap();
        sfx.tap();
        onClick();
      }}
    >
      {inner}
    </button>
  ) : (
    <div class="row">{inner}</div>
  );
}
