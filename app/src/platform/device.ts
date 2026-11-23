/**
 * Thin wrappers over device features. The web versions run in the browser prototype;
 * the Android build swaps in Capacitor plugins behind the same functions.
 */
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { getState } from '../state/store';

/** Inside the Android app (Capacitor). In a browser, also on a phone, this is false. */
export const NATIVE = Capacitor.isNativePlatform();

/* ---------- fullscreen (for testing in the browser) ---------- */
/** Whether this browser lets a page go fullscreen by itself. An iPhone does not: there only the home screen helps. */
export function canFullscreen(): boolean {
  return typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
}
export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}
/** Enters or leaves fullscreen; resolves to whether the page is fullscreen afterwards. */
export async function setFullscreen(on: boolean): Promise<boolean> {
  try {
    if (on) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* refused by the browser: the state below says so */
  }
  return isFullscreen();
}
/** Opened from the home screen, where the manifest already takes the browser bars away. */
export function isStandalone(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

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
/**
 * Whether this build can tell you that a session ended while the phone is locked or the app is in the
 * background. The Android app plans a notification for that moment; a web page cannot be relied on.
 */
export function sessionNoticeSupported(): boolean {
  return NATIVE;
}
/**
 * Whether this build can deliver a reminder every day. A web page cannot: nothing wakes it at the
 * chosen time unless a server pushes to it, and this app has no server. The Android app will plan
 * local notifications and answer true here. Until then the setting is not shown.
 */
export function dailyReminderSupported(): boolean {
  return false;
}
/**
 * Asks for the permission to notify, if it is not there yet. again: ask even if the question was put
 * aside before (the switch in the settings does that; a session that starts does not nag).
 */
export async function askNotifications(again = false): Promise<boolean> {
  if (NATIVE) {
    try {
      let p = await LocalNotifications.checkPermissions();
      // Android asks in a dialog of its own. Once it was refused for good, the dialog no longer shows and
      // the answer stays no: then only the system settings help.
      if (p.display !== 'granted' && (again || p.display !== 'denied')) p = await LocalNotifications.requestPermissions();
      return p.display === 'granted';
    } catch {
      return false;
    }
  }
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
/** The end that is planned right now, for the Android app (0: none). */
let planned = 0;
const END_NOTICE = 1;
/**
 * The notification rings a little after the end: in front, the app ends the session itself at the end
 * and takes the notification back before it rings.
 */
const NOTICE_LAG = 3000;
/**
 * Android rings at the end, whatever the app is doing then: a locked phone stops the page, so the plan has
 * to be made while it still runs. The alarm is not an exact one: that would need a permission of its own,
 * which Android only gives on a page of its settings.
 */
async function planNotice(at: number, title: string, body: string) {
  if (!getState().settings.endNotice) return;
  try {
    // the first session asks for the permission, in Android's own dialog
    if (!(await askNotifications())) return;
    // paused or ended while Android asked: nothing to plan any more
    if (planned !== at) return;
    await LocalNotifications.schedule({
      notifications: [{ id: END_NOTICE, title, body, schedule: { at: new Date(at + NOTICE_LAG), allowWhileIdle: true }, isExactNotification: false }],
    });
  } catch {
    /* no notification: the session still ends by the clock when the app comes back */
  }
}

/** Notify when the session ends while the app is in the background. */
export function scheduleSessionEnd(inMs: number, title: string, body: string) {
  cancelSessionEnd();
  if (NATIVE) {
    planned = Date.now() + Math.max(0, inMs);
    void planNotice(planned, title, body);
    return;
  }
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
  if (NATIVE) {
    planned = 0;
    // the plan, and a notification that rang already: back in the app it has said what it had to say
    void LocalNotifications.cancel({ notifications: [{ id: END_NOTICE }] }).catch(() => {});
    void LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
  }
}

/* ---------- the back gesture of Android ---------- */
/** Calls fn for every back gesture or back button. fn says whether it did something; if not, the app steps back to the home screen. */
export function onBack(fn: () => boolean): () => void {
  if (!NATIVE) return () => {};
  const l = NativeApp.addListener('backButton', () => {
    if (!fn()) void NativeApp.minimizeApp();
  });
  return () => void l.then((h) => h.remove());
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
  if (NATIVE) {
    // the page inside the app can neither share nor download: the picture goes to the cache of the app,
    // and Android's own sheet shares it from there
    try {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
      const file = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
      await Share.share({ text, files: [file.uri] });
    } catch {
      /* closed without sharing */
    }
    return 'shared';
  }
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
