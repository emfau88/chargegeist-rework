// Device tests for the Android app, run against an emulator or a phone with a debug build installed.
//
//   node tools/android_test.mjs fresh <apk>     fresh install in airplane mode: pick, ghost, strokes, sound, timer
//   node tools/android_test.mjs lock            a real five-minute session: lock, unlock before the end
//   node tools/android_test.mjs sleep           ... locked until after the end, with the notification
//   node tools/android_test.mjs home            ... to the home screen and back
//   node tools/android_test.mjs pause           ... paused, app closed, opened again, resumed
//   node tools/android_test.mjs back            the back gesture on sheets, tabs and the collection
//
// Screenshots go to the folder in CG_SHOTS (default: the temp folder).
import { execFileSync } from 'node:child_process';
import { ADB, PKG, adb, airplane, attach, back, check, clockSeconds, detach, failures, has, hasLockScreen, home, inFront, launch, lock, locked, log, phoneNow, save, sh, shot, sleep, stop, unlock, until } from './android_lib.mjs';

const [, , what = 'fresh', arg] = process.argv;
const SHOTS = process.env.CG_SHOTS ?? process.env.TEMP ?? '.';
const snap = (name) => shot(`${SHOTS}/${what}-${name}.png`);

/** Where a spot of the page lies on the screen, in pixels of the phone: the page starts below the status bar. */
async function onScreen(page, sel) {
  const r = await page.locator(sel).first().boundingBox();
  const dpr = await page.evaluate(() => devicePixelRatio);
  const bar = Number((sh('dumpsys window').split('\n').find((l) => l.includes('type=statusBars')) ?? '').match(/\[0,0\]\[\d+,(\d+)\]/)?.[1] ?? 0);
  return { x: Math.round((r.x + r.width / 2) * dpr), y: Math.round((r.y + r.height / 2) * dpr) + bar };
}
/** Whether Android asks for a permission right now, in its own dialog. */
const asking = () => /permissioncontroller/i.test(sh('dumpsys window').split('\n').find((l) => l.includes('mCurrentFocus')) ?? '');
const notices = () => sh('dumpsys notification --noredact').split('\n').filter((l) => l.includes(`pkg=${PKG}`) && l.includes('NotificationRecord'));
const alarms = () => sh('dumpsys alarm').split('\n').filter((l) => l.includes(PKG) && /RTC|ELAPSED/.test(l)).length;
/** Taps "Allow" in Android's permission dialog. */
async function allow() {
  const ui = sh('uiautomator dump /sdcard/ui.xml >/dev/null; cat /sdcard/ui.xml');
  const m = ui.match(/resource-id="[^"]*permission_allow_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (m) sh(`input tap ${(+m[1] + +m[3]) / 2} ${(+m[2] + +m[4]) / 2}`);
  await sleep(1500);
}
/** Whether the app has a sound running, as Android's audio service sees it. */
const audioPlaying = () => {
  const uid = (sh(`pm list packages -U ${PKG}`).match(/uid:(\d+)/) ?? [])[1];
  return sh('dumpsys audio').split('\n').some((l) => l.includes(`u/pid:${uid}/`) && /state:started/.test(l));
};

/** From the first screen to the clearing: pick, gift, keep. */
async function onboard(page) {
  check('the first screen shows', await until(() => has(page, '.ob-body.title'), 20000));
  await until(() => has(page, '.ob-body.title.done'), 15000);
  check('three ghosts to choose from', (await page.locator('.pick-chip').count()) === 3);
  await page.locator('.pick-chip').nth(2).click();
  check('a tap picks another ghost', await until(async () => (await page.locator('.pick-chip.on').count()) === 1 && (await page.locator('.pick-chip').nth(2).getAttribute('class')).includes('on')));
  await page.locator('.pick-chip').nth(0).click();
  await until(async () => (await page.locator('.pick-chip').nth(0).getAttribute('class')).includes('on'));
  await page.locator('.title-foot .btn').click();
  check('the welcome gift opens', await until(() => has(page, '.page.drop')));
  await page.locator('.bottom-actions .btn').first().click(); // reveal all
  let s;
  check('one card is kept', await until(async () => {
    if (!(await has(page, '.page.drop.kept'))) await page.locator('.bottom-actions .btn-warm').click({ timeout: 400 }).catch(() => {});
    s = await save(page);
    return Object.keys(s.styles).length === 1 && s.pending.length === 0;
  }, 20000));
  await until(async () => Object.keys((await save(page)).looks).length > 0, 8000);
  await page.locator('.bottom-actions .btn').last().click(); // continue
  check('the clearing with its tabs', await until(async () => (await has(page, '.page.home')) && (await has(page, '.tabbar'))));
}

