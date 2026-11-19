import type { CSSProperties } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DUPE_ENERGY, RARITY_COLOR, canWear, ghost, item, rarityRank } from '../data/catalog';
import { nameOf, quoteOf, t } from '../i18n';
import type { Key } from '../i18n';
import { PITY_EPIC, epicWithin } from '../logic/drops';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import { companionName, dresser, keepFromDrop, outfitOf, revealDrop, useAppState, wearItem } from '../state/store';
import type { KeepResult } from '../state/store';
import { Bar, Btn, Icon, IconBtn, ItemImg, RarityTag } from '../ui/kit';
import { OddsSheet, SetStrip } from '../ui/sheets';
import { CompanionStage } from '../ui/stage';

function Burst({ color, big }: { color: string; big: boolean }) {
  const n = big ? 16 : 9;
  return (
    <span class="burst" style={{ '--bc': color } as CSSProperties} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ '--a': `${(360 / n) * i + Math.random() * 12}deg`, '--d': `${70 + Math.random() * 70}px`, '--s': `${0.5 + Math.random() * 0.8}` } as CSSProperties} />
      ))}
    </span>
  );
}

/** After keeping: the piece, how far its outfit is, and a try-on with your companion. */
function Kept({ kept, onClose }: { kept: KeepResult; onClose: () => void }) {
  const s = useAppState();
  const it = item(kept.item);
  const owner = ghost(it.set);
  const who = dresser(s);
  const [trying, setTrying] = useState(false);
  const [cheer, setCheer] = useState(0);
  const tryOn = () => {
    wearItem(who, it.id);
    setTrying(true);
    sfx.unlock();
    haptic.success();
    setTimeout(() => setCheer((c) => c + 1), 450);
  };
  const joined = kept.ghostJoined ? ghost(kept.ghostJoined) : null;

  return (
    <div class="page drop kept" style={{ '--rc': RARITY_COLOR[it.rarity], '--tint': owner.glow } as CSSProperties}>
      <div class={`kept-hero ${trying ? 'trying' : ''}`}>
        <span class="rays" />
        <span class="kept-glow" />
        {trying ? (
          <CompanionStage ghostId={who} outfit={outfitOf(s, who)} level={0.5} interactive zoom={1.15} overscan={{ top: 0.2, side: 0.1, bottom: 0.02 }} cheer={cheer} class="kept-stage" onPoke={() => sfx.poke()} />
        ) : (
          <>
            <ItemImg id={it.id} size={210} float class="kept-ghost" />
            <Burst color={RARITY_COLOR[it.rarity]} big />
          </>
        )}
      </div>
      <div class="kept-info">
        <RarityTag r={it.rarity} />
        <h1>{nameOf(it)}</h1>
        {kept.dupe ? (
          <p class="ok-chip warm">
            <Icon name="star" size={15} /> {t('drop_kept_dupe', { n: kept.energy })}
          </p>
        ) : (
          <p class="muted">{t('drop_kept', { name: nameOf(it) })}</p>
        )}
        {joined ? (
          <div class="unlock-card joined" style={{ '--rc': joined.glow } as CSSProperties}>
            <CompanionStage ghostId={joined.id} level={0.6} zoom={1.3} class="joined-stage" cheer={1} />
            <span>
              <b>{t('drop_ghost_joined', { name: nameOf(joined) })}</b>
              <small>“{quoteOf(joined)}”</small>
              <small>{t('drop_ghost_joined_body')}</small>
            </span>
          </div>
        ) : (
          <div class="card set-progress" style={{ '--sc': owner.glow } as CSSProperties}>
            <div class="res-row">
              <b>{t('drop_set', { name: nameOf(owner), have: kept.set.have, total: kept.set.total })}</b>
              {kept.set.done && <span class="ok-chip">{t('drop_set_done')}</span>}
            </div>
            <Bar value={kept.set.have / kept.set.total} color="var(--sc)" />
            <SetStrip setId={it.set} size={36} />
          </div>
        )}
        {kept.achievements.map((a) => (
          <div class="unlock-card" key={a}>
            <span class="ach-icon">
              <Icon name="trophy" size={22} />
            </span>
            <span>
              <b>{t(`ach_${a}` as Key)}</b>
              <small>{t('done_achievement')}</small>
            </span>
          </div>
        ))}
      </div>
      <div class="stack bottom-actions">
        {!trying && canWear(who) && !kept.dupe ? (
          <>
            <Btn kind="warm" big icon="hanger" onClick={tryOn}>
              {t('drop_try', { name: companionName(s, who) })}
            </Btn>
            <Btn kind="ghost" onClick={onClose}>
              {t('continue')}
            </Btn>
          </>
        ) : (
          <Btn kind="primary" big onClick={onClose}>
            {t('continue')}
          </Btn>
        )}
      </div>
    </div>
  );
}

