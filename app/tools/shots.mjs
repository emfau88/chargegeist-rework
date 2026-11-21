// Screenshots of every screen at phone size, driven through the real UI.
// Usage: node tools/shots.mjs <outDir> [en|de] [scale] [only,names]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [, , out = 'shots', lang = 'en', scale = '1', only = ''] = process.argv;
const URL = process.env.CG_URL ?? 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
const want = only ? new Set(only.split(',')) : null;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(scale), locale: lang === 'de' ? 'de-DE' : 'en-US' });

const T = (en, de) => (lang === 'de' ? de : en);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fresh() {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    window.__cg.dev.reset();
  });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
  return page;
}

/** A lived-in state: 10 days of focus, some styles, ghosts and sparks, a wish, a pending drop. */
async function seed(page, extra = {}) {
  await page.evaluate((extra) => {
    const day = 86400000;
    const pad = (n) => String(n).padStart(2, '0');
    const key = (ms) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const now = Date.now();
    window.__cg.mutate((x) => {
      x.onboarded = true;
      x.plusOfferSeen = true;
      x.companion = 'aviator';
      x.firstCompanion = 'aviator';
      x.names = {};
      x.goal = 30;
      x.tags = ['study', 'work'];
      x.lastTag = 'study';
      x.lastDuration = 25;
      const mins = [25, 40, 0, 15, 50, 30, 0, 25, 35, 12];
      const tags = ['study', 'work', 'study', 'read', 'work', 'study', 'create', 'study', 'work', 'study'];
      x.sessions = [];
      mins.forEach((m, i) => {
        if (!m) return;
        const at = now - (mins.length - 1 - i) * day - (i % 3) * 3600000;
        x.sessions.push({ id: 's' + i, at, day: key(at), min: m, planned: m, tag: tags[i], done: true });
      });
      x.goalDays = [key(now - 5 * day), key(now - 4 * day), key(now - day)];
      x.ghosts = {
        aviator: { at: now - 10 * day, via: 'start', seen: true },
        pumpkin: { at: now - 4 * day, via: 'hours', seen: true },
        owl: { at: now - 2 * day, via: 'spark', seen: false },
        dragon: { at: now - 1 * day, via: 'spark', seen: true },
      };
      const styles = ['aura_fireflies', 'shimmer_moon', 'aura_bubbles', 'shimmer_mint', 'aura_snow', 'shimmer_rose', 'aura_stardust', 'aura_blossoms', 'shimmer_rainbow', 'charm_teacup', 'charm_compass'];
      x.styles = {};
      styles.forEach((id, i) => (x.styles[id] = { at: now - (styles.length - i) * day * 0.9, via: 'drop', seen: i < styles.length - 2 }));
      x.looks = { aviator: { aura: 'aura_fireflies', shimmer: 'shimmer_mint', charm: 'charm_teacup' }, pumpkin: { aura: 'aura_snow' } };
      x.sparks = { target: null, have: { kitsune: 3, witch: 1, phoenix: 2 } };
      x.achievements = { first: now - 9 * day, days3: now - 7 * day, goal1: now - 5 * day, sessions5: now - 4 * day, costume1: now - 2 * day };
      x.wish = { target: 'aura_leaves', energy: 112 };
      x.pending = [{ id: 'd1', kind: 'daily', at: now, cards: null }];
      x.dailyDropDay = key(now);
      x.dropsOpened = 8;
      x.pity = { sinceRare: 1, sinceEpic: 4 };
      Object.assign(x, extra);
    });
  }, extra);
  await sleep(500);
}

async function tap(page, text) {
  await page.getByText(text, { exact: false }).first().click();
}
async function shot(page, name, wait = 900) {
  await sleep(wait);
  if (want && !want.has(name)) return;
  await page.screenshot({ path: `${out}/${lang}-${name}.png` });
  console.log('shot', name);
}

// 1. onboarding
{
  const p = await fresh();
  await shot(p, 'ob1-welcome', 1500);
  await tap(p, T('Let’s begin', 'Los geht’s'));
  await tap(p, T('Work', 'Arbeit'));
  await shot(p, 'ob2-tags');
  await tap(p, T('Continue', 'Weiter'));
  await shot(p, 'ob3-goal');
  await tap(p, T('Continue', 'Weiter'));
  await sleep(500);
  await tap(p, 'Hazel');
  await shot(p, 'ob4-pick', 1400);
  await tap(p, 'Skye');
  await tap(p, T('Continue', 'Weiter'));
  await shot(p, 'ob5-trial', 1200);
  await p.evaluate(() => window.__cg.dev.setSpeed(true));
  await tap(p, T('Start 1-minute', '1 Minute aufladen'));
  await shot(p, 'ob6-trial-running', 400);
  await sleep(1600);
  await shot(p, 'ob7-trial-done', 1800);
  await tap(p, T('Open your first drop', 'Ersten Drop öffnen'));
  await shot(p, 'ob8-drop', 1000);
  await tap(p, T('Reveal all', 'Alle aufdecken'));
  await shot(p, 'ob9-revealed', 2200);
  await p.locator('.bottom-actions .btn-warm').click();
  await shot(p, 'ob10-kept', 1400);
  await p.locator('.bottom-actions .btn-warm').click();
  await shot(p, 'ob10b-worn', 1600);
  await tap(p, T('Continue', 'Weiter'));
  await shot(p, 'ob11-style', 1600);
  await tap(p, T('Continue', 'Weiter'));
  await shot(p, 'ob12-remind');
  await tap(p, T('Not now', 'Jetzt nicht'));
  await shot(p, 'ob13-plus', 1200);
  await tap(p, T('Not now', 'Jetzt nicht'));
  await shot(p, 'ob14-home-first', 1200);
  await p.close();
}