/** Starts a session of five minutes at normal speed; returns the phone time of the start. */
async function start5(page) {
  await page.locator('.dur-seg').first().click();
  await page.locator('.start-btn').click();
  check('the session runs', await until(() => has(page, '.page.focus')));
  const s = await save(page);
  check('five minutes at normal speed', s.active?.planned === 5 && s.active?.speed === 1, JSON.stringify(s.active));
  return s.active.startedAt;
}
/** Compares the clock on the page with the time that really passed on the phone. */
async function compare(page, label, startedAt, pausedMs = 0) {
  const shown = await clockSeconds(page);
  const real = 300 - (phoneNow() - startedAt - pausedMs) / 1000;
  return check(`${label}: the clock shows what is left`, Math.abs(shown - real) <= 2, `shown ${shown}s, by the phone's clock ${real.toFixed(1)}s`);
}
async function totals(page) {
  const s = await save(page);
  const bond = s.bonds?.[s.companion] ?? {};
  return { sessions: s.sessions.length, minutes: s.sessions.reduce((a, x) => a + x.min, 0), hearts: bond.hearts ?? 0, drops: s.pending.length, dropsOpened: s.dropsOpened, energy: s.wish?.energy ?? 0, sparks: Object.values(s.sparks?.have ?? {}).reduce((a, b) => a + b, 0), active: !!s.active };
}
/** After a session: credited once, and still once after the app was closed and opened again. */
async function creditedOnce(page, before) {
  check('the result shows', await until(() => has(page, '.page.complete'), 20000));
  let t = await totals(page);
  check('five minutes and one session more', t.sessions === before.sessions + 1 && t.minutes === before.minutes + 5 && !t.active, JSON.stringify(t));
  check('one heart more for five minutes together', t.hearts === before.hearts + 1, `hearts ${before.hearts} -> ${t.hearts}`);
  const dropDue = before.drops === 0 && before.dailyDue;
  if (before.dailyDue !== undefined) check(dropDue ? 'the drop of the day came once' : 'no second drop of the day', t.drops === before.drops + (dropDue ? 1 : 0), `waiting drops ${before.drops} -> ${t.drops}`);
  snap('result');
  await detach();
  stop();
  await sleep(1500);
  launch();
  const p2 = await attach();
  await until(() => has(p2, '.page'), 20000);
  await sleep(2500);
  const again = await totals(p2);
  check('opened again: nothing is credited twice', JSON.stringify(again) === JSON.stringify(t), JSON.stringify(again));
  check('and the app opens on the clearing', await has(p2, '.page.home'));
  return p2;
}
async function ready() {
  await unlock();
  if (!inFront()) launch();
  const page = await attach();
  await until(() => has(page, '.page'), 20000);
  if (!(await has(page, '.page.home'))) {
    if (await has(page, '.ob-body.title')) await onboard(page);
    else {
      await detach();
      stop();
      launch();
      return ready();
    }
  }
  const s = await save(page);
  const today = await page.evaluate(() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
  const before = { ...(await totals(page)), dailyDue: s.dailyDropDay !== today };
  log('before', JSON.stringify(before));
  return { page, before };
}

const TESTS = {
  async fresh() {
    if (arg) {
      sh(`pm uninstall ${PKG}`);
      airplane(true);
      log(execFileSync(ADB, ['install', arg], { encoding: 'utf8' }).trim().split('\n').pop());
    } else airplane(true);
    await sleep(2000);
    check('airplane mode is on', sh('settings get global airplane_mode_on') === '1');
    check('the phone has no network', !/bytes from/.test(sh('ping -c 1 -W 2 8.8.8.8 2>&1 || true')));
    await unlock();
    launch();
    const page = await attach();
    const failed = [];
    page.on('requestfailed', (r) => r.failure()?.errorText !== 'net::ERR_ABORTED' && failed.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    await onboard(page);
    snap('clearing');
    check('nothing failed to load', failed.length === 0, failed.slice(0, 4).join(' | '));
    check('no error on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
    check('no debug access in the app', await page.evaluate(() => !('__cg' in window)));
    check('every picture of the ghost is there', await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/assets/ghosts/')).length) > 10);

    // the ghost is drawn and moves
    const stage = page.locator('.hero-stage canvas').first();
    const a = await stage.screenshot();
    await sleep(700);
    const b = await stage.screenshot();
    check('the ghost is drawn', a.length > 8000, `${a.length} bytes`);
    check('and it moves', !a.equals(b));

    // touching the ghost as a finger does: a tap wakes it or makes it laugh, a long stroke and a hold bring hearts
    const at = await onScreen(page, '.hero-stage');
    const hearts0 = (await totals(page)).hearts;
    sh(`input tap ${at.x} ${at.y}`);
    await sleep(1500);
    sh(`input swipe ${at.x - 170} ${at.y} ${at.x + 170} ${at.y} 2200`);
    const sound = audioPlaying();
    await sleep(1200);
    const hearts1 = (await totals(page)).hearts;
    check('a long stroke brings a heart', hearts1 === hearts0 + 1, `hearts ${hearts0} -> ${hearts1}`);
    sh(`input swipe ${at.x} ${at.y} ${at.x} ${at.y} 900`);
    await sleep(1200);
    const hearts2 = (await totals(page)).hearts;
    check('holding brings another one', hearts2 === hearts1 + 1, `hearts ${hearts1} -> ${hearts2}`);
    snap('stroked');
    sh(`input tap ${at.x} ${at.y}`);
    await sleep(250);
    check('the app plays its sounds', sound || audioPlaying());

    // the timer counts
    const startedAt = await start5(page);
    await sleep(4000);
    await compare(page, 'after a few seconds', startedAt);
    snap('timer');
    // the first session asks whether the app may notify: allow it, as most users do
    check('Android asks whether the app may send notifications', asking());
    snap('permission');
    await allow();
    check('and the app may notify from then on', /granted=true/.test(sh(`dumpsys package ${PKG} | grep POST_NOTIFICATIONS`)));
    await sleep(800);
    // end it early: nothing is credited below a minute
    await page.locator('.page.focus .btn').last().click();
    await sleep(700);
    snap('end-sheet');
    await page.locator('.sheet .btn').last().click().catch(() => {});
    check('ending early leads back', await until(async () => !(await save(page)).active, 8000));
    airplane(false);
  },

  async lock() {
    const { page, before } = await ready();
    const startedAt = await start5(page);
    await sleep(20000);
    await compare(page, 'before locking', startedAt);
    await detach();
    lock();
    await sleep(2000);
    check('the display is locked', locked());
    log('locked for 100 seconds');
    await sleep(100000);
    await unlock();
    check('unlocked: the app is in front again', await until(() => inFront(), 8000));
    const p = await attach();
    check('the session still runs', await until(() => has(p, '.page.focus')));
    await compare(p, 'right after unlocking', startedAt);
    snap('unlocked');
    await sleep(3000);
    await compare(p, 'three seconds later', startedAt);
    log('waiting for the end in front');
    await until(async () => !(await save(p)).active, 200000, 1000);
    const endedAt = phoneNow();
    check('it ended when five minutes were over', Math.abs((endedAt - startedAt) / 1000 - 300) <= 3, `${((endedAt - startedAt) / 1000).toFixed(1)}s after the start`);
    check('no notification while the app was in front', notices().length === 0, notices().join(' | '));
    await creditedOnce(p, before);
  },

  async sleep() {
    const { page, before } = await ready();
    const startedAt = await start5(page);
    await sleep(15000);
    // the first session asks for the permission to notify: allow it, as a user would
    if (asking()) await allow();
    check('notifications are allowed', /granted=true/.test(sh(`dumpsys package ${PKG} | grep POST_NOTIFICATIONS`)));
    check('the phone has a lock screen', hasLockScreen());
    await compare(page, 'before locking', startedAt);
    await detach();
    lock();
    await sleep(3000);
    check('the display is locked', locked());
    check('Android holds a plan to ring at the end', alarms() > 0, `${alarms()} alarm(s)`);
    const left = 300000 - (phoneNow() - startedAt);
    log(`locked until after the end, ${Math.round(left / 1000)} seconds to go`);
    let rang = 0;
    await until(() => {
      if (notices().length) rang = phoneNow();
      return rang > 0;
    }, left + 240000, 2000);
    check('the notification came while the display was locked', rang > 0 && locked(), rang ? `${((rang - startedAt) / 1000 - 300).toFixed(1)}s after the end of the session` : 'none within four minutes after the end');
    snap('locked-notice');
    await sleep(Math.max(0, startedAt + 330000 - phoneNow()));
    await unlock();
    if (!inFront()) launch();
    const p = await attach();
    check('back in the app the session is over', await until(async () => !(await save(p)).active, 20000));
    await sleep(1500);
    check('the notification is gone once the app is in front', notices().length === 0);
    await creditedOnce(p, before);
  },

  async home() {
    const { page, before } = await ready();
    const startedAt = await start5(page);
    await sleep(20000);
    await compare(page, 'before leaving', startedAt);
    await detach();
    home();
    await sleep(2000);
    check('the home screen is in front', !inFront());
    snap('home-screen');
    log('on the home screen for 140 seconds');
    await sleep(140000);
    launch();
    check('the app is in front again', await until(() => inFront(), 8000));
    const p = await attach();
    check('the session still runs', await until(() => has(p, '.page.focus')));
    await compare(p, 'right after coming back', startedAt);
    snap('back-in-app');
    await sleep(3000);
    await compare(p, 'three seconds later', startedAt);
    await until(async () => !(await save(p)).active, 200000, 1000);
    const endedAt = phoneNow();
    check('it ended when five minutes were over', Math.abs((endedAt - startedAt) / 1000 - 300) <= 3, `${((endedAt - startedAt) / 1000).toFixed(1)}s after the start`);
    await creditedOnce(p, before);
  },

  async pause() {
    const { page, before } = await ready();
    const startedAt = await start5(page);
    await sleep(60000);
    await compare(page, 'before the pause', startedAt);
    await page.locator('.page.focus .btn').first().click();
    check('it pauses', await until(() => has(page, '.page.focus.is-paused')));
    const pausedAt = (await save(page)).active.pausedAt;
    const shown = await clockSeconds(page);
    snap('paused');
    await detach();
    stop();
    check('the app is closed', sh(`pidof ${PKG} || true`) === '');
    log('closed for 75 seconds');
    await sleep(75000);
    launch();
    const p = await attach();
    check('opened again: the session is there, still paused', await until(() => has(p, '.page.focus.is-paused'), 20000));
    check('and the clock stands where it stood', (await clockSeconds(p)) === shown, `${shown}s`);
    await sleep(4000);
    check('it does not run while paused', (await clockSeconds(p)) === shown);
    await p.locator('.page.focus .btn').first().click();
    check('it goes on', await until(async () => !(await has(p, '.page.focus.is-paused'))));
    const s = await save(p);
    const pausedMs = s.active.pausedMs;
    check('the pause is not counted', Math.abs(pausedMs - (phoneNow() - pausedAt)) < 3000, `${(pausedMs / 1000).toFixed(1)}s paused`);
    await sleep(3000);
    await compare(p, 'after resuming', startedAt, pausedMs);
    await until(async () => !(await save(p)).active, 300000, 1000);
    const endedAt = phoneNow();
    check('it ended after five minutes of focus, pause not counted', Math.abs((endedAt - startedAt - pausedMs) / 1000 - 300) <= 3, `${((endedAt - startedAt - pausedMs) / 1000).toFixed(1)}s of focus`);
    await creditedOnce(p, before);
  },

  async back() {
    const { page } = await ready();
    // a sheet on the clearing
    await page.locator('.hero-dress').click();
    check('a sheet opens', await until(() => has(page, '.sheet-root')));
    back();
    check('back closes the sheet', await until(async () => !(await has(page, '.sheet-root')), 5000));
    check('and the app stays in front', inFront());
    // the collection
    await page.locator('.tab').nth(1).click();
    await until(() => has(page, '.segment'));
    await page.locator('.segment').first().click(); // the ghosts; a new style opens the collection on the styles
    await until(() => has(page, '.ghost-tile'));
    await page.locator('.ghost-tile').first().click();
    check('a ghost sheet opens in the collection', await until(() => has(page, '.sheet-root')));
    snap('collection-sheet');
    back();
    check('back closes it', await until(async () => !(await has(page, '.sheet-root')), 5000));
    check('the collection is still there', (await has(page, '.ghost-tile')) && inFront());
    back();
    check('back in the collection leads to the first tab', await until(() => has(page, '.page.home'), 5000));
    // settings: a sheet in a sheet-less tab
    await page.locator('.tab').nth(3).click();
    await until(() => has(page, '.page.settings'));
    check('no developer menu in the settings', (await page.locator('.group.dev').count()) === 0);
    check('nothing offers Plus', (await page.locator('.plus-pill, .plus-teaser').count()) === 0 && !(await page.locator('.page.settings').innerText()).includes('Plus'));
    snap('settings');
    back();
    await until(() => has(page, '.page.home'), 5000);
    back();
    check('back on the first tab leaves to the home screen', await until(() => !inFront(), 5000));
    launch();
    const p = await attach();
    check('the app comes back where it was', await until(() => has(p, '.page.home'), 15000));
  },
};

if (!TESTS[what]) {
  console.error(`unknown test: ${what}`);
  process.exit(2);
}
log(`--- ${what} ---`);
try {
  await TESTS[what]();
} catch (e) {
  check(`the test ran to its end`, false, String(e?.message ?? e).split('\n')[0]);
} finally {
  await detach();
}
log(failures() ? `${failures()} check(s) failed` : 'all checks passed');
process.exit(failures() ? 1 : 0);
