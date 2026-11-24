/**
 * Plus as a one-time product of Google Play (android/…/BillingPlugin.java).
 *
 * The prototype in the browser offers Plus with a simulated purchase. The release offers it only once
 * the store has named a price: no product, no account or no store means no offer and no dead button.
 * A purchase is granted and never taken back here.
 */
import { App as NativeApp } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { getState, redraw, setPlus } from '../state/store';
import { RELEASE } from './build';
import { NATIVE } from './device';

/** The product ID in the Play Console. It cannot be changed there once it exists. */
const PLUS_ID = 'plus';

interface Store {
  product(o: { id: string }): Promise<{ price?: string }>;
  owned(): Promise<{ ids: string[] }>;
  buy(o: { id: string }): Promise<{ state: 'bought' | 'pending' | 'cancelled' }>;
}
const store = registerPlugin<Store>('Billing');

/** Whether Plus is paid for through the store in this build. */
export const REAL_PURCHASE = RELEASE && NATIVE;

let price: string | null = null;
/** Whether Plus can be bought right now. */
export const plusForSale = () => !RELEASE || price !== null;
/** The price as the store words it for this account; null in the prototype. */
export const plusPrice = () => price;

/** Asks the store whether this account owns Plus and grants it. Null: the store could not be asked. */
export async function syncPlus(): Promise<boolean | null> {
  if (!REAL_PURCHASE) return getState().plus;
  try {
    const has = (await store.owned()).ids.includes(PLUS_ID);
    if (has && !getState().plus) setPlus(true);
    return has;
  } catch {
    return null;
  }
}

async function refresh() {
  let named: string | null = null;
  // a store that cannot say what is owned cannot sell either: no second question
  if ((await syncPlus()) !== null) {
    try {
      named = (await store.product({ id: PLUS_ID })).price ?? null;
    } catch {
      /* no price: not for sale */
    }
  }
  price = named;
  redraw();
}

/** At the start, and whenever the app comes back: a payment may have gone through in the meantime. */
export function initBilling() {
  if (!REAL_PURCHASE) return;
  void refresh();
  void NativeApp.addListener('resume', () => void refresh());
}

export async function buyPlus(): Promise<'bought' | 'pending' | 'cancelled' | 'failed'> {
  try {
    const { state } = await store.buy({ id: PLUS_ID });
    if (state === 'bought') setPlus(true);
    return state;
  } catch {
    return 'failed';
  }
}
