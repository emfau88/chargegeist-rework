import type { CSSProperties } from 'preact';
import { useState } from 'preact/hooks';
import { COMPANIONS, COMPANION_UNLOCK_HOURS, COSTUME_GHOSTS, GHOSTS, ITEMS, RARITY_COLOR, SETS, WISH_COST, ghost, item, unlockOrder } from '../data/catalog';
import { nameOf, t } from '../i18n';
import { setProgress } from '../logic/progress';
import { haptic } from '../platform/device';
import { companionName, markSeen, outfitOf, ownedItems, useAppState } from '../state/store';
import { Bar, Icon, ItemImg } from '../ui/kit';
import { GhostSheet, ItemSheet, WardrobeSheet, WishSheet, ghostUnlockText } from '../ui/sheets';
import { Portrait } from '../ui/stage';

type Seg = 'ghosts' | 'wardrobe';

export function Collection() {
  const s = useAppState();
  const unseenItems = Object.values(s.items).some((r) => !r.seen);
  const unseenGhosts = Object.values(s.ghosts).some((r) => !r.seen);
  const [seg, setSeg] = useState<Seg>(unseenItems && !unseenGhosts ? 'wardrobe' : 'ghosts');
  const [selGhost, setSelGhost] = useState<string | null>(null);
  const [selItem, setSelItem] = useState<string | null>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [dress, setDress] = useState<string | null>(null);
  const items = ownedItems(s);
  const ghostCount = Object.keys(s.ghosts).length;
  const wish = s.wish.target ? item(s.wish.target) : null;
  const cost = wish ? WISH_COST[wish.rarity] : 0;

  const openGhost = (id: string) => {
    setSelGhost(id);
    markSeen('ghosts', [id]);
  };
  const openItem = (id: string) => {
    setSelItem(id);
    markSeen('items', [id]);
  };
  const toDress = (id: string) => {
    setSelGhost(null);
    setSelItem(null);
    setDress(id);
  };

  const ghostTile = (id: string) => {
    const g = ghost(id);
    const rec = s.ghosts[id];
    const set = g.kind === 'costume' ? setProgress(id, items) : null;
    const rc = g.rarity ? RARITY_COLOR[g.rarity] : g.glow;
    return (
      <button
        type="button"
        key={id}
        class={`tile ghost-tile ${rec ? 'own' : 'missing'} ${rec && !rec.seen ? 'unseen' : ''} ${s.companion === id ? 'active' : ''}`}
        style={{ '--rc': rc, '--cg': g.glow } as CSSProperties}
        onClick={() => openGhost(id)}
        aria-label={rec ? companionName(s, id) : `${nameOf(g)}: ${ghostUnlockText(s, id)}`}
      >
        <span class="tile-art">
          <Portrait id={id} size={84} outfit={outfitOf(s, id)} silhouette={!rec} />
        </span>
        <b class="tile-name">{rec ? companionName(s, id) : nameOf(g)}</b>
        {!rec && set && (
          <span class="tile-req">
            <Bar value={set.have / set.total} thin color="var(--rc)" />
            <small>
              {set.have}/{set.total}
            </small>
          </span>
        )}
        {!rec && !set && (
          <span class="tile-req">
            <small>
              <Icon name="lock" size={11} /> {t('col_tile_hours', { n: COMPANION_UNLOCK_HOURS[unlockOrder(s.firstCompanion).indexOf(id)] ?? 0 })}
            </small>
          </span>
        )}
        {rec && !rec.seen && <span class="new-dot">{t('new_badge')}</span>}
        {s.companion === id && (
          <span class="active-dot" aria-hidden="true">
            <Icon name="bolt" size={12} />
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
          {(['ghosts', 'wardrobe'] as Seg[]).map((x) => (
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
              <Icon name={x === 'ghosts' ? 'ghost' : 'hanger'} size={17} />
              {t(x === 'ghosts' ? 'col_seg_ghosts' : 'col_seg_wardrobe')}
              {x === 'wardrobe' && unseenItems && <i class="seg-dot" />}
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
          <p class="muted count-line">{t('col_items', { n: items.size, total: ITEMS.length })}</p>
          <Bar value={items.size / ITEMS.length} color="linear-gradient(90deg, var(--common), var(--rare), var(--epic), var(--mythic))" />

          <button type="button" class="card wish-banner" onClick={() => setWishOpen(true)} style={{ '--rc': wish ? RARITY_COLOR[wish.rarity] : 'var(--warm)' } as CSSProperties}>
            {wish ? <ItemImg id={wish.id} size={52} /> : <span class="mini-empty"><Icon name="star" size={24} /></span>}
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

          <button type="button" class="card dress-banner" onClick={() => setDress(s.companion)}>
            <Portrait id={s.companion} size={52} outfit={outfitOf(s, s.companion)} />
            <span class="card-text">
              <b>{t('ward_title')}</b>
              <small>{t('ward_body')}</small>
            </span>
            <Icon name="hanger" size={20} />
          </button>

          {SETS.map((set) => {
            const p = setProgress(set.id, items);
            const g = ghost(set.id);
            const joined = !!s.ghosts[set.id];
            return (
              <section class={`set ${p.done ? 'done' : ''}`} key={set.id} style={{ '--sc': g.glow } as CSSProperties}>
                <header class="set-head">
                  <button type="button" class="set-ghost" onClick={() => openGhost(set.id)} aria-label={nameOf(g)}>
                    <Portrait id={set.id} size={40} silhouette={!joined} />
                  </button>
                  <h2>{t('col_outfit', { name: nameOf(g) })}</h2>
                  <span class="set-count">
                    {p.done && <Icon name="check" size={14} />} {p.have}/{p.total}
                  </span>
                </header>
                <Bar value={p.have / p.total} thin color="var(--sc)" />
                <div class="tiles">
                  {set.items.map((iid) => {
                    const it = item(iid);
                    const rec = s.items[iid];
                    return (
                      <button
                        type="button"
                        key={iid}
                        class={`tile ${rec ? 'own' : 'missing'} ${rec && !rec.seen ? 'unseen' : ''} ${s.wish.target === iid ? 'wished' : ''}`}
                        style={{ '--rc': RARITY_COLOR[it.rarity] } as CSSProperties}
                        onClick={() => openItem(iid)}
                        aria-label={rec ? nameOf(it) : t('col_locked')}
                      >
                        <span class="tile-art">
                          <ItemImg id={iid} size={70} silhouette={!rec} />
                        </span>
                        {rec ? <b class="tile-name">{nameOf(it)}</b> : <b class="tile-name q">?</b>}
                        {rec && !rec.seen && <span class="new-dot">{t('new_badge')}</span>}
                        {s.wish.target === iid && (
                          <span class="wish-dot">
                            <Icon name="star" size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      <GhostSheet id={selGhost} onClose={() => setSelGhost(null)} onDress={toDress} />
      <ItemSheet id={selItem} onClose={() => setSelItem(null)} onWish={() => setWishOpen(true)} onDress={toDress} />
      <WishSheet open={wishOpen} onClose={() => setWishOpen(false)} onClaimed={(r) => openItem(r.item)} />
      <WardrobeSheet open={!!dress} onClose={() => setDress(null)} ghostId={dress} />
    </div>
  );
}
