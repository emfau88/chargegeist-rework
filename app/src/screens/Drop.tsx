import type { CSSProperties } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DUPE_ENERGY, RARITY_COLOR, SPARK_ENERGY, ghost, rarityRank, style } from '../data/catalog';
import type { Rarity } from '../data/types';
import { nameOf, quoteOf, t } from '../i18n';
import type { Key } from '../i18n';
import { PITY_EPIC, epicWithin } from '../logic/drops';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import { companionName, keepFromDrop, lookOf, revealDrop, sparkInfo, sparkTarget, useAppState, wearStyle } from '../state/store';
import type { KeepResult } from '../state/store';
import { Bar, Btn, Icon, IconBtn, RarityTag } from '../ui/kit';
import { OddsSheet } from '../ui/sheets';
import { CompanionStage } from '../ui/stage';
import { KindTag, SparkPips, SparkPortrait, StylePreview } from '../ui/style';

/** Cards sit 6 % of their width into each other, so one slot is 0.94 card widths. */
const PITCH = 0.94;

/**
 * Where a card stands: fanned in a row at first, and once one is picked on a podium
 * (the pick large on top, the others small below). The podium only shows on tall screens (see CSS).
 * All values are multiples of the card width (x) and height (y).
 */
function cardPose(i: number, n: number, sel: number | null): CSSProperties {
  const slot = i - (n - 1) / 2;
  const pose: Record<string, string | number> = { '--i': i, '--fan': `${slot * 5}deg`, '--arc': `${Math.abs(slot) * 8}px` };
  if (sel !== null) {
    if (i === sel) {
      Object.assign(pose, { '--ppx': -slot * PITCH, '--ppy': -0.37, '--pk': 1.36, '--prot': '0deg' });
    } else {
      const rank = i < sel ? i : i - 1;
      const side = rank - (n - 2) / 2;
      Object.assign(pose, { '--ppx': side - slot * PITCH, '--ppy': 0.76, '--pk': 0.76, '--prot': `${side * 8}deg` });
    }
  }
  return pose as CSSProperties;
}

/** Long single words (German compounds) get a smaller type so they stay inside the card. */
function nameSize(name: string): string | undefined {
  const w = Math.max(...name.split(/[\s-]+/).map((p) => p.length));
  return w >= 15 ? 'xlong' : w >= 13 ? 'long' : undefined;
}

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

/** The ghost spark a drop brings, filling up from where it was. */
function SparkGain({ kept }: { kept: KeepResult }) {
  const sp = kept.spark;
  const [have, setHave] = useState(Math.max(0, sp.have - 1));
  useEffect(() => {
    const tm = setTimeout(() => {
      setHave(sp.have);
      sfx.toggle();
      haptic.tap();
    }, 700);
    return () => clearTimeout(tm);
  }, []);
  if (!sp.ghost) {
    return (
      <p class="ok-chip warm center-chip">
        <Icon name="star" size={15} /> {t('spark_all_energy', { n: sp.energy })}
      </p>
    );
  }
  const g = ghost(sp.ghost);
  if (sp.joined) {
    return (
      <div class="unlock-card joined" style={{ '--rc': g.glow } as CSSProperties}>
        <CompanionStage ghostId={g.id} level={0.6} zoom={1.3} class="joined-stage" cheer={1} ground />
        <span>
          <b>{t('drop_ghost_joined', { name: nameOf(g) })}</b>
          <small>“{quoteOf(g)}”</small>
          <small>{t('drop_ghost_joined_body')}</small>
        </span>
      </div>
    );
  }
  return (
    <div class="card spark-gain" style={{ '--cg': g.glow } as CSSProperties}>
      <SparkPortrait id={g.id} size={64} have={have} need={sp.need} />
      <span class="spark-meter-text">
        <small class="spark-plus">
          <Icon name="bolt" size={13} /> {t('spark_plus')}
        </small>
        <b>{nameOf(g)}</b>
        <SparkPips have={have} need={sp.need} />
        <small>{t('spark_count', { have, need: sp.need })}</small>
      </span>
    </div>
  );
}

