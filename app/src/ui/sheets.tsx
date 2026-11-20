import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  COMPANION_UNLOCK_HOURS,
  DROP_STYLES,
  GHOSTS,
  ODDS,
  RARITIES,
  RARITY_COLOR,
  STYLE_KINDS,
  WISH_COST,
  ghost,
  sparksNeeded,
  style,
  stylesOf,
  unlockOrder,
} from '../data/catalog';
import type { StyleKind } from '../data/types';
import { fmtDate, nameOf, quoteOf, t } from '../i18n';
import type { Key } from '../i18n';
import { playAmbient, sfx, stopAmbient } from '../platform/audio';
import { haptic } from '../platform/device';
import {
  TAGS,
  canUseStyle,
  claimWish,
  clearLook,
  companionName,
  lookOf,
  renameCompanion,
  setActiveCompanion,
  setSetting,
  setSparkTarget,
  setWish,
  sparkInfo,
  sparkTarget,
  toggleStyle,
  useAppState,
} from '../state/store';
import type { AmbientId, ClaimResult, State, TagId, ThemeId } from '../state/store';
import { Bar, Btn, Chip, Icon, RarityTag, Sheet, toast } from './kit';
import { BondCard } from './bond';
import { CompanionStage, Portrait } from './stage';
import { KindTag, SparkPips, SparkPortrait, StyleBadge, StylePreview } from './style';
import { THEMES } from './themes';

export const AMBIENTS: { id: AmbientId; plus: boolean; icon: string }[] = [
  { id: 'off', plus: false, icon: 'mute' },
  { id: 'rain', plus: false, icon: 'music' },
  { id: 'brown', plus: false, icon: 'music' },
  { id: 'fire', plus: true, icon: 'flame' },
  { id: 'forest', plus: true, icon: 'moon' },
  { id: 'ocean', plus: true, icon: 'music' },
  { id: 'cafe', plus: true, icon: 'cup' },
];

/** Toasts for a claimed wish. */
export function announce(r: ClaimResult) {
  toast(t('drop_kept', { name: nameOf(style(r.style)) }), { style: r.style });
  r.achievements.forEach((a) => toast(`${t(`ach_${a}` as Key)} · ${t('done_achievement')}`, { icon: 'trophy' }));
}

/** How a ghost you do not own yet comes to you. */
export function ghostUnlockText(s: State, id: string): string {
  const g = ghost(id);
  if (g.kind === 'companion') {
    const i = unlockOrder(s.firstCompanion).indexOf(id);
    return t('set_companions_locked', { n: COMPANION_UNLOCK_HOURS[i] ?? 0 });
  }
  return t('col_unlock_sparks', { need: sparksNeeded(id) });
}

/** A costume ghost's spark progress: filling silhouette, name, pips and count. */
export function SparkMeter({ ghostId, size = 52, onClick }: { ghostId: string; size?: number; onClick?: () => void }) {
  const s = useAppState();
  const g = ghost(ghostId);
  const sp = sparkInfo(s, ghostId);
  const target = sparkTarget(s) === ghostId;
  const body = (
    <>
      <SparkPortrait id={ghostId} size={size} have={sp.have} need={sp.need} />
      <span class="spark-meter-text">
        <b>{nameOf(g)}</b>
        <SparkPips have={sp.have} need={sp.need} />
        <small>
          {t('spark_count', { have: sp.have, need: sp.need })}
          {target && !s.ghosts[ghostId] ? ` · ${t('spark_charging')}` : ''}
        </small>
      </span>
    </>
  );
  const st = { '--cg': g.glow } as CSSProperties;
  return onClick ? (
    <button type="button" class="spark-meter" style={st} onClick={onClick}>
      {body}
      <Icon name="chevron" size={18} />
    </button>
  ) : (
    <div class="spark-meter" style={st}>
      {body}
    </div>
  );
}

