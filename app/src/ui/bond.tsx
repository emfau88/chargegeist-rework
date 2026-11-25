/** The bond with a ghost on screen: the bond card and the level-up celebration. */
import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ghost } from '../data/catalog';
import { t } from '../i18n';
import type { Key } from '../i18n';
import { BOND_MAX, bondLevel, bondProgress } from '../logic/bond';
import { sfx } from '../platform/audio';
import { haptic } from '../platform/device';
import { ackBond, bondOf, bondUps, companionName, useAppState } from '../state/store';
import { Bar, Btn, Icon, Sheet } from './kit';
import { CompanionStage } from './stage';

const stage = (l: number) => t(`bond_${l}` as Key);
const perk = (l: number) => t(`bond_perk_${l}` as Key);

/** Stage, hearts and the way to the next stage, for the ghost sheet. */
export function BondCard({ ghostId }: { ghostId: string }) {
  const s = useAppState();
  const p = bondProgress(bondOf(s, ghostId));
  const next = p.level < BOND_MAX ? p.level + 1 : null;
  return (
    <div class={`bond-card ${p.level >= BOND_MAX ? 'gold' : ''}`}>
      <div class="bond-head">
        <span class="bond-heart">
          <Icon name="heart" size={17} />
        </span>
        <span class="bond-title">
          <small>{t('bond_title')}</small>
          <b>{stage(p.level)}</b>
        </span>
        <span class="bond-count">{t('bond_hearts', { n: p.hearts })}</span>
      </div>
      <Bar value={p.frac} color={p.level >= BOND_MAX ? 'var(--mythic)' : 'var(--heart)'} thin />
      <p class="bond-next">
        {next !== null && p.to !== null ? (
          <>
            <b>{t('bond_next', { n: p.to - p.hearts, stage: stage(next) })}</b> · {perk(next)}
          </>
        ) : (
          <b>{t('bond_max')}</b>
        )}
      </p>
      <small class="muted bond-how">{t('bond_how')}</small>
    </div>
  );
}

interface Up {
  id: string;
  from: number;
  to: number;
}

/**
 * Celebrates a new bond stage once it is reached: the ghost cheers big and a card says what it brings.
 * Waits while `active` is false (focus, results, drops), so it never covers a running moment.
 */
export function BondUpHost({ active }: { active: boolean }) {
  const s = useAppState();
  const next = active ? (bondUps(s)[0] ?? null) : null;
  const [up, setUp] = useState<Up | null>(null);
  const [open, setOpen] = useState(false);
  const [cheer, setCheer] = useState(0);

  useEffect(() => {
    if (!next || open) return;
    const id = setTimeout(() => {
      const b = bondOf(s, next);
      setUp({ id: next, from: b.seen, to: bondLevel(b) });
      setOpen(true);
      sfx.unlock();
      haptic.big();
    }, 700);
    return () => clearTimeout(id);
  }, [next, open]);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setCheer((c) => c + 1), 380);
    return () => clearTimeout(id);
  }, [open]);

  if (!up) return null;
  const close = () => {
    ackBond(up.id);
    setOpen(false);
  };
  const perks = Array.from({ length: up.to - up.from }, (_, i) => up.from + 1 + i);
  return (
    <Sheet open={open} onClose={close} class="bond-up-sheet">
      <div class="bond-up" style={{ '--cg': ghost(up.id).glow } as CSSProperties}>
        {/* the drawing stays inside the sheet, which cuts off the rest anyway: wider, it could push the sheet sideways */}
        <CompanionStage ghostId={up.id} level={0.8} zoom={1.1} overscan={{ top: 0.09, side: 0.07, bottom: 0.04 }} class="bond-up-stage" cheer={cheer} interactive />
        <span class={`bond-chip big ${up.to >= BOND_MAX ? 'gold' : ''}`}>
          <Icon name="heart" size={16} /> {stage(up.to)}
        </span>
        <h2>{t(`bond_up_${up.to}` as Key, { name: companionName(s, up.id) })}</h2>
        <ul class="bond-perks">
          {perks.map((l) => (
            <li key={l}>
              <b>{t('bond_up_new')}</b> {perk(l)}
            </li>
          ))}
        </ul>
        <Btn kind="primary" big icon="heart" onClick={close}>
          {t('bond_up_ok')}
        </Btn>
      </div>
    </Sheet>
  );
}