/** After keeping: the style on your companion, plus the ghost spark that came along. */
function Kept({ kept, onClose }: { kept: KeepResult; onClose: () => void }) {
  const s = useAppState();
  const x = style(kept.style);
  const who = s.companion;
  const current = lookOf(s, who);
  const wearing = current[x.kind] === x.id;
  const [cheer, setCheer] = useState(0);
  useEffect(() => {
    const tm = setTimeout(() => setCheer((c) => c + 1), 500);
    return () => clearTimeout(tm);
  }, []);
  const wear = () => {
    wearStyle(who, x.id);
    sfx.unlock();
    haptic.success();
    setCheer((c) => c + 1);
  };
  // the very first style goes straight on: there is nothing it could take the place of
  useEffect(() => {
    if (kept.dupe || wearing || Object.keys(s.styles).length !== 1) return;
    const tm = setTimeout(wear, 700);
    return () => clearTimeout(tm);
  }, []);

  return (
    <div class="page drop kept" style={{ '--rc': RARITY_COLOR[x.rarity], '--tint': ghost(who).glow } as CSSProperties}>
      <div class="kept-hero trying">
        <span class="rays" />
        <span class="kept-glow" />
        <CompanionStage ghostId={who} look={{ ...current, [x.kind]: x.id }} level={0.5} interactive zoom={1.15} overscan={{ top: 0.2, side: 0.1, bottom: 0.02 }} cheer={cheer} class="kept-stage" onPoke={() => sfx.poke()} ground />
        <Burst color={RARITY_COLOR[x.rarity]} big={rarityRank(x.rarity) >= 2} />
      </div>
      <div class="kept-info">
        <span class="tag-row">
          <RarityTag r={x.rarity} />
          <KindTag id={x.id} />
        </span>
        <h1>{nameOf(x)}</h1>
        {kept.dupe ? (
          <p class="ok-chip warm">
            <Icon name="star" size={15} /> {t('drop_kept_dupe', { n: kept.energy })}
          </p>
        ) : (
          <p class="muted">{wearing ? t('drop_worn', { name: companionName(s, who) }) : t('drop_kept', { name: nameOf(x) })}</p>
        )}
        <SparkGain kept={kept} />
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
        {!wearing ? (
          <>
            <Btn kind="warm" big icon="palette" onClick={wear}>
              {t('drop_wear', { name: companionName(s, who) })}
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
  // an epic or mythic card lights up the whole screen once as it turns
  const [flash, setFlash] = useState<{ n: number; color: string } | null>(null);
  const owned = useMemo(() => new Set(Object.keys(s.styles)), []);
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
    const r = style(cards[i]).rarity;
    sfx.flip(r);
    if (rarityRank(r) >= 2) {
      haptic.big();
      setFlash((f) => ({ n: (f?.n ?? 0) + 1, color: RARITY_COLOR[r] }));
    } else haptic.success();
    setFlipped((f) => f.map((v, j) => v || j === i));
  };
  const revealAll = () => {
    let k = 0;
    cards.forEach((_, i) => {
      if (!flipped[i]) setTimeout(() => flip(i), k++ * 320);
    });
  };
  // once all are face up, suggest the best new card
  useEffect(() => {
    if (!all || sel !== null) return;
    const score = (c: string) => (owned.has(c) ? 0 : 10) + rarityRank(style(c).rarity);
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
  const selX = sel !== null ? style(cards[sel]) : null;
  const target = sparkTarget(s);
  const sp = target ? sparkInfo(s, target) : null;
  // the stage takes the colour of the pick, or of the best card turned so far
  const topR = cards.reduce<Rarity | null>((a, c, i) => {
    const r = style(c).rarity;
    return flipped[i] && (a === null || rarityRank(r) > rarityRank(a)) ? r : a;
  }, null);
  const hot = topR !== null && rarityRank(topR) >= 2;
  const stageColor = selX ? RARITY_COLOR[selX.rarity] : topR ? RARITY_COLOR[topR] : 'var(--charge)';
  const rays = selX ? rarityRank(selX.rarity) >= 2 : hot;

  return (
    <div class={`page drop ${hot ? 'hot' : ''}`}>
      <span class="drop-dim" aria-hidden="true" />
      {flash && <span class="drop-flash" key={flash.n} style={{ '--rc': flash.color } as CSSProperties} aria-hidden="true" />}
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

      <div class="drop-stage" style={{ '--stage': stageColor } as CSSProperties}>
        <div class={`stage-core ${all ? 'all' : ''} ${sel !== null ? 'has-sel' : ''} ${rays ? 'rays-on' : ''}`}>
          <span class="stage-rays" aria-hidden="true" />
          <span class="stage-light" aria-hidden="true" />
          <span class="stage-floor" aria-hidden="true" />
          <div class="cards">
            {cards.map((c, i) => {
              const x = style(c);
              const isNew = !owned.has(c);
              const name = nameOf(x);
              return (
                <button
                  type="button"
                  key={c}
                  class={`dcard r-${x.rarity} ${flipped[i] ? 'flipped' : ''} ${sel === i ? 'sel' : ''}`}
                  style={{ '--rc': RARITY_COLOR[x.rarity], '--delay': `${i * 90}ms`, ...(cardPose(i, cards.length, sel) as object) } as CSSProperties}
                  onClick={() => flip(i)}
                  aria-label={flipped[i] ? `${name}, ${t(`kind_${x.kind}`)}, ${t(`r_${x.rarity}` as Key)}` : `${t('drop_tap')} ${i + 1}`}
                >
                  <span class="dcard-inner">
                    <span class="dcard-back">
                      <span class="dcard-foil" />
                      <i class="corner tl" />
                      <i class="corner tr" />
                      <i class="corner bl" />
                      <i class="corner br" />
                      <span class="dcard-emblem">
                        <Icon name="bolt" size={30} />
                      </span>
                    </span>
                    <span class="dcard-front">
                      <span class="dcard-rim" />
                      <span class="dcard-face">
                        <span class="dcard-shine" />
                        {flipped[i] ? <StylePreview id={c} ghostId={s.companion} size={110} /> : <span class="dcard-art-ph" />}
                        <b class={nameSize(name)}>{name}</b>
                        <KindTag id={c} />
                        <RarityTag r={x.rarity} />
                        <small class={isNew ? 'is-new' : 'is-owned'}>{isNew ? t('drop_new') : t('drop_owned_short', { n: DUPE_ENERGY[x.rarity] })}</small>
                      </span>
                    </span>
                  </span>
                  {flipped[i] && rarityRank(x.rarity) >= 1 && <Burst color={RARITY_COLOR[x.rarity]} big={rarityRank(x.rarity) >= 2} />}
                </button>
              );
            })}
          </div>
          <p class="drop-hint">
            {all ? (selX && owned.has(selX.id) ? t('drop_owned', { n: DUPE_ENERGY[selX.rarity] }) : selX ? t(`col_${selX.kind}s_hint` as Key) : t('drop_choose')) : t('drop_tap')}
          </p>
        </div>
      </div>

      <div class="stack bottom-actions">
        {target && sp ? (
          <div class="drop-spark" style={{ '--cg': ghost(target).glow } as CSSProperties}>
            <SparkPortrait id={target} size={44} have={sp.have} need={sp.need} />
            <span class="drop-spark-text">
              <small>{t('drop_spark_also')}</small>
              <b>{t('drop_spark_for', { name: nameOf(ghost(target)), have: sp.have, need: sp.need })}</b>
            </span>
            <SparkPips have={sp.have} need={sp.need} size={12} />
          </div>
        ) : (
          <div class="drop-spark">
            <Icon name="star" size={18} />
            <span class="drop-spark-text">
              <small>{t('drop_spark_also')}</small>
              <b>{t('spark_all_energy', { n: SPARK_ENERGY })}</b>
            </span>
          </div>
        )}
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
              if (r.spark.joined) setTimeout(() => sfx.unlock(), 900);
              setKept(r);
            }}
          >
            {selX ? t('drop_keep', { name: nameOf(selX) }) : t('drop_choose')}
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