/* ---------------- odds ---------------- */
export function OddsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('drop_odds_title')}>
      <p class="muted">{t('drop_odds_body')}</p>
      <div class="odds">
        {RARITIES.map((r) => (
          <div class="odds-row" key={r} style={{ '--rc': RARITY_COLOR[r] } as CSSProperties}>
            <RarityTag r={r} />
            <div class="odds-bar">
              <i style={{ width: `${ODDS[r]}%` }} />
            </div>
            <b>{ODDS[r]} %</b>
          </div>
        ))}
      </div>
      <ul class="bullets">
        <li>{t('drop_odds_spark')}</li>
        <li>{t('drop_odds_pity')}</li>
        <li>{t('drop_odds_new')}</li>
        <li>{t('drop_odds_money')}</li>
      </ul>
    </Sheet>
  );
}

/* ---------------- companion picker ---------------- */
export function CompanionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  // every ghost you own can charge with you; companions still to come show when they join
  const list = GHOSTS.filter((g) => s.ghosts[g.id] || g.kind === 'companion');
  return (
    <Sheet open={open} onClose={onClose} title={t('set_companion')}>
      <div class="comp-grid">
        {list.map((g) => {
          const have = !!s.ghosts[g.id];
          return (
            <button
              type="button"
              key={g.id}
              class={`comp-card ${s.companion === g.id ? 'active' : ''} ${have ? '' : 'locked'}`}
              style={{ '--cg': g.glow } as CSSProperties}
              disabled={!have}
              onClick={() => {
                haptic.tap();
                sfx.tap();
                setActiveCompanion(g.id);
              }}
            >
              <Portrait id={g.id} size={84} silhouette={!have} />
              <b>{have ? companionName(s, g.id) : nameOf(g)}</b>
              <small>{have ? (g.kind === 'costume' ? t('kind_costume') : ' ') : ghostUnlockText(s, g.id)}</small>
            </button>
          );
        })}
      </div>
      {editing ? (
        <form
          class="rename"
          onSubmit={(e) => {
            e.preventDefault();
            renameCompanion(editing, name);
            setEditing(null);
          }}
        >
          <input value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} aria-label={t('ob_name_label')} autoFocus />
          <Btn
            kind="primary"
            onClick={() => {
              renameCompanion(editing, name);
              setEditing(null);
            }}
          >
            {t('save')}
          </Btn>
        </form>
      ) : (
        <Btn
          kind="secondary"
          icon="edit"
          onClick={() => {
            setName(companionName(s));
            setEditing(s.companion);
          }}
        >
          {t('set_rename')} {companionName(s)}
        </Btn>
      )}
    </Sheet>
  );
}

