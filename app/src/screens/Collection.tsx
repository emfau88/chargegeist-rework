import type { CSSProperties } from 'preact';
import { useState } from 'preact/hooks';
import { PLUS_FOR_SALE } from '../platform/build';
import { COMPANIONS, COMPANION_UNLOCK_HOURS, COSTUME_GHOSTS, DROP_STYLES, GHOSTS, RARITY_COLOR, STYLE_KINDS, WISH_COST, ghost, style, stylesOf, unlockOrder } from '../data/catalog';
import type { Key } from '../i18n';
import { nameOf, t } from '../i18n';
import { haptic } from '../platform/device';
import { BOND_MAX, bondLevel } from '../logic/bond';
import { bondOf, canUseStyle, companionName, lookOf, markSeen, sparkInfo, sparkTarget, useAppState } from '../state/store';
import { Bar, Icon } from '../ui/kit';
import { GhostSheet, StyleItemSheet, StyleSheet, WishSheet, ghostUnlockText } from '../ui/sheets';
import { Portrait } from '../ui/stage';
import { SparkPips, SparkPortrait, StyleBadge, StylePreview } from '../ui/style';

type Seg = 'ghosts' | 'style';

export function Collection({ openPlus }: { openPlus: () => void }) {
  const s = useAppState();
  const unseenStyles = Object.values(s.styles).some((r) => !r.seen);
  const unseenGhosts = Object.values(s.ghosts).some((r) => !r.seen);
  const [seg, setSeg] = useState<Seg>(unseenStyles && !unseenGhosts ? 'style' : 'ghosts');
  const [selGhost, setSelGhost] = useState<string | null>(null);
  const [selStyle, setSelStyle] = useState<string | null>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [styleFor, setStyleFor] = useState<string | null>(null);
  const ghostCount = Object.keys(s.ghosts).length;
  const styleCount = DROP_STYLES.filter((x) => s.styles[x.id]).length;
  const wish = s.wish.target ? style(s.wish.target) : null;
  const cost = wish ? WISH_COST[wish.rarity] : 0;
  const target = sparkTarget(s);

  const openGhost = (id: string) => {
    setSelGhost(id);
    markSeen('ghosts', [id]);
  };
  const openStyle = (id: string) => {
    setSelStyle(id);
    markSeen('styles', [id]);
  };
  const toStyle = (id: string) => {
    setSelGhost(null);
    setSelStyle(null);
    setStyleFor(id);
  };

  const ghostTile = (id: string) => {
    const g = ghost(id);
    const rec = s.ghosts[id];
    const costume = g.kind === 'costume';
    const sp = costume ? sparkInfo(s, id) : null;
    const rc = g.rarity ? RARITY_COLOR[g.rarity] : g.glow;
    const bond = rec ? bondLevel(bondOf(s, id)) : 0;
    const kindred = !!rec && bond >= BOND_MAX;
    return (
      <button
        type="button"
        key={id}
        class={`tile ghost-tile ${kindred ? 'kindred' : ''} ${rec ? 'own' : 'missing'} ${rec && !rec.seen ? 'unseen' : ''} ${s.companion === id ? 'active' : ''} ${!rec && target === id ? 'charging' : ''}`}
        style={{ '--rc': rc, '--cg': g.glow, '--rar': g.rarity ? RARITY_COLOR[g.rarity] : undefined } as CSSProperties}
        onClick={() => openGhost(id)}
        aria-label={rec ? companionName(s, id) : `${nameOf(g)}: ${sp ? t('spark_count', sp) : ghostUnlockText(s, id)}`}
      >
        <span class="tile-art">{!rec && sp ? <SparkPortrait id={id} size={84} have={sp.have} need={sp.need} /> : <Portrait id={id} size={84} silhouette={!rec} />}</span>
        <b class="tile-name">{rec ? companionName(s, id) : nameOf(g)}</b>
        {!rec && sp && (
          <span class="tile-req">
            <SparkPips have={sp.have} need={sp.need} size={11} />
          </span>
        )}
        {!rec && !sp && (
          <span class="tile-req">
            <small>
              <Icon name="lock" size={11} /> {t('col_tile_hours', { n: COMPANION_UNLOCK_HOURS[unlockOrder(s.firstCompanion).indexOf(id)] ?? 0 })}
            </small>
          </span>
        )}
        {rec && (
          <span class="tile-bond">
            <Icon name="heart" size={11} /> {t(`bond_${bond}` as Key)}
          </span>
        )}
        {g.rarity && <span class="tile-rar">{t(`r_${g.rarity}` as Key)}</span>}
        {rec && !rec.seen && <span class="new-dot">{t('new_badge')}</span>}
        {kindred && (
          <span class="kindred-dot" aria-hidden="true">
            <Icon name="heart" size={11} />
          </span>
        )}
        {s.companion === id && (
          <span class="active-dot" aria-hidden="true">
            <Icon name="bolt" size={12} />
          </span>
        )}
        {!rec && target === id && (
          <span class="target-dot" aria-hidden="true">
            <Icon name="bolt" size={12} />
          </span>
        )}
      </button>
    );
  };

  const styleTile = (id: string) => {
    const x = style(id);
    const rec = s.styles[id];
    const usable = canUseStyle(s, id);
    const worn = lookOf(s, s.companion)[x.kind] === id;
    return (
      <button
        type="button"
        key={id}
        class={`tile style-tile ${usable ? 'own' : 'missing'} ${rec && !rec.seen ? 'unseen' : ''} ${s.wish.target === id ? 'wished' : ''} ${worn ? 'worn' : ''}`}
        style={{ '--rc': RARITY_COLOR[x.rarity] } as CSSProperties}
        onClick={() => openStyle(id)}
        aria-label={usable ? nameOf(x) : `${nameOf(x)}: ${t('col_locked')}`}
      >
        <span class="tile-art">{x.kind === 'shimmer' ? <StyleBadge id={id} size={64} /> : <StylePreview id={id} ghostId={null} size={78} live={false} />}</span>
        <b class="tile-name">{nameOf(x)}</b>
        {x.plus && !usable && (
          <span class="plus-dot">
            <Icon name="crown" size={11} />
          </span>
        )}
        {rec && !rec.seen && <span class="new-dot">{t('new_badge')}</span>}
        {s.wish.target === id && (
          <span class="wish-dot">
            <Icon name="star" size={12} />
          </span>
        )}
        {worn && (
          <span class="active-dot" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        )}
      </button>
    );
  };

  return (
    <div class="page collection">
      <header class="page-head">
        <h1>{t('col_title')}</h1>
        <div class="segments" role="tablist">
          {(['ghosts', 'style'] as Seg[]).map((x) => (
            <button
              type="button"
              key={x}
              role="tab"
              aria-selected={seg === x}
              class={`segment ${seg === x ? 'active' : ''}`}
              onClick={() => {
                haptic.tap();
                setSeg(x);
              }}
            >
              <Icon name={x === 'ghosts' ? 'ghost' : 'palette'} size={17} />
              {t(x === 'ghosts' ? 'col_seg_ghosts' : 'col_seg_style')}
              {x === 'style' && unseenStyles && <i class="seg-dot" />}
              {x === 'ghosts' && unseenGhosts && <i class="seg-dot" />}
            </button>
          ))}
        </div>
      </header>

      {seg === 'ghosts' ? (
        <>
          <p class="muted count-line">{t('col_count', { n: ghostCount, total: GHOSTS.length })}</p>
          <Bar value={ghostCount / GHOSTS.length} color="linear-gradient(90deg, var(--common), var(--rare), var(--epic), var(--mythic))" />
          <section class="set">
            <header class="set-head">
              <h2>{t('col_companions')}</h2>
              <span class="set-count">
                {COMPANIONS.filter((g) => s.ghosts[g.id]).length}/{COMPANIONS.length}
              </span>
            </header>
            <p class="muted small set-hint">{t('col_companions_hint')}</p>
            <div class="tiles tiles-ghosts">{COMPANIONS.map((g) => ghostTile(g.id))}</div>
          </section>
          <section class="set">
            <header class="set-head">
              <h2>{t('col_costumes')}</h2>
              <span class="set-count">
                {COSTUME_GHOSTS.filter((g) => s.ghosts[g.id]).length}/{COSTUME_GHOSTS.length}
              </span>
            </header>
            <p class="muted small set-hint">{t('col_costumes_hint')}</p>
            <div class="tiles tiles-ghosts">{COSTUME_GHOSTS.map((g) => ghostTile(g.id))}</div>
          </section>
        </>
      ) : (
        <>
          <p class="muted count-line">{t('col_styles', { n: styleCount, total: DROP_STYLES.length })}</p>
          <Bar value={styleCount / DROP_STYLES.length} color="linear-gradient(90deg, var(--common), var(--rare), var(--epic), var(--mythic))" />

          <button type="button" class="card wish-banner" onClick={() => setWishOpen(true)} style={{ '--rc': wish ? RARITY_COLOR[wish.rarity] : 'var(--warm)' } as CSSProperties}>
            {wish ? (
              <StyleBadge id={wish.id} size={52} />
            ) : (
              <span class="mini-empty">
                <Icon name="star" size={24} />
              </span>
            )}
            <span class="card-text">
              <b>{wish ? nameOf(wish) : t('wish_title')}</b>
              {wish ? (
                <>
                  <Bar value={s.wish.energy / cost} thin color="var(--rc)" />
                  <small>{s.wish.energy >= cost ? t('home_wish_ready') : `${s.wish.energy} / ${cost} · ${t('wish_need', { n: cost - s.wish.energy })}`}</small>
                </>
              ) : (
                <small>{t('home_wish_pick')}</small>
              )}
            </span>
            <Icon name="chevron" size={18} />
          </button>

          <button type="button" class="card dress-banner" onClick={() => setStyleFor(s.companion)} style={{ '--cg': ghost(s.companion).glow } as CSSProperties}>
            <Portrait id={s.companion} size={52} />
            <span class="card-text">
              <b>{t('style_title')}</b>
              <small>{t('style_banner', { name: companionName(s) })}</small>
            </span>
            <Icon name="palette" size={20} />
          </button>

          {STYLE_KINDS.map((k) => {
            const list = stylesOf(k).filter((x) => PLUS_FOR_SALE || s.plus || !x.plus);
            if (!list.length) return null;
            const own = list.filter((x) => canUseStyle(s, x.id)).length;
            return (
              <section class="set style-set" key={k}>
                <header class="set-head">
                  <h2>{t(`col_${k}s` as Key)}</h2>
                  <span class="set-count">
                    {own}/{list.length}
                  </span>
                </header>
                <p class="muted small set-hint">{t(`col_${k}s_hint` as Key)}</p>
                <div class="tiles">{list.map((x) => styleTile(x.id))}</div>
              </section>
            );
          })}
        </>
      )}

      <GhostSheet id={selGhost} onClose={() => setSelGhost(null)} onStyle={toStyle} />
      <StyleItemSheet id={selStyle} onClose={() => setSelStyle(null)} onWish={() => setWishOpen(true)} onStyle={toStyle} onPlus={openPlus} />
      <WishSheet open={wishOpen} onClose={() => setWishOpen(false)} onClaimed={(r) => openStyle(r.style)} />
      <StyleSheet open={!!styleFor} onClose={() => setStyleFor(null)} ghostId={styleFor} onPlus={openPlus} />
    </div>
  );
}
