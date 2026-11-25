/**
 * Keeps the widget on the home screen in step with the app (android/…/WidgetPlugin.java). The Android
 * app only; in a browser nothing happens here.
 *
 * The widget is a guest: it gets a copy of a few values (logic/widget.ts) and a portrait of the
 * companion, and nothing it does or fails to do may touch the save, a session or a screen. Every
 * change is passed on after a short wait, so a burst of them goes as one; a session that starts,
 * pauses, goes on or ends goes at once, and so does everything when the app leaves the screen.
 */
import { App as NativeApp } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { widgetData } from '../logic/widget';
import { renderPortrait } from '../rig/rig';
import { getState, onChange, startSession } from '../state/store';
import type { State } from '../state/store';
import { NATIVE, haptic } from './device';

interface Bridge {
  /** data: WidgetData as JSON. portrait: a PNG in base64, only when the companion changed. */
  update(o: { data: string; portrait?: string }): Promise<void>;
  placed(): Promise<{ placed: boolean }>;
  pin(): Promise<{ asked: boolean }>;
  /** The start button of the widget was tapped just now: true once per tap. */
  takeStart(): Promise<{ start: boolean }>;
}
const bridge = registerPlugin<Bridge>('Widget');

/**
 * The start button of the widget: a session with the span and tag chosen last, as the start button on
 * the clearing would start it. Not before the first ride through the app, and not over a running one:
 * then the tap only opened the app.
 */
async function takeStart() {
  try {
    if (!(await bridge.takeStart()).start) return;
    const s = getState();
    if (!s.onboarded || s.active) return;
    startSession(s.lastDuration, s.lastTag);
    haptic.success();
  } catch {
    /* the tap opened the app, nothing more */
  }
}

/** Side of the portrait in pixels: sharp on a 2×2 widget and far below what a widget may carry. */
const PORTRAIT_PX = 256;
const WAIT_MS = 1500;
/** The first time a little after the start, once the first screen is drawn. */
const FIRST_MS = 4000;

let sentData = '';
let sentGhost = '';
let sessionKey = '';
let timer: ReturnType<typeof setTimeout> | null = null;
let busy = false;
let again = false;

const sessionOf = (s: State) => (s.active ? `${s.active.id}|${s.active.pausedAt}|${s.active.pausedMs}` : '');

async function portraitPng(id: string): Promise<string> {
  const cv = await renderPortrait({ ghost: id }, PORTRAIT_PX);
  return cv.toDataURL('image/png').split(',')[1];
}

async function send() {
  timer = null;
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    const d = widgetData(getState(), Date.now());
    const data = JSON.stringify(d);
    const portrait = d.ghost !== sentGhost ? await portraitPng(d.ghost) : undefined;
    if (data !== sentData || portrait) {
      await bridge.update({ data, portrait });
      sentData = data;
      if (portrait) sentGhost = d.ghost;
    }
  } catch {
    /* the widget keeps what it had; the next change tries again */
  } finally {
    busy = false;
    if (again) {
      again = false;
      later(0);
    }
  }
}

/** A change that waits does not push back one already waiting: a burst goes as one. */
function later(ms: number) {
  if (timer !== null) {
    if (ms > 0) return;
    clearTimeout(timer);
  }
  timer = setTimeout(() => void send(), ms);
}

function changed() {
  try {
    const k = sessionOf(getState());
    const urgent = k !== sessionKey;
    sessionKey = k;
    later(urgent ? 0 : WAIT_MS);
  } catch {
    /* never in the way of the change itself */
  }
}

export function initWidget() {
  if (!NATIVE) return;
  try {
    sessionKey = sessionOf(getState());
    onChange(changed);
    // In the background the page may be put to sleep before a timer fires: what is due goes now.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      if (timer !== null) clearTimeout(timer);
      void send();
    });
    later(FIRST_MS);
    // a tap on the start button opens the app: from scratch, or brings it back from the background
    void takeStart();
    void NativeApp.addListener('resume', () => void takeStart());
  } catch {
    /* no widget then, the app as always */
  }
}