/* ---------------- style ---------------- */
/** Pick a ghost, see it live, and choose its aura, shimmer and charm. */
export function StyleSheet({ open, onClose, ghostId, onPlus }: { open: boolean; onClose: () => void; ghostId?: string | null; onPlus?: () => void }) {
  const s = useAppState();
  const mine = GHOSTS.filter((g) => s.ghosts[g.id]);
  const [who, setWho] = useState(ghostId ?? s.companion);
  const [cheer, setCheer] = useState(0);
  const [kind, setKind] = useState<StyleKind>('aura');
  useEffect(() => {
    if (open) setWho(ghostId && s.ghosts[ghostId] ? ghostId : s.companion);
  }, [open, ghostId]);
  const look = lookOf(s, who);
  const anyOn = Object.keys(look).length > 0;
  const owned = DROP_STYLES.filter((x) => s.styles[x.id]);
  // one tab per kind that has something to show; the tab picked last stays open
  const lists = STYLE_KINDS.map((k) => ({ k, list: stylesOf(k).filter((x) => s.styles[x.id] || x.plus) })).filter((e) => e.list.length > 0);
  const cur = lists.find((e) => e.k === kind) ?? lists[0];
  return (
    <Sheet open={open} onClose={onClose} title={t('style_title')} class="style-sheet">
      {mine.length > 1 && (
        <div class="chips style-who" role="group" aria-label={t('style_who')}>
          {mine.map((g) => (
            <Chip key={g.id} active={who === g.id} onClick={() => setWho(g.id)}>
              {companionName(s, g.id)}
            </Chip>
          ))}
        </div>
      )}
      <div class="style-top">
        <div class="style-stage" style={{ '--cg': ghost(who).glow } as CSSProperties}>
          {open && <CompanionStage key={who} ghostId={who} level={0.35} interactive zoom={1.15} overscan={{ top: 0.18, side: 0.1, bottom: 0.02 }} cheer={cheer} cheerBig={false} onPoke={() => sfx.poke()} />}
        </div>
        {lists.length > 1 && (
          <div class="segments style-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${lists.length}, 1fr)` }}>
            {lists.map(({ k }) => (
              <button
                type="button"
                key={k}
                role="tab"
                aria-selected={cur?.k === k}
                class={`segment ${cur?.k === k ? 'active' : ''}`}
                onClick={() => {
                  haptic.tap();
                  setKind(k);
                }}
              >
                {t(`col_${k}s` as Key)}
                {look[k] && <i class="seg-on" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {owned.length === 0 && !s.plus && <p class="muted center">{t('style_empty')}</p>}
      {[cur].map((e) => {
        if (!e) return null;
        const { k, list } = e;
        return (
          <section class="style-row" key={k} role="tabpanel">
            {lists.length === 1 && <h3 class="sheet-sub">{t(`col_${k}s` as Key)}</h3>}
            <div class="style-grid">
              {list.map((x) => {
                const on = look[k] === x.id;
                const usable = canUseStyle(s, x.id);
                return (
                  <button
                    type="button"
                    key={x.id}
                    class={`style-pick ${on ? 'on' : ''} ${usable ? '' : 'locked'}`}
                    style={{ '--rc': RARITY_COLOR[x.rarity] } as CSSProperties}
                    aria-pressed={on}
                    aria-label={nameOf(x)}
                    onClick={() => {
                      haptic.tap();
                      if (!usable) {
                        onPlus?.();
                        return;
                      }
                      sfx.toggle();
                      toggleStyle(who, x.id);
                      if (!on) setCheer((c) => c + 1);
                    }}
                  >
                    <StyleBadge id={x.id} size={62} />
                    <small>{nameOf(x)}</small>
                    {on && (
                      <span class="style-check">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                    {!usable && (
                      <span class="style-lock">
                        <Icon name="crown" size={11} /> Plus
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p class="muted small center">{t('style_body')}</p>
      {anyOn && (
        <Btn kind="ghost" icon="restore" onClick={() => clearLook(who)}>
          {t('style_clear')}
        </Btn>
      )}
    </Sheet>
  );
}

/* ---------------- ambient ---------------- */
export function AmbientSheet({ open, onClose, onPlus, preview }: { open: boolean; onClose: () => void; onPlus: () => void; preview?: boolean }) {
  const s = useAppState();
  useEffect(() => {
    if (!open && preview) stopAmbient();
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={t('set_ambient')}>
      <div class="pick-list">
        {AMBIENTS.map((a) => {
          const locked = a.plus && !s.plus;
          return (
            <button
              type="button"
              key={a.id}
              class={`pick ${s.settings.ambient === a.id ? 'active' : ''}`}
              onClick={() => {
                haptic.tap();
                if (locked) {
                  onClose();
                  onPlus();
                  return;
                }
                setSetting('ambient', a.id);
                if (preview) playAmbient(a.id);
              }}
            >
              <Icon name={a.icon} size={20} />
              <span>{t(`amb_${a.id}`)}</span>
              {locked ? <span class="plus-tag">Plus</span> : s.settings.ambient === a.id ? <Icon name="check" size={18} /> : null}
            </button>
          );
        })}
      </div>
      <label class="slider">
        <span>{t('set_volume')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={s.settings.volume}
          onInput={(e) => setSetting('volume', Number((e.target as HTMLInputElement).value))}
        />
      </label>
    </Sheet>
  );
}

/* ---------------- theme ---------------- */
export function ThemeSheet({ open, onClose, onPlus }: { open: boolean; onClose: () => void; onPlus: () => void }) {
  const s = useAppState();
  return (
    <Sheet open={open} onClose={onClose} title={t('set_theme')}>
      <div class="theme-grid">
        {THEMES.map((th) => {
          const locked = th.plus && !s.plus;
          return (
            <button
              type="button"
              key={th.id}
              class={`theme-card ${s.settings.theme === th.id ? 'active' : ''}`}
              onClick={() => {
                haptic.tap();
                sfx.tap();
                if (locked) {
                  onClose();
                  onPlus();
                  return;
                }
                setSetting('theme', th.id as ThemeId);
              }}
            >
              <span class="theme-swatch" style={{ background: th.img ? `${th.veil}, url(${th.img}) center/cover, ${th.css}` : th.css }} />
              <span class="theme-name">
                {t(`th_${th.id}`)}
                {locked && <span class="plus-tag">Plus</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------------- duration ---------------- */
export function DurationSheet({ open, onClose, value, onPick }: { open: boolean; onClose: () => void; value: number; onPick: (n: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [open]);
  return (
    <Sheet open={open} onClose={onClose} title={t('home_minutes_picker')}>
      <div class="dur-big">
        <button type="button" class="icon-btn" aria-label="-5" onClick={() => setV((x) => Math.max(5, x - 5))}>
          <Icon name="minus" />
        </button>
        <b>{v}</b>
        <span>{t('min')}</span>
        <button type="button" class="icon-btn" aria-label="+5" onClick={() => setV((x) => Math.min(180, x + 5))}>
          <Icon name="plus" />
        </button>
      </div>
      <input class="dur-range" type="range" min="5" max="180" step="5" value={v} onInput={(e) => setV(Number((e.target as HTMLInputElement).value))} aria-label={t('home_minutes_picker')} />
      <div class="chips center">
        {[10, 20, 30, 45, 60, 90].map((n) => (
          <Chip key={n} active={v === n} onClick={() => setV(n)}>
            {n}
          </Chip>
        ))}
      </div>
      <Btn
        kind="primary"
        big
        onClick={() => {
          onPick(v);
          onClose();
        }}
      >
        {t('save')}
      </Btn>
    </Sheet>
  );
}

/* ---------------- tag ---------------- */
export function TagSheet({ open, onClose, value, onPick }: { open: boolean; onClose: () => void; value: TagId; onPick: (t: TagId) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('home_tag')}>
      <div class="chips">
        {TAGS.map((tg) => (
          <Chip
            key={tg}
            icon="tag"
            active={value === tg}
            onClick={() => {
              onPick(tg);
              onClose();
            }}
          >
            {t(`tag_${tg}`)}
          </Chip>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- wish ---------------- */
export function WishSheet({ open, onClose, onClaimed }: { open: boolean; onClose: () => void; onClaimed?: (r: ClaimResult) => void }) {
  const s = useAppState();
  const [choosing, setChoosing] = useState(false);
  useEffect(() => setChoosing(!s.wish.target), [open]);
  const target = s.wish.target ? style(s.wish.target) : null;
  const cost = target ? WISH_COST[target.rarity] : 0;
  const missing = DROP_STYLES.filter((i) => !s.styles[i.id]).sort((a, b) => WISH_COST[a.rarity] - WISH_COST[b.rarity]);
  return (
    <Sheet open={open} onClose={onClose} title={t('wish_title')}>
      <p class="muted">{t('wish_body')}</p>
      <div class="wish-energy">
        <Icon name="star" size={18} />
        <b>{t('wish_energy', { n: s.wish.energy })}</b>
      </div>
      {target && !choosing && (
        <div class="wish-target">
          {open && <StylePreview id={target.id} ghostId={s.companion} size={120} />}
          <div class="wish-target-info">
            <b>{nameOf(target)}</b>
            <span class="tag-row">
              <RarityTag r={target.rarity} />
              <KindTag id={target.id} />
            </span>
            <Bar value={s.wish.energy / cost} color={RARITY_COLOR[target.rarity]} />
            <small>
              {Math.min(s.wish.energy, cost)} / {cost}
              {s.wish.energy < cost ? ` · ${t('wish_need', { n: cost - s.wish.energy })}` : ''}
            </small>
          </div>
          <div class="wish-actions">
            <Btn
              kind="warm"
              icon="sparkle"
              disabled={s.wish.energy < cost}
              onClick={() => {
                const r = claimWish();
                if (r) {
                  sfx.unlock();
                  haptic.big();
                  announce(r);
                  onClaimed?.(r);
                  onClose();
                }
              }}
            >
              {t('wish_claim', { name: nameOf(target) })}
            </Btn>
            <Btn kind="ghost" onClick={() => setChoosing(true)}>
              {t('wish_change')}
            </Btn>
          </div>
        </div>
      )}
      {(choosing || !target) && (
        <>
          <h3 class="sheet-sub">{t('wish_choose')}</h3>
          {missing.length === 0 && <p>{t('wish_all')}</p>}
          <div class="wish-grid">
            {missing.map((i) => (
              <button
                type="button"
                key={i.id}
                class={`wish-pick ${s.wish.target === i.id ? 'active' : ''}`}
                style={{ '--rc': RARITY_COLOR[i.rarity] } as CSSProperties}
                onClick={() => {
                  haptic.tap();
                  sfx.tap();
                  setWish(i.id);
                  setChoosing(false);
                }}
              >
                <StyleBadge id={i.id} size={56} />
                <b>{nameOf(i)}</b>
                <small>{t('wish_cost', { n: WISH_COST[i.rarity] })}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------------- ghost detail ---------------- */
export function GhostSheet({ id, onClose, onStyle }: { id: string | null; onClose: () => void; onStyle: (ghostId: string) => void }) {
  const s = useAppState();
  const [last, setLast] = useState(id);
  useEffect(() => {
    if (id) setLast(id);
  }, [id]);
  const gid = id ?? last;
  if (!gid) return null;
  const g = ghost(gid);
  const rec = s.ghosts[gid];
  const accent = g.rarity ? RARITY_COLOR[g.rarity] : g.glow;
  const sp = sparkInfo(s, gid);
  const isTarget = sparkTarget(s) === gid;
  return (
    <Sheet open={!!id} onClose={onClose} class="ghost-sheet">
      <div class="ghost-hero" style={{ '--rc': accent, '--tint': g.glow } as CSSProperties}>
        <span class="ghost-hero-glow" />
        {rec && id ? (
          <CompanionStage ghostId={gid} level={0.3} interactive zoom={1.12} shiftY={14} overscan={{ top: 0.2, side: 0.1, bottom: 0.02 }} class="ghost-hero-stage" onPoke={() => sfx.poke()} />
        ) : g.kind === 'costume' ? (
          <SparkPortrait id={gid} size={210} have={sp.have} need={sp.need} class="float" />
        ) : (
          <Portrait id={gid} size={210} silhouette float />
        )}
      </div>
      <div class="ghost-meta">
        <h2>{rec ? companionName(s, gid) : nameOf(g)}</h2>
        <div class="ghost-tags">
          {g.rarity ? <RarityTag r={g.rarity} /> : null}
          <span class="set-tag" style={{ '--sc': g.glow } as CSSProperties}>
            {g.kind === 'companion' ? t('kind_companion') : t('kind_costume')}
          </span>
        </div>
        {rec ? (
          <>
            <blockquote>“{quoteOf(g)}”</blockquote>
            <p class="muted small">
              {t('col_joined', { date: fmtDate(rec.at) })} · {t(`col_via_${rec.via}`)}
            </p>
            <BondCard ghostId={gid} />
            <div class="stack">
              {s.companion === gid ? (
                <p class="ok-chip center-chip">
                  <Icon name="bolt" size={15} /> {t('col_is_companion')}
                </p>
              ) : (
                <Btn
                  kind="primary"
                  icon="bolt"
                  onClick={() => {
                    setActiveCompanion(gid);
                    sfx.unlock();
                    haptic.success();
                    onClose();
                  }}
                >
                  {t('col_make_companion', { name: companionName(s, gid) })}
                </Btn>
              )}
              <Btn kind="secondary" icon="palette" onClick={() => onStyle(gid)}>
                {t('style_title')}
              </Btn>
            </div>
          </>
        ) : g.kind === 'costume' ? (
          <>
            <div class="spark-detail" style={{ '--cg': g.glow } as CSSProperties}>
              <SparkPips have={sp.have} need={sp.need} size={20} />
              <b>{t('spark_count', { have: sp.have, need: sp.need })}</b>
              <small class="muted">{t('spark_hint')}</small>
            </div>
            {isTarget ? (
              <p class="ok-chip center-chip">
                <Icon name="bolt" size={15} /> {t('spark_is_target')}
              </p>
            ) : (
              <Btn
                kind="primary"
                icon="bolt"
                onClick={() => {
                  setSparkTarget(gid);
                  sfx.unlock();
                  haptic.success();
                }}
              >
                {t('spark_charge_this')}
              </Btn>
            )}
            <p class="muted small center">{t('col_unlock_boss')}</p>
          </>
        ) : (
          <p class="unlock-hint">
            <Icon name="lock" size={16} /> {ghostUnlockText(s, gid)}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- style detail ---------------- */
export function StyleItemSheet({ id, onClose, onWish, onStyle, onPlus }: { id: string | null; onClose: () => void; onWish: () => void; onStyle: (ghostId: string) => void; onPlus?: () => void }) {
  const s = useAppState();
  const [last, setLast] = useState(id);
  useEffect(() => {
    if (id) setLast(id);
  }, [id]);
  const sid = id ?? last;
  if (!sid) return null;
  const x = style(sid);
  const rec = s.styles[sid];
  const usable = canUseStyle(s, sid);
  const who = s.companion;
  const on = lookOf(s, who)[x.kind] === sid;
  return (
    <Sheet open={!!id} onClose={onClose} class="ghost-sheet item-sheet">
      <div class="ghost-hero" style={{ '--rc': RARITY_COLOR[x.rarity], '--tint': ghost(who).glow } as CSSProperties}>
        <span class="ghost-hero-glow" />
        {id && <CompanionStage ghostId={who} look={{ ...lookOf(s, who), [x.kind]: sid }} level={0.35} interactive zoom={1.12} shiftY={14} overscan={{ top: 0.2, side: 0.1, bottom: 0.02 }} class="ghost-hero-stage" onPoke={() => sfx.poke()} />}
      </div>
      <div class="ghost-meta">
        <h2>{nameOf(x)}</h2>
        <div class="ghost-tags">
          <RarityTag r={x.rarity} />
          <KindTag id={sid} />
        </div>
        <p class="muted small">{t(`col_${x.kind}s_hint` as Key)}</p>
        {usable ? (
          <>
            {rec && (
              <p class="muted small">
                {t('col_found', { date: fmtDate(rec.at) })} · {t(`col_via_${rec.via}`)}
              </p>
            )}
            <div class="stack">
              <Btn
                kind={on ? 'secondary' : 'primary'}
                icon={on ? 'close' : 'palette'}
                onClick={() => {
                  toggleStyle(who, sid);
                  sfx.toggle();
                  haptic.tap();
                }}
              >
                {on ? t('style_off', { name: companionName(s, who) }) : t('style_on', { name: companionName(s, who) })}
              </Btn>
              <Btn kind="ghost" icon="palette" onClick={() => onStyle(who)}>
                {t('style_open')}
              </Btn>
            </div>
          </>
        ) : x.plus ? (
          <Btn kind="warm" icon="crown" onClick={() => onPlus?.()}>
            {t('col_style_plus')}
          </Btn>
        ) : s.wish.target === sid ? (
          <p class="unlock-hint">
            <Icon name="star" size={16} /> {t('col_is_wish')}
          </p>
        ) : (
          <Btn
            kind="secondary"
            icon="star"
            onClick={() => {
              setWish(sid);
              onClose();
              onWish();
            }}
          >
            {t('col_make_wish')}
          </Btn>
        )}
      </div>
    </Sheet>
  );
}
