import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  COMPANION_UNLOCK_HOURS,
  GHOSTS,
  ITEMS,
  ODDS,
  RARITIES,
  RARITY_COLOR,
  WISH_COST,
  canWear,
  ghost,
  item,
  setOf,
  unlockOrder,
} from '../data/catalog';
import { fmtDate, nameOf, quoteOf, t } from '../i18n';
import type { Key } from '../i18n';
import { playAmbient, sfx, stopAmbient } from '../platform/audio';
import { haptic } from '../platform/device';
import {
  TAGS,
  claimWish,
  clearOutfit,
  companionName,
  dresser,
  outfitOf,
  renameCompanion,
  setActiveCompanion,
  setSetting,
  setWish,
  toggleItem,
  useAppState,
  wearItem,
} from '../state/store';
import type { AmbientId, ClaimResult, State, TagId, ThemeId } from '../state/store';
import { Bar, Btn, Chip, Icon, ItemImg, RarityTag, Sheet, toast } from './kit';
import { CompanionStage, Portrait } from './stage';
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

/** Toasts for everything a new piece brought along. */
export function announce(r: { item: string; ghostJoined: string | null; achievements: string[] }) {
  toast(t('drop_kept', { name: nameOf(item(r.item)) }), { item: r.item });
  if (r.ghostJoined) toast(t('drop_ghost_joined', { name: nameOf(ghost(r.ghostJoined)) }), { ghost: r.ghostJoined });
  r.achievements.forEach((a) => toast(`${t(`ach_${a}` as Key)} · ${t('done_achievement')}`, { icon: 'trophy' }));
}

/** How a ghost you do not own yet comes to you. */
export function ghostUnlockText(s: State, id: string): string {
  const g = ghost(id);
  if (g.kind === 'companion') {
    const i = unlockOrder(s.firstCompanion).indexOf(id);
    return t('set_companions_locked', { n: COMPANION_UNLOCK_HOURS[i] ?? 0 });
  }
  const n = setOf(id).items.length;
  return n === 1 ? t('col_unlock_outfit_1') : t('col_unlock_outfit', { n });
}

