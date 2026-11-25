import type { CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RARITY_COLOR, WISH_COST, ghost, style } from '../data/catalog';
import { fmtDate, nameOf, quoteOf, t } from '../i18n';
import { BOND_MAX, bondLevel, bondProgress } from '../logic/bond';
import { CHARGE_DAY_MIN, WEEK_TARGET, chargeWeek, minutesByDay } from '../logic/progress';
import { fmtMinutes } from '../logic/time';
import { sfx } from '../platform/audio';
import { plusForSale } from '../platform/billing';
import { haptic } from '../platform/device';
import { addWidget, widgetHintOpen } from '../platform/widget';
import type { RigApi } from '../rig/rig';
import {
  bondOf,
  companionName,
  currentBoss,
  dailyDropOpen,
  now,
  sparkTarget,
  startSession,
  thankedForPlus,
  todayMinutes,
  useAppState,
  widgetOffered,
} from '../state/store';
import type { TagId } from '../state/store';
import { Bar, Btn, Icon, toast } from '../ui/kit';
import { CompanionSheet, DurationSheet, GhostSheet, SparkMeter, StyleSheet, TagSheet, WishSheet } from '../ui/sheets';
import { CompanionStage, Portrait } from '../ui/stage';
import { StyleBadge } from '../ui/style';

const PRESETS = [5, 15, 25, 50];
/** The greeting comes once per app start. */
let greeted = false;

function greeting(): string {
  const h = new Date(now()).getHours();
  if (h < 5) return t('hello_night');
  if (h < 11) return t('hello_morning');
  if (h < 18) return t('hello_day');
  if (h < 23) return t('hello_evening');
  return t('hello_night');
}

export function WeekDots({ compact }: { compact?: boolean }) {
  const s = useAppState();
  const wk = chargeWeek(minutesByDay(s.sessions), now());
  const letters = t('wd').split(',');
  return (
    <div class={`week ${compact ? 'compact' : ''}`} aria-label={`${t('home_week')}: ${t('home_week_count', { n: wk.count, target: WEEK_TARGET })}`}>
      {wk.days.map((d, i) => (
        <span key={d.key} class={`wd ${d.charged ? 'on' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}`}>
          <i>{d.charged ? <Icon name="bolt" size={compact ? 11 : 13} /> : null}</i>
          <small>{letters[i]}</small>
        </span>
      ))}
    </div>
  );
}

