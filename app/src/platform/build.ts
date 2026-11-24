/**
 * What this build is. The web prototype has a developer menu, debug access and a simulated purchase.
 * The store release (built with `vite build --mode android`, see .env.android) has none of them.
 */
export const RELEASE = import.meta.env.VITE_RELEASE === '1';
