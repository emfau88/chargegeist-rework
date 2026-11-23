// Helpers for the device tests: adb for the phone (lock, home, airplane mode, screenshots) and the
// debug bridge of the WebView for the app itself (tap what is on the page, read the save).
// Works with a debug build only: a release build does not open its WebView for debugging.
import { execFileSync } from 'node:child_process';
import { _android } from 'playwright-core';

export const ADB = process.env.ADB ?? `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`;
export const PKG = 'com.energycrafted.chargegeist';
export const KEY = 'chargegeist.v3';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
export const sh = (cmd) => adb('shell', cmd);
/** The clock of the phone, in milliseconds. Time on the phone is what the app sees. */
export const phoneNow = () => Number(sh('date +%s%3N'));

export function log(...a) {
  console.log(new Date().toTimeString().slice(0, 8), ...a);
}
let failed = 0;
export function check(label, ok, extra = '') {
  if (!ok) failed++;
  log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' · ' + extra : ''}`);
  return ok;
}
export const failures = () => failed;

export async function until(fn, ms = 15000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await fn()) return true;
    } catch {
      /* the page may be reloading: try again */
    }
    await sleep(step);
  }
  return false;
}

/* ---------- the phone ---------- */
export const screenOn = () => /mWakefulness=Awake/.test(sh('dumpsys power'));
/** The lock screen is up. A phone without a lock screen ("None") is never locked: its display only goes dark. */
export const locked = () => /mDreamingLockscreen=true|isKeyguardShowing=true/.test(sh('dumpsys window'));
export const hasLockScreen = () => sh('locksettings get-disabled') !== 'true';
export function lock() {
  if (screenOn()) sh('input keyevent KEYCODE_SLEEP');
}
export async function unlock() {
  sh('input keyevent KEYCODE_WAKEUP');
  await sleep(600);
  sh('wm dismiss-keyguard');
  await sleep(900);
  if (locked()) {
    sh('input swipe 540 1900 540 600 200');
    await sleep(900);
  }
}
export const home = () => sh('input keyevent KEYCODE_HOME');
export const back = () => sh('input keyevent KEYCODE_BACK');
export const launch = () => sh(`am start -n ${PKG}/.MainActivity`);
export const stop = () => sh(`am force-stop ${PKG}`);
export const clearData = () => sh(`pm clear ${PKG}`);
export const inFront = () => sh('dumpsys activity activities').split('\n').some((l) => /topResumedActivity|mResumedActivity|ResumedActivity:/.test(l) && l.includes(PKG));
export const airplane = (on) => sh(`cmd connectivity airplane-mode ${on ? 'enable' : 'disable'}`);
export function shot(path) {
  execFileSync(ADB, ['shell', 'screencap', '-p', '/sdcard/cg_shot.png']);
  execFileSync(ADB, ['pull', '/sdcard/cg_shot.png', path]);
}

/* ---------- the app ---------- */
let device = null;
/** Connects to the WebView of the running app. Call again after the app was closed and opened. */
export async function attach() {
  await detach();
  await until(() => sh(`pidof ${PKG}`).length > 0, 15000);
  let page = null;
  const ok = await until(async () => {
    [device] = await _android.devices();
    const view = await device.webView({ pkg: PKG }, { timeout: 8000 });
    page = await view.page();
    return !!page;
  }, 30000, 500);
  if (!ok) throw new Error('no page in the WebView (is this a debug build, and is the app in front?)');
  return page;
}
export async function detach() {
  if (device) await device.close().catch(() => {});
  device = null;
}
/** The save as it lies in the storage of the app. */
export const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
export const has = async (page, sel) => (await page.locator(sel).count()) > 0;
/** The time the focus screen shows, in seconds. */
export async function clockSeconds(page) {
  const txt = (await page.locator('.clock').first().innerText()).trim();
  const p = txt.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}