/** A row of an outfit's pieces: owned ones in colour, the rest as shadows. */
export function SetStrip({ setId, size = 38 }: { setId: string; size?: number }) {
  const s = useAppState();
  return (
    <div class="set-strip">
      {setOf(setId).items.map((id) => (
        <span class={`strip-item ${s.items[id] ? 'own' : ''}`} key={id} title={s.items[id] ? nameOf(item(id)) : undefined}>
          <ItemImg id={id} size={size} silhouette={!s.items[id]} />
        </span>
      ))}
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
              <Portrait id={g.id} size={84} outfit={outfitOf(s, g.id)} silhouette={!have} />
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

/* ---------------- wardrobe ---------------- */
export function WardrobeSheet({ open, onClose, ghostId }: { open: boolean; onClose: () => void; ghostId?: string | null }) {
  const s = useAppState();
  const wearers = GHOSTS.filter((g) => s.ghosts[g.id] && canWear(g.id));
  const [who, setWho] = useState(ghostId ?? dresser(s));
  const [cheer, setCheer] = useState(0);
  useEffect(() => {
    if (open) setWho(ghostId && canWear(ghostId) ? ghostId : dresser(s));
  }, [open, ghostId]);
  const outfit = outfitOf(s, who);
  const worn = new Set(Object.values(outfit));
  const mine = ITEMS.filter((i) => s.items[i.id]);
  const notWearer = !canWear(s.companion) && !ghostId;
  return (
    <Sheet open={open} onClose={onClose} title={t('ward_title')} class="wardrobe-sheet">
      {notWearer && <p class="muted small">{t('ward_cant', { name: companionName(s) })}</p>}
      {wearers.length > 1 && (
        <div class="chips ward-who" role="group" aria-label={t('ward_who')}>
          {wearers.map((g) => (
            <Chip key={g.id} active={who === g.id} onClick={() => setWho(g.id)}>
              {companionName(s, g.id)}
            </Chip>
          ))}
        </div>
      )}
      <div class="ward-stage" style={{ '--cg': ghost(who).glow } as CSSProperties}>
        {open && <CompanionStage key={who} ghostId={who} level={0.25} interactive zoom={1.2} overscan={{ top: 0.18, side: 0.1, bottom: 0.02 }} cheer={cheer} cheerBig={false} onPoke={() => sfx.poke()} />}
      </div>
      {mine.length === 0 ? (
        <p class="muted center">{t('ward_empty')}</p>
      ) : (
        <>
          <p class="muted small center">{t('ward_body')}</p>
          <div class="ward-grid">
            {mine.map((i) => {
              const on = worn.has(i.id);
              return (
                <button
                  type="button"
                  key={i.id}
                  class={`ward-item ${on ? 'on' : ''}`}
                  style={{ '--rc': RARITY_COLOR[i.rarity] } as CSSProperties}
                  aria-pressed={on}
                  aria-label={nameOf(i)}
                  onClick={() => {
                    haptic.tap();
                    sfx.toggle();
                    toggleItem(who, i.id);
                    if (!on) setCheer((c) => c + 1);
                  }}
                >
                  <ItemImg id={i.id} size={58} />
                  <small>{nameOf(i)}</small>
                  {on && (
                    <span class="ward-check">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {worn.size > 0 && (
            <Btn kind="ghost" icon="restore" onClick={() => clearOutfit(who)}>
              {t('ward_clear')}
            </Btn>
          )}
        </>
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
  const target = s.wish.target ? item(s.wish.target) : null;
  const cost = target ? WISH_COST[target.rarity] : 0;
  const missing = ITEMS.filter((i) => !s.items[i.id]).sort((a, b) => WISH_COST[a.rarity] - WISH_COST[b.rarity]);
  return (
    <Sheet open={open} onClose={onClose} title={t('wish_title')}>
      <p class="muted">{t('wish_body')}</p>
      <div class="wish-energy">
        <Icon name="star" size={18} />
        <b>{t('wish_energy', { n: s.wish.energy })}</b>
      </div>
      {target && !choosing && (
        <div class="wish-target">
          <ItemImg id={target.id} size={120} float />
          <div class="wish-target-info">
            <b>{nameOf(target)}</b>
            <RarityTag r={target.rarity} />
            <small class="muted">{t('col_piece_of', { name: nameOf(ghost(target.set)) })}</small>
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
                <ItemImg id={i.id} size={60} />
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
export function GhostSheet({ id, onClose, onDress }: { id: string | null; onClose: () => void; onDress: (ghostId: string) => void }) {
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
  return (
    <Sheet open={!!id} onClose={onClose} class="ghost-sheet">
      <div class="ghost-hero" style={{ '--rc': accent, '--tint': g.glow } as CSSProperties}>
        <span class="ghost-hero-glow" />
        {rec && id ? (
          <CompanionStage ghostId={gid} level={0.3} interactive zoom={1.12} shiftY={14} overscan={{ top: 0.2, side: 0.1, bottom: 0.02 }} class="ghost-hero-stage" onPoke={() => sfx.poke()} />
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
              {canWear(gid) ? (
                <Btn kind="secondary" icon="hanger" onClick={() => onDress(gid)}>
                  {t('ward_title')}
                </Btn>
              ) : (
                <p class="muted small center">{t('col_own_costume')}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p class="unlock-hint">
              <Icon name="lock" size={16} /> {ghostUnlockText(s, gid)}
            </p>
            {g.kind === 'costume' && (
              <>
                <SetStrip setId={gid} size={46} />
                <p class="muted small">{t('col_unlock_boss')}</p>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- piece detail ---------------- */
export function ItemSheet({ id, onClose, onWish, onDress }: { id: string | null; onClose: () => void; onWish: () => void; onDress: (ghostId: string) => void }) {
  const s = useAppState();
  const [last, setLast] = useState(id);
  useEffect(() => {
    if (id) setLast(id);
  }, [id]);
  const iid = id ?? last;
  if (!iid) return null;
  const it = item(iid);
  const rec = s.items[iid];
  const owner = ghost(it.set);
  const who = dresser(s);
  const wearing = outfitOf(s, who)[it.slot] === iid;
  return (
    <Sheet open={!!id} onClose={onClose} class="ghost-sheet item-sheet">
      <div class="ghost-hero" style={{ '--rc': RARITY_COLOR[it.rarity], '--tint': owner.glow } as CSSProperties}>
        <span class="ghost-hero-glow" />
        <ItemImg id={iid} size={180} silhouette={!rec} float />
      </div>
      <div class="ghost-meta">
        <h2>{nameOf(it)}</h2>
        <div class="ghost-tags">
          <RarityTag r={it.rarity} />
          <span class="set-tag" style={{ '--sc': owner.glow } as CSSProperties}>
            {t('col_piece_of', { name: nameOf(owner) })}
          </span>
        </div>
        <SetStrip setId={it.set} size={42} />
        {rec ? (
          <>
            <p class="muted small">
              {t('col_found', { date: fmtDate(rec.at) })} · {t(`col_via_${rec.via}`)}
            </p>
            <Btn
              kind="primary"
              icon="hanger"
              onClick={() => {
                if (!wearing) wearItem(who, iid);
                sfx.toggle();
                onDress(who);
              }}
            >
              {wearing ? t('ward_title') : t('drop_try', { name: companionName(s, who) })}
            </Btn>
          </>
        ) : s.wish.target === iid ? (
          <p class="unlock-hint">
            <Icon name="star" size={16} /> {t('col_is_wish')}
          </p>
        ) : (
          <Btn
            kind="secondary"
            icon="star"
            onClick={() => {
              setWish(iid);
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

