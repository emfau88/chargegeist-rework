// One run through the app as a person would do it, with checks at every step. It covers what the unit
// tests cannot see: that one screen really leads to the next, and that a save survives a reload, a
// second open instance and an old version.
//
// Needs the dev server (npm run dev). Usage: node tools/flow.mjs   (exit code 1 if a check fails)
import { chromium } from 'playwright-core';

const URL = process.env.CG_URL ?? 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const KEY = 'chargegeist.v3';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// every run at noon of its own day: nothing here may depend on the hour the test happens to run at
const off = ((12 - new Date().getUTCHours() + 36) % 24) - 12;
const NOON_ZONE = off === 0 ? 'Etc/GMT' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`;
const CONTEXT = { viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: NOON_ZONE };

let failed = 0;
const errors = [];
function check(label, ok, extra = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' · ' + extra : ''}`);
}
function watch(page) {
  page.on('pageerror', (e) => errors.push('PAGE ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE ' + m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
}
const state = (page) => page.evaluate(() => window.__cg.getState());
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const has = async (page, sel) => (await page.locator(sel).count()) > 0;
async function until(fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(120);
  }
  return false;
}

/* ---------- 1. the onboarding: one screen, pick the ghost you start with ---------- */
const ctx = await browser.newContext(CONTEXT);
const page = await ctx.newPage();
watch(page);
await page.goto(URL);
check('the first screen opens with its entrance', await has(page, '.ob-body.title.wait, .ob-body.title.enter'));
check('the entrance ends by itself', await until(() => has(page, '.ob-body.title.done')));
const plate = () => page.locator('.pick-chip.on b').innerText();
const chip = (name) => page.locator('.pick-chip', { hasText: name });
check('three ghosts to choose from, the first starter picked', (await page.locator('.pick-chip').count()) === 3 && (await plate()) === 'Skye', await plate());
await chip('Hazel').click();
await sleep(500);
check('a tap on a portrait picks that ghost', (await plate()) === 'Hazel', await plate());
await chip('Kürbis-Pip').click();
await sleep(500);
check('and another tap picks another', (await plate()) === 'Kürbis-Pip' && (await page.locator('.pick-chip.on').count()) === 1, await plate());
check('the button names the pick', (await page.locator('.title-foot .btn').innerText()).includes('Kürbis-Pip'));
await page.locator('.title-foot .btn').click();
check('the welcome gift opens', await until(() => has(page, '.page.drop')));
let s = await state(page);
check('the pick is your companion, and the only ghost you have', s.onboarded && s.companion === 'pumpkin' && Object.keys(s.ghosts).join() === 'pumpkin', JSON.stringify({ onboarded: s.onboarded, companion: s.companion, ghosts: Object.keys(s.ghosts) }));
check('the gift is a first drop', s.pending.length === 1 && s.pending[0].kind === 'first');

/* ---------- 2. the gift can wait ---------- */
const cards = s.pending[0].cards;
await page.locator('.drop-head .icon-btn').click();
check('closing the gift leads to the clearing, where it waits beside the ghost', await until(() => has(page, '.page.home .hero-drop')));
check('the tab bar is there', await has(page, '.tabbar'));
await page.locator('.hero-drop').click();
await until(() => has(page, '.page.drop'));
s = await state(page);
check('it waits with the same cards', JSON.stringify(s.pending[0].cards) === JSON.stringify(cards) && Array.isArray(cards), JSON.stringify(cards));
await page.getByText('Alle aufdecken').click();
await sleep(1900);
await page.locator('.bottom-actions .btn-warm').click();
await sleep(1700);
s = await state(page);
const first = Object.keys(s.styles)[0];
check('one card is kept and the drop is gone', Object.keys(s.styles).length === 1 && s.pending.length === 0);
check('the first style goes straight on', !!first && Object.values(s.looks.pumpkin ?? {}).includes(first), JSON.stringify(s.looks));
await page.getByText('Weiter', { exact: true }).click();
check('then the clearing, with nothing waiting', await until(async () => (await has(page, '.page.home')) && !(await has(page, '.hero-drop'))));

/* ---------- 3. a session: start, pause, reload, go on, finish ---------- */
await page.evaluate(() => window.__cg.mutate((x) => (x.dev.speed = true))); // one second is one minute
await page.locator('.dur-seg').first().click(); // 5 minutes
await page.locator('.start-btn').click();
check('the session runs', await until(() => has(page, '.page.focus')));
await sleep(1200);
await page.locator('.page.focus .btn', { hasText: 'Pause' }).click();
check('it pauses', await until(() => has(page, '.page.focus.is-paused')));
const tip = await page.locator('.focus-tip').innerText();
check('the paused timer does not tell you to put the phone away', tip === 'Mach weiter, wenn du bereit bist.', tip);
const clock = await page.locator('.clock').innerText();
await page.reload();
check('after a reload the session is still there, paused', await until(() => has(page, '.page.focus.is-paused')));
check('and the clock stands where it stood', (await page.locator('.clock').innerText()) === clock, clock);
await page.locator('.page.focus .btn', { hasText: 'Weiter' }).click();
check('it ends by itself', await until(() => has(page, '.page.complete'), 12000));
s = await state(page);
check('five minutes are saved for today', s.sessions.length === 1 && s.sessions[0].min === 5 && s.active === null, JSON.stringify(s.sessions));
check('five minutes bring the drop of the day', s.pending.some((p) => p.kind === 'daily'));
await page.locator('.page.complete').click({ position: { x: 20, y: 20 } }); // a tap shows the whole result at once
await page.locator('.bottom-actions .btn-warm').click();
check('the drop opens from the result', await until(() => has(page, '.page.drop')));
await page.locator('.drop-head .icon-btn').click();
check('and can wait as well', await until(() => has(page, '.page.home .hero-drop')));
check('the card under the start button opens it too', await (async () => {
  await page.locator('.drop-card.ready').click();
  const ok = await until(() => has(page, '.page.drop'));
  await page.locator('.drop-head .icon-btn').click();
  await until(() => has(page, '.page.home'));
  return ok;
})());

/* ---------- 4. the week in one row ---------- */
await page.locator('.tab').nth(2).click();
await until(() => has(page, '.chart'));
const days = (await page.locator('.chart .chart-lbl').allTextContents()).map((x) => x.trim());
check('the week names its days so that none can be mixed up', days.join(' ') === 'Mo Di Mi Do Fr Sa So', days.join(' '));
check('one row of days: the bolts are under the bars', (await page.locator('.chart .chart-mark').count()) === 7 && (await page.locator('.week-foot .wd').count()) === 0);
check('today is charged', (await page.locator('.chart .chart-mark.on').count()) === 1);
check('the daily reminder is not offered where it cannot be delivered', await (async () => {
  await page.locator('.tab').nth(3).click();
  await sleep(500);
  return (await page.getByText('Tägliche Erinnerung').count()) === 0;
})());

/* ---------- 5. a second instance of the app ---------- */
const page2 = await ctx.newPage();
watch(page2);
await page2.goto(URL);
await until(() => has(page2, '.page.home'));
await page.evaluate(() => window.__cg.mutate((x) => (x.goal = 45)));
check('the other instance sees a change at once', await until(async () => (await state(page2)).goal === 45, 3000));
// the case that lost data: one instance saves a session, the other one then changes something small
await page.evaluate(() => window.__cg.dev.addMinutes(25));
await page2.evaluate(() => window.__cg.mutate((x) => (x.tags = ['read'])));
const both = await stored(page);
check('a change in one instance does not wipe out a session the other one saved', both.sessions.length === 2 && both.tags.join() === 'read' && both.goal === 45, JSON.stringify({ sessions: both.sessions.length, tags: both.tags, goal: both.goal }));
await page2.close();
await ctx.close();

/* ---------- 6. a save from before the starters changed ---------- */
const old = { ...both, companion: 'volti', firstCompanion: 'volti', pending: [], ghosts: { volti: { at: 1, via: 'start', seen: true }, ember: { at: 1, via: 'hours', seen: true }, kitsune: { at: 1, via: 'spark', seen: true } }, bonds: { volti: { hearts: 42, rest: 2, day: '', touched: [], seen: 2 } }, looks: {}, names: { volti: 'Blitz' } };
delete old.shelf;
const ctx2 = await browser.newContext(CONTEXT);
await ctx2.addInitScript(
  ([k, save]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, save);
    }
  },
  [KEY, JSON.stringify(old)],
);
const page3 = await ctx2.newPage();
watch(page3);
await page3.goto(URL);
check('an old save opens on the clearing', await until(() => has(page3, '.page.home')));
s = await state(page3);
check('its sessions are all there', s.sessions.length === 2);
check('the first starter took over, the old ones wait on the shelf with their bond', s.companion === 'aviator' && s.shelf?.volti?.bond?.hearts === 42 && !s.ghosts.volti, JSON.stringify({ companion: s.companion, shelf: Object.keys(s.shelf ?? {}) }));
await ctx2.close();

const seen = [...new Set(errors)];
check('no errors in the browser', seen.length === 0, seen.join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