export function Home({ openDrop, openPlus }: { openDrop: (id: string) => void; openPlus: () => void }) {
  const s = useAppState();
  const [durOpen, setDurOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [styleFor, setStyleFor] = useState<string | null>(null);
  const [ghostOpen, setGhostOpen] = useState<string | null>(null);
  const [dur, setDur] = useState(s.lastDuration);
  const [tag, setTag] = useState<TagId>(s.lastTag);
  const [cheer, setCheer] = useState(0);
  // woken by a touch at night: he stays up while Home is open
  const [woke, setWoke] = useState(false);

  const today = todayMinutes(s);
  const level = Math.min(1, today / s.goal);
  const full = today >= s.goal;
  const name = companionName(s);
  const wk = chargeWeek(minutesByDay(s.sessions), now());
  const pending = s.pending[0];
  const boss = currentBoss(s);
  const bossG = ghost(boss.ghost);
  const wish = s.wish.target ? style(s.wish.target) : null;
  const target = sparkTarget(s);
  const wishCost = wish ? WISH_COST[wish.rarity] : 0;
  const sleepy = !woke && (new Date(now()).getHours() >= 23 || new Date(now()).getHours() < 5);
  const bond = bondProgress(bondOf(s, s.companion));
  const custom = !PRESETS.includes(dur);
  const pick = (n: number) => {
    haptic.tap();
    sfx.tap();
    setDur(n);
  };

  // from the Familiar stage on he greets you: a wave and his saying in a bubble. Once after Plus came he
  // thanks you instead, with a jump for joy, and points to the gift in the style menu.
  const rig = useRef<RigApi | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const thanks = s.plus && !s.plusThanked;
  useEffect(() => {
    const say = thanks ? t('plus_thanks') : !greeted && !sleepy && bondLevel(bondOf(s, s.companion)) >= 1 ? `“${quoteOf(ghost(s.companion))}”` : null;
    if (!say) return;
    greeted = true;
    const a = setTimeout(() => {
      if (thanks) {
        setWoke(true);
        rig.current?.celebrate(true);
        sfx.unlock();
        haptic.big();
      } else rig.current?.greet();
      setBubble(say);
    }, 800);
    const b = setTimeout(() => {
      setBubble(null);
      if (thanks) thankedForPlus();
    }, 5600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [thanks]);

  const start = () => {
    sfx.start();
    haptic.success();
    startSession(dur, tag);
  };

  // the offer of the widget, on an app open after the first finished session (platform/widget.ts)
  const widgetHint = widgetHintOpen() && !s.widget.placed && !s.widget.answered;
  const answerWidget = async (add: boolean) => {
    widgetOffered(true);
    if (add && !(await addWidget())) toast(t('widget_how'), { icon: 'widget' });
  };

  return (
    <div class="page home">
      <header class="home-head">
        <div>
          <p class="eyebrow">{fmtDate(now(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greeting()}</h1>
        </div>
        {s.plus ? (
          <span class="plus-badge" title="Plus">
            <Icon name="crown" size={16} /> Plus
          </span>
        ) : plusForSale() ? (
          <button type="button" class="plus-pill" onClick={openPlus}>
            <Icon name="sparkle" size={15} /> Plus
          </button>
        ) : null}
      </header>

      {s.settings.showWeek && (
        <div class="week-row">
          <WeekDots compact />
          <span class={`week-label ${wk.done ? 'done' : ''}`}>{wk.done ? t('home_week_done') : t('home_week_count', { n: wk.count, target: WEEK_TARGET })}</span>
        </div>
      )}

      <section class="hero">
        <CompanionStage
          ghostId={s.companion}
          level={level}
          mode={sleepy && !full ? 'sleep' : 'idle'}
          interactive
          zoom={1.3}
          overscan={{ top: 0.25, side: 0.12, bottom: 0.06 }}
          shiftY={10}
          cheer={cheer}
          cheerBig={false}
          attend={['.hero-drop', '.start-btn']}
          ground
          tired={new Date(now()).getHours() >= 21 || new Date(now()).getHours() < 6}
          onPoke={() => {
            sfx.poke();
            haptic.tap();
          }}
          onWake={() => setWoke(true)}
          class={`hero-stage ${s.plus ? 'supporter' : ''}`}
          label={name}
          apiRef={rig}
        />
        {bubble && (
          <p class="greet-bubble" role="status">
            {bubble}
          </p>
        )}
        <button type="button" class={`hero-dress ${thanks && bubble ? 'gift' : ''}`} onClick={() => setStyleFor(s.companion)} aria-label={t('style_title')}>
          <Icon name="palette" size={20} />
        </button>
        {/* a waiting drop is a mark beside the ghost: it takes no room, so nothing below it moves when one comes */}
        {pending && (
          <button type="button" class="hero-drop" onClick={() => openDrop(pending.id)} aria-label={`${t('home_drop_ready_title')}. ${t('home_drop_open')}`}>
            <span class="hero-drop-icon">
              <Icon name="gift" size={22} />
            </span>
            <small>{t('home_drop_mark')}</small>
          </button>
        )}
        <button type="button" class="hero-name" onClick={() => setCompOpen(true)} aria-label={t('home_companion_switch')}>
          <b>{full ? t('home_charged', { name }) : sleepy ? t('home_sleeping', { name }) : t('home_ready', { name })}</b>
          <Icon name="chevronDown" size={16} />
        </button>
        <button type="button" class={`bond-line ${bond.level >= BOND_MAX ? 'gold' : ''}`} onClick={() => setGhostOpen(s.companion)} aria-label={t('bond_badge', { name, stage: t(`bond_${bond.level}`) })}>
          <Icon name="heart" size={13} />
          {bond.hearts === 0 ? (
            <span>{t('home_bond_first', { name })}</span>
          ) : bond.to === null ? (
            <b>{t(`bond_${bond.level}`)}</b>
          ) : (
            <>
              <span>{t('home_bond_line', { stage: t(`bond_${bond.level}`), n: bond.hearts, to: bond.to })}</span>
              <i class="bond-line-bar">
                <i style={{ width: `${bond.frac * 100}%` }} />
              </i>
            </>
          )}
        </button>
        <div class="today-row">
          <span>
            <Icon name="bolt" size={14} /> {t('home_today')}
          </span>
          <Bar value={level} thin color="var(--charge)" />
          <span class="today-num">{t('home_goal_of', { n: Math.round(today), goal: s.goal })}</span>
        </div>
      </section>

      <section class="launch">
        <div class="dur-row" role="group" aria-label={t('min')}>
          {PRESETS.map((n) => (
            <button type="button" key={n} class={`dur-seg ${dur === n ? 'active' : ''}`} aria-pressed={dur === n} onClick={() => pick(n)}>
              <b>{n}</b>
              <small>{t('min')}</small>
            </button>
          ))}
          <button
            type="button"
            class={`dur-seg ${custom ? 'active' : ''}`}
            aria-pressed={custom}
            onClick={() => {
              haptic.tap();
              sfx.tap();
              setDurOpen(true);
            }}
          >
            {custom ? <b>{dur}</b> : <Icon name="clock" size={19} />}
            <small>{custom ? t('min') : t('home_custom')}</small>
          </button>
        </div>
        <div class="launch-row">
          <button type="button" class="tag-btn" onClick={() => setTagOpen(true)}>
            <Icon name="tag" size={16} /> {t(`tag_${tag}`)}
          </button>
          <Btn kind="primary" big icon="bolt" class="start-btn" onClick={start}>
            {t('home_start')}
          </Btn>
        </div>
      </section>

      {widgetHint && (
        <div class="card drop-card widget-hint">
          <Portrait id={s.companion} size={50} />
          <span class="card-text">
            <b>{t('widget_hint_title', { name })}</b>
            <small>{t('widget_hint_body')}</small>
            <span class="widget-hint-btns">
              <Btn kind="ghost" class="btn-small" onClick={() => void answerWidget(false)}>
                {t('widget_hint_no')}
              </Btn>
              <Btn kind="primary" icon="widget" class="btn-small" onClick={() => void answerWidget(true)}>
                {t('widget_hint_add')}
              </Btn>
            </span>
          </span>
        </div>
      )}

      {pending ? (
        <button type="button" class="card drop-card ready" onClick={() => openDrop(pending.id)}>
          <span class="drop-icon">
            <Icon name="gift" size={24} />
          </span>
          <span class="card-text">
            <b>{t('home_drop_ready_title')}</b>
            <small>{t('home_drop_ready_short')}</small>
          </span>
          <span class="btn btn-warm btn-small">{t('home_drop_open')}</span>
        </button>
      ) : dailyDropOpen(s) ? (
        <div class="card drop-card">
          <span class="drop-icon dim">
            <Icon name="gift" size={24} />
          </span>
          <span class="card-text">
            <b>{t('home_drop_next_title')}</b>
            <small>{t('home_drop_next_body')}</small>
          </span>
          <span class="drop-meter">
            <Bar value={today / CHARGE_DAY_MIN} thin color="var(--warm)" />
            <small>{Math.min(CHARGE_DAY_MIN, Math.floor(today))}/{CHARGE_DAY_MIN}</small>
          </span>
        </div>
      ) : (
        <div class="card drop-card">
          <span class="drop-icon dim">
            <Icon name="check" size={24} />
          </span>
          <span class="card-text">
            <b>{t('home_drop_done_title')}</b>
            <small>{t('home_drop_done_body')}</small>
          </span>
        </div>
      )}

      <div class="duo">
        <button type="button" class="card mini" onClick={() => setWishOpen(true)} style={{ '--rc': wish ? RARITY_COLOR[wish.rarity] : 'var(--warm)' } as CSSProperties}>
          <span class="mini-head">
            <Icon name="star" size={15} /> {t('home_wish')}
          </span>
          {wish ? (
            <>
              <StyleBadge id={wish.id} size={54} />
              <b class="mini-title">{nameOf(wish)}</b>
              <Bar value={s.wish.energy / wishCost} thin color="var(--rc)" />
              <small>{s.wish.energy >= wishCost ? t('home_wish_ready') : `${s.wish.energy} / ${wishCost}`}</small>
            </>
          ) : (
            <>
              <span class="mini-empty">
                <Icon name="plus" size={26} />
              </span>
              <small>{t('home_wish_pick')}</small>
            </>
          )}
        </button>
        <div class={`card mini boss ${boss.done ? 'done' : ''}`}>
          <span class="mini-head">
            <Icon name="flame" size={15} /> {t('home_boss')}
          </span>
          {/* 64 as .mini-ghost.portrait draws it: asked for at 62, the empty place was 2 px lower than the picture, and the tiles below jumped when it came */}
          <Portrait id={bossG.id} size={64} class="mini-ghost" />
          <b class="mini-title">{nameOf(bossG)}</b>
          <Bar value={wk.minutes / boss.goal} thin color="var(--season)" />
          <small>{boss.done ? (s.ghosts[boss.ghost]?.via === 'boss' ? t('home_boss_calmed') : t('home_boss_calmed_dupe')) : `${fmtMinutes(wk.minutes, true)} / ${fmtMinutes(boss.goal, true)}`}</small>
        </div>
      </div>

      {target && (
        <section class="spark-card">
          <p class="spark-card-head">
            <Icon name="bolt" size={14} /> {t('home_spark')}
          </p>
          <SparkMeter ghostId={target} onClick={() => setGhostOpen(target)} />
        </section>
      )}

      <DurationSheet open={durOpen} onClose={() => setDurOpen(false)} value={dur} onPick={setDur} />
      <TagSheet open={tagOpen} onClose={() => setTagOpen(false)} value={tag} onPick={setTag} />
      <CompanionSheet
        open={compOpen}
        onClose={() => {
          setCompOpen(false);
          setCheer((c) => c + 1);
        }}
      />
      <WishSheet open={wishOpen} onClose={() => setWishOpen(false)} />
      <StyleSheet
        open={!!styleFor}
        ghostId={styleFor}
        onClose={() => {
          setStyleFor(null);
          setCheer((c) => c + 1);
        }}
      />
      <GhostSheet
        id={ghostOpen}
        onClose={() => setGhostOpen(null)}
        onStyle={(id) => {
          setGhostOpen(null);
          setStyleFor(id);
        }}
      />
    </div>
  );
}

