// Every aura and shimmer on a live ghost, one picture each (for a contact sheet).
// Usage: node tools/styles_sheet.mjs <outDir> [ghostId] [only,ids] [frames]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [, , out = 'styles', ghostId = 'volti', only = '', frames = '1'] = process.argv;
const URL = process.env.CG_URL ?? 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(URL);
const ids = await page.evaluate((g) => {
  localStorage.clear();
  const cg = window.__cg;
  cg.dev.reset();
  cg.mutate((x) => {
    x.onboarded = true;
    x.plusOfferSeen = true;
    x.plus = true;
    x.companion = g;
    x.firstCompanion = g;
    x.ghosts = { [g]: { at: Date.now(), via: 'start', seen: true } };
  });
  return Object.keys(cg.getState().styles).length ? [] : null;
}, ghostId);
void ids;
await page.evaluate(() => document.fonts.ready);
await sleep(800);
// all styles, Plus ones included
const all = await page.evaluate(async () => {
  const mod = await import('/src/data/catalog.ts');
  return mod.STYLES.filter((x) => x.kind !== 'charm').map((x) => x.id);
});
const want = only ? all.filter((id) => only.split(',').includes(id)) : all;
await page.evaluate((list) => window.__cg.dev.unlockAll(list, []), all);
await page.locator('.hero-dress').click();
await sleep(1200);
const stage = page.locator('.style-stage');
for (const id of want) {
  await page.evaluate(
    ([g, id]) =>
      window.__cg.mutate((x) => {
        x.looks[g] = { [id.startsWith('aura_') ? 'aura' : 'shimmer']: id };
      }),
    [ghostId, id],
  );
  await sleep(id.startsWith('aura_') ? 3200 : 900);
  for (let f = 0; f < Number(frames); f++) {
    if (f) await sleep(350);
    await stage.screenshot({ path: `${out}/${id}${Number(frames) > 1 ? `_${f}` : ''}.png` });
  }
  console.log('shot', id);
}
await browser.close();
