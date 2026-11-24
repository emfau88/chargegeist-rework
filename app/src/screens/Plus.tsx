import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { sfx } from '../platform/audio';
import { REAL_PURCHASE, buyPlus, plusForSale, plusPrice, syncPlus } from '../platform/billing';
import { RELEASE } from '../platform/build';
import { haptic } from '../platform/device';
import { setPlus, useAppState } from '../state/store';
import { Btn, Icon, IconBtn, Sheet, toast } from '../ui/kit';
import { CompanionStage } from '../ui/stage';
import { THEMES } from '../ui/themes';

const BENEFITS: [string, 'plus_b1_t' | 'plus_b2_t' | 'plus_b3_t' | 'plus_b4_t', 'plus_b1_d' | 'plus_b2_d' | 'plus_b3_d' | 'plus_b4_d'][] = [
  ['palette', 'plus_b1_t', 'plus_b1_d'],
  ['music', 'plus_b2_t', 'plus_b2_d'],
  ['chart', 'plus_b3_t', 'plus_b3_d'],
  ['crown', 'plus_b4_t', 'plus_b4_d'],
];

export function Plus({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const [sim, setSim] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [busy, setBusy] = useState(false);
  const price = plusPrice() ?? t('plus_price');
  const themes = THEMES.filter((x) => x.plus);

  const bought = () => {
    setPlus(true);
    setSim(false);
    sfx.unlock();
    haptic.big();
    setCheer((c) => c + 1);
  };
  // in the release Google Play takes the payment; the prototype only pretends
  const buy = async () => {
    if (!REAL_PURCHASE) return setSim(true);
    if (busy) return;
    setBusy(true);
    const r = await buyPlus();
    setBusy(false);
    if (r === 'bought') bought();
    else if (r !== 'cancelled') toast(t(r === 'pending' ? 'plus_pending' : 'plus_failed'), { icon: 'crown' });
  };
  const restore = async () => {
    const r = await syncPlus();
    toast(t(r ? 'plus_restored' : r === false ? 'plus_nothing' : 'plus_failed'), { icon: 'restore' });
  };

  return (
    <div class="page plus-page">
      <header class="plus-head">
        <IconBtn icon="close" label={t('close')} onClick={onClose} />
      </header>
      <div class="plus-hero">
        <div class="theme-strip" aria-hidden="true">
          {themes.map((th) => (
            <span key={th.id} style={{ background: th.img ? `${th.veil}, url(${th.img}) center/cover, ${th.css}` : th.css }} />
          ))}
        </div>
        <CompanionStage ghostId={s.companion} level={s.plus ? 1 : 0.5} zoom={1.2} cheer={cheer} class={`plus-stage ${s.plus ? 'supporter' : ''}`} interactive onPoke={() => sfx.poke()} />
      </div>
      <h1 class="plus-title">
        <Icon name="crown" size={26} /> {t('plus_title')}
      </h1>
      <p class="plus-sub">{t('plus_sub')}</p>

      <ul class="benefits">
        {BENEFITS.map(([icon, tt, dd]) => (
          <li key={tt}>
            <span class="benefit-icon">
              <Icon name={icon} size={20} />
            </span>
            <span>
              <b>{t(tt)}</b>
              <small>{t(dd)}</small>
            </span>
          </li>
        ))}
      </ul>
      <p class="fair">
        <Icon name="heart" size={16} /> {t('plus_fair')}
      </p>

      <div class="stack bottom-actions plus-actions">
        {s.plus ? (
          <p class="ok-chip big">
            <Icon name="check" size={18} /> {t('plus_owned')}
          </p>
        ) : !plusForSale() ? null : (
          <>
            <Btn kind="warm" big icon="sparkle" onClick={buy}>
              {t('plus_buy', { price })}
            </Btn>
            <small class="muted center">{t('plus_once')}</small>
            <div class="plus-links">
              <button type="button" class="link-btn" onClick={restore}>
                {t('plus_restore')}
              </button>
              <button type="button" class="link-btn" onClick={onClose}>
                {t('not_now')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* the simulated purchase belongs to the prototype; the release has no way to get Plus without paying */}
      {!RELEASE && (
        <Sheet open={sim} onClose={() => setSim(false)} title={t('plus_sim_title')}>
          <p class="muted">{t('plus_sim_body')}</p>
          <div class="sim-price">
            <b>{t('plus_title')}</b>
            <span>{price}</span>
          </div>
          <Btn kind="warm" big onClick={bought}>
            {t('plus_sim_buy')}
          </Btn>
        </Sheet>
      )}
    </div>
  );
}
