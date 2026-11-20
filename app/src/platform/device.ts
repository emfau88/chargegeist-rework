/**
 * Thin wrappers over device features. The web versions run in the browser prototype;
 * the Android build swaps in Capacitor plugins behind the same functions.
 */
import { getState } from '../state/store';

/* ---------- haptics ---------- */
export const haptic = {
  tap() {
    if (getState().settings.haptics) navigator.vibrate?.(8);
  },
  success() {
    if (getState().settings.haptics) navigator.vibrate?.([14, 60, 22]);
  },
  big() {
    if (getState().settings.haptics) navigator.vibrate?.([20, 50, 20, 50, 60]);
  },
  /** One soft beat of the purr while the ghost is stroked. */
  purr() {
    if (getState().settings.haptics) navigator.vibrate?.(5);
  },
  press() {
    if (getState().settings.haptics) navigator.vibrate?.(24);
  },
  tickle() {
    if (getState().settings.haptics) navigator.vibrate?.([8, 40, 8, 40, 8]);
  },
};

/* ---------- notifications ---------- */
export function notificationsAllowed(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}
export async function askNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

let endTimer = 0;
/** Notify when the session ends while the app is in the background. */
export function scheduleSessionEnd(inMs: number, title: string, body: string) {
  cancelSessionEnd();
  endTimer = window.setTimeout(() => {
    if (document.visibilityState === 'hidden' && notificationsAllowed()) {
      try {
        new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: 'session-end' });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
  }, Math.max(0, inMs));
}
export function cancelSessionEnd() {
  clearTimeout(endTimer);
}

/* ---------- keep the screen on ---------- */
let lock: WakeLockSentinel | null = null;
let wantLock = false;
export async function keepAwake(on: boolean) {
  wantLock = on;
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock && !lock) void keepAwake(true);
});

/* ---------- share ---------- */
export async function shareImage(blob: Blob, name: string, text: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch {
      /* cancelled: fall through to saving */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}