// 2. lived-in app
{
  const p = await fresh();
  await seed(p);
  await shot(p, 'home', 1400);
  await p.mouse.wheel(0, 600);
  await shot(p, 'home-scrolled', 600);
  await p.mouse.wheel(0, -1000);
  await sleep(300);
  await p.locator('.spark-card .spark-meter').click();
  await shot(p, 'spark-ghost', 1200);
  await p.keyboard.press('Escape');
  await sleep(500);
  await p.locator('.hero-dress').click();
  await shot(p, 'style', 1400);
  await p.locator('.style-pick').nth(2).click();
  await shot(p, 'style-on', 1400);
  await p.locator('.style-sheet').evaluate((e) => {
    const b = e.querySelector('.sheet-body');
    (b && b.scrollHeight > b.clientHeight ? b : e).scrollBy(0, 600);
  });
  await shot(p, 'style-2', 700);
  await p.keyboard.press('Escape');
  await sleep(500);
  await tap(p, T('Open', 'Öffnen'));
  await shot(p, 'drop', 900);
  await p.locator('.dcard').nth(1).click();
  await shot(p, 'drop-one', 1300);
  await tap(p, T('Reveal all', 'Alle aufdecken'));
  await shot(p, 'drop-all', 2000);
  await p.locator('.bottom-actions .btn-warm').click();
  await shot(p, 'drop-kept', 1500);
  if (await p.locator('.bottom-actions .btn-warm').count()) {
    await p.locator('.bottom-actions .btn-warm').click();
    await shot(p, 'drop-worn', 1600);
  }
  await tap(p, T('Continue', 'Weiter'));
  await sleep(400);
  await p.locator('.tab').nth(1).click();
  await shot(p, 'collection', 1400);
  await p.mouse.wheel(0, 700);
  await shot(p, 'collection-2', 700);
  await p.mouse.wheel(0, -2000);
  await p.locator('.ghost-tile.own').nth(0).click();
  await shot(p, 'ghost-sheet', 1400);
  await p.keyboard.press('Escape');
  await sleep(400);
  await p.locator('.ghost-tile.missing').nth(4).click();
  await shot(p, 'ghost-sheet-missing', 900);
  await p.keyboard.press('Escape');
  await sleep(400);
  await p.locator('.segment').nth(1).click();
  await shot(p, 'collection-style', 1400);
  await p.mouse.wheel(0, 700);
  await shot(p, 'collection-style-2', 700);
  await p.locator('.style-tile.own').nth(1).click();
  await shot(p, 'style-item-sheet', 1000);
  await p.keyboard.press('Escape');
  await sleep(400);
  await p.mouse.wheel(0, -2000);
  await p.locator('.wish-banner').click();
  await shot(p, 'wish-sheet', 900);
  await p.keyboard.press('Escape');
  await sleep(300);
  await p.locator('.tab').nth(2).click();
  await shot(p, 'progress', 1200);
  await p.locator('.ach-card').scrollIntoViewIfNeeded();
  await shot(p, 'progress-achievements', 700);
  await p.mouse.wheel(0, -3000);
  await p.evaluate(() => window.__cg.mutate((x) => (x.plus = true)));
  await shot(p, 'progress-plus', 800);
  await p.mouse.wheel(0, 900);
  await shot(p, 'progress-plus-2', 600);
  await p.mouse.wheel(0, -2000);
  await tap(p, T('Create card', 'Karte erstellen'));
  await shot(p, 'recap', 2500);
  await p.keyboard.press('Escape');
  await sleep(300);
  await p.locator('.tab').nth(3).click();
  await shot(p, 'settings', 1000);
  await tap(p, T('Background', 'Hintergrund'));
  await shot(p, 'themes', 900);
  await p.locator('.theme-card').nth(1).click();
  await p.keyboard.press('Escape');
  await p.locator('.tab').nth(0).click();
  await shot(p, 'home-cozy', 1400);
  await p.evaluate(() => window.__cg.mutate((x) => (x.settings.theme = 'cottonsky')));
  await shot(p, 'home-cotton', 1000);
  await p.evaluate(() => window.__cg.mutate((x) => ((x.settings.theme = 'night'), (x.plus = false))));
  await p.locator('.plus-pill').click();
  await shot(p, 'plus', 1300);
  await tap(p, T('Unlock Plus', 'Plus freischalten'));
  await shot(p, 'plus-sim', 800);
  await p.keyboard.press('Escape');
  await tap(p, T('Not now', 'Jetzt nicht'));
  await sleep(400);
  await p.evaluate(() => window.__cg.dev.setSpeed(true));
  await tap(p, '50');
  await tap(p, T('Start charging', 'Aufladen starten'));
  await shot(p, 'focus', 4500);
  await tap(p, T('End', 'Beenden'));
  await shot(p, 'focus-end', 800);
  await tap(p, T('End and save', 'Beenden und speichern'));
  await shot(p, 'complete', 2600);
  await p.close();
}
await browser.close();
