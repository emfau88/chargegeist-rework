/**
 * What this build is. The web prototype has a developer menu, debug access and a simulated purchase.
 * The store release (built with `vite build --mode android`, see .env.android) has none of them.
 */
export const RELEASE = import.meta.env.VITE_RELEASE === '1';

/**
 * Whether Plus can be bought in this build. In the release it is neither offered nor shown until it
 * exists as a product in Google Play and the purchase runs through Play Billing.
 */
export const PLUS_FOR_SALE = !RELEASE;
