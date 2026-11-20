import { useEffect, useMemo, useState } from 'preact/hooks';
import { lang, t } from './i18n';
import { setFx } from './platform/audio';
import { haptic } from './platform/device';
import { Collection } from './screens/Collection';
import { Break, Complete } from './screens/Complete';
import { Drop } from './screens/Drop';
import { Focus } from './screens/Focus';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Plus } from './screens/Plus';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { useAppState } from './state/store';
import type { SessionResult } from './state/store';
import { BondUpHost } from './ui/bond';
import { Icon, Toasts } from './ui/kit';
import { theme } from './ui/themes';

type Tab = 'focus' | 'ghosts' | 'progress' | 'settings';
type Overlay = { k: 'complete'; res: SessionResult } | { k: 'drop'; id: string } | { k: 'break' } | null;

const TABS: { id: Tab; icon: string; label: 'tab_focus' | 'tab_ghosts' | 'tab_progress' | 'tab_settings' }[] = [
  { id: 'focus', icon: 'bolt', label: 'tab_focus' },
  { id: 'ghosts', icon: 'ghost', label: 'tab_ghosts' },
  { id: 'progress', icon: 'chart', label: 'tab_progress' },
  { id: 'settings', icon: 'sliders', label: 'tab_settings' },
];

function Stars() {
  const stars = useMemo(() => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 70 }, () => ({ x: rnd() * 100, y: rnd() * 70, r: 0.6 + rnd() * 1.3, d: -rnd() * 4 }));
  }, []);
  return (
    <svg class="stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} style={{ animationDelay: `${s.d}s` }} />
      ))}
    </svg>
  );
}

export function App() {
  const s = useAppState();
  const [tab, setTab] = useState<Tab>('focus');
  const [ov, setOv] = useState<Overlay>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => setFx(s.settings.sound), [s.settings.sound]);
  useEffect(() => {
    document.documentElement.lang = lang();
    document.title = 'ChargeGeist';
  }, [s.settings.lang]);

  const th = theme(s.plus || !theme(s.settings.theme).plus ? s.settings.theme : 'night');
  const openPlus = () => setPlusOpen(true);
  const openDrop = (id: string) => setOv({ k: 'drop', id });
  const firstPending = s.pending.find((p) => p.kind === 'first');

  let key: string;
  let content;
  let tabs = false;
  if (plusOpen) {
    key = 'plus';
    content = <Plus onClose={() => setPlusOpen(false)} />;
  } else if (s.active) {
    key = 'focus-run';
    content = <Focus onDone={(res) => setOv(res ? { k: 'complete', res } : null)} openPlus={openPlus} />;
  } else if (ov?.k === 'complete') {
    key = 'complete';
    content = <Complete res={ov.res} onDrop={openDrop} onBreak={() => setOv({ k: 'break' })} onClose={() => setOv(null)} />;
  } else if (ov?.k === 'drop') {
    key = `drop-${ov.id}`;
    content = <Drop id={ov.id} onClose={() => setOv(null)} />;
  } else if (ov?.k === 'break') {
    key = 'break';
    content = <Break onClose={() => setOv(null)} />;
  } else if (!s.onboarded && firstPending) {
    key = `drop-${firstPending.id}`;
    content = <Drop id={firstPending.id} onClose={() => setOv(null)} />;
  } else if (!s.onboarded) {
    key = 'onboarding';
    content = <Onboarding openDrop={openDrop} />;
  } else {
    tabs = true;
    key = `tab-${tab}`;
    content =
      tab === 'focus' ? (
        <Home openDrop={openDrop} openPlus={openPlus} />
      ) : tab === 'ghosts' ? (
        <Collection openPlus={openPlus} />
      ) : tab === 'progress' ? (
        <Progress openPlus={openPlus} />
      ) : (
        <Settings openPlus={openPlus} />
      );
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);

  const unseen = [...Object.values(s.ghosts), ...Object.values(s.styles)].filter((r) => !r.seen).length;
  const bg = th.img ? `${th.veil}, url(${th.img}) center / cover no-repeat, ${th.css}` : th.css;

  return (
    <div class={`app ${s.active ? 'is-focus' : ''} ${tabs ? 'has-tabs' : ''}`}>
      <div class="bg" style={{ background: bg }}>
        {th.stars && <Stars />}
      </div>
      <main class="shell">
        <div class="screen" key={key}>
          {content}
        </div>
      </main>
      {tabs && (
        <nav class="tabbar" aria-label="ChargeGeist">
          {TABS.map((x) => (
            <button
              type="button"
              key={x.id}
              class={`tab ${tab === x.id ? 'active' : ''}`}
              aria-current={tab === x.id ? 'page' : undefined}
              onClick={() => {
                haptic.tap();
                setTab(x.id);
              }}
            >
              <span class="tab-icon">
                <Icon name={x.icon} size={23} />
                {x.id === 'focus' && s.pending.length > 0 && <i class="badge-dot" />}
                {x.id === 'ghosts' && unseen > 0 && <i class="badge-num">{unseen}</i>}
              </span>
              <span class="tab-label">{t(x.label)}</span>
            </button>
          ))}
        </nav>
      )}
      <BondUpHost active={tabs && !plusOpen} />
      <Toasts />
    </div>
  );
}