export function Drop({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useAppState();
  const pend = s.pending.find((p) => p.id === id);
  const kind = pend?.kind ?? 'daily';
  const cards = useMemo(() => revealDrop(id), [id]);
  const [flipped, setFlipped] = useState<boolean[]>(cards.map(() => false));
  const [sel, setSel] = useState<number | null>(null);
  const [kept, setKept] = useState<KeepResult | null>(null);
  const [oddsOpen, setOddsOpen] = useState(false);
  const owned = useMemo(() => new Set(Object.keys(s.items)), []);
  const all = flipped.every(Boolean);

  const flip = (i: number) => {
    if (flipped[i]) {
      if (all) {
        setSel(i);
        haptic.tap();
        sfx.tap();
      }
      return;
    }
    const r = item(cards[i]).rarity;
    sfx.flip(r);
    if (rarityRank(r) >= 2) haptic.big();
    else haptic.success();
    setFlipped((f) => f.map((v, j) => v || j === i));
  };
  const revealAll = () => {
    let k = 0;
    cards.forEach((_, i) => {
      if (!flipped[i]) setTimeout(() => flip(i), k++ * 260);
    });
  };
  // once all are face up, suggest the best new card
  useEffect(() => {
    if (!all || sel !== null) return;
    const score = (c: string) => (owned.has(c) ? 0 : 10) + rarityRank(item(c).rarity);
    let best = 0;
    cards.forEach((c, i) => {
      if (score(c) > score(cards[best])) best = i;
    });
    const tm = setTimeout(() => setSel(best), 450);
    return () => clearTimeout(tm);
  }, [all]);

  if (kept) return <Kept kept={kept} onClose={onClose} />;

  if (!pend) {
    return (
      <div class="page drop">
        <Btn kind="primary" onClick={onClose}>
          {t('close')}
        </Btn>
      </div>
    );
  }

  const title = kind === 'first' ? t('drop_first') : kind === 'week' ? t('drop_week') : t('drop_daily');
  const within = epicWithin(s.pity);
  const selI = sel !== null ? item(cards[sel]) : null;

  return (
    <div class="page drop">
      <header class="drop-head">
        <IconBtn icon="close" label={t('close')} onClick={onClose} />
        <h1>{title}</h1>
        <button type="button" class="link-btn" onClick={() => setOddsOpen(true)}>
          <Icon name="info" size={16} /> {t('drop_odds')}
        </button>
      </header>

      <div class="pity">
        <span>
          <Icon name="sparkle" size={14} /> {within <= 1 ? t('drop_pity_now') : t('drop_pity', { n: within })}
        </span>
        <Bar value={1 - (within - 1) / PITY_EPIC} thin color="var(--epic)" />
      </div>

      <div class={`cards ${all ? 'all' : ''} ${sel !== null ? 'has-sel' : ''}`}>
        {cards.map((c, i) => {
          const it = item(c);
          const isNew = !owned.has(c);
          return (
            <button
              type="button"
              key={c}
              class={`dcard r-${it.rarity} ${flipped[i] ? 'flipped' : ''} ${sel === i ? 'sel' : ''}`}
              style={{ '--rc': RARITY_COLOR[it.rarity], '--delay': `${i * 90}ms` } as CSSProperties}
              onClick={() => flip(i)}
              aria-label={flipped[i] ? `${nameOf(it)}, ${t(`r_${it.rarity}`)}` : `${t('drop_tap')} ${i + 1}`}
            >
              <span class="dcard-inner">
                <span class="dcard-back">
                  <span class="dcard-glow" />
                  <Icon name="bolt" size={38} />
                </span>
                <span class="dcard-front">
                  <span class="dcard-shine" />
                  <ItemImg id={c} size={84} />
                  <b>{nameOf(it)}</b>
                  <RarityTag r={it.rarity} />
                  <small class={isNew ? 'is-new' : 'is-owned'}>{isNew ? t('drop_new') : `+${DUPE_ENERGY[it.rarity]}`}</small>
                </span>
              </span>
              {flipped[i] && rarityRank(it.rarity) >= 1 && <Burst color={RARITY_COLOR[it.rarity]} big={rarityRank(it.rarity) >= 2} />}
            </button>
          );
        })}
      </div>

      <p class="drop-hint">
        {all
          ? selI && owned.has(selI.id)
            ? t('drop_owned', { n: DUPE_ENERGY[selI.rarity] })
            : selI
              ? t('col_piece_of', { name: nameOf(ghost(selI.set)) })
              : t('drop_choose')
          : t('drop_tap')}
      </p>

      <div class="stack bottom-actions">
        {all ? (
          <Btn
            kind="warm"
            big
            icon="check"
            disabled={sel === null}
            onClick={() => {
              if (sel === null) return;
              const r = keepFromDrop(id, cards[sel]);
              sfx.keep();
              haptic.big();
              if (r.ghostJoined) setTimeout(() => sfx.unlock(), 500);
              setKept(r);
            }}
          >
            {selI ? t('drop_keep', { name: nameOf(selI) }) : t('drop_choose')}
          </Btn>
        ) : (
          <Btn kind="secondary" big icon="sparkle" onClick={revealAll}>
            {t('drop_reveal_all')}
          </Btn>
        )}
      </div>
      <OddsSheet open={oddsOpen} onClose={() => setOddsOpen(false)} />
    </div>
  );
}
