// Every ghost with a charm, as the app shows it (Home), plus a few ghosts while focusing (charge ring).
// The charms take turns, so all 10 show up. Usage: node tools/charms_sheet.mjs <outDir> [only,ghostIds]
// CG_FULL=1 shoots the whole screen instead of just the stage.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [, , out = 'charms', only = ''] = process.argv;
const URL = process.env.CG_URL ?? 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
const FULL = !!process.env.CG_FULL;
const snap = (sel, path) => (FULL ? page.screenshot({ path }) : page.locator(sel).screenshot({ path }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));

/** A fresh state: every ghost and every charm owned, `g` is the companion wearing `charm`. */
async function seed(g, charm) {
  await page.goto(URL);
  await page.evaluate(
    async ([g, charm]) => {
      localStorage.clear();
      const cg = window.__cg;
      cg.dev.reset();
      const { GHOSTS, STYLES } = await import('/src/data/catalog.ts');
      cg.mutate((x) => {
        x.onboarded = true;
        x.plusOfferSeen = true;
        x.companion = g;
        x.firstCompanion = 'volti';
        x.ghosts = Object.fromEntries(GHOSTS.map((d) => [d.id, { at: Date.now(), via: 'start', seen: true }]));
        x.styles = Object.fromEntries(STYLES.filter((d) => d.kind === 'charm').map((d) => [d.id, { at: Date.now(), via: 'drop', seen: true }]));
        x.looks = { [g]: { charm } };
      });
    },
    [g, charm],
  );
  await page.evaluate(() => document.fonts.ready);
}

await page.goto(URL);
const { ghosts, charms } = await page.evaluate(async () => {
  const { GHOSTS, STYLES } = await import('/src/data/catalog.ts');
  return { ghosts: GHOSTS.map((g) => g.id), charms: STYLES.filter((x) => x.kind === 'charm').map((x) => x.id) };
});
const want = only ? ghosts.filter((g) => only.split(',').includes(g)) : ghosts;

for (const g of want) {
  const charm = charms[ghosts.indexOf(g) % charms.length];
  await seed(g, charm);
  await sleep(2200);
  await snap('.hero-stage', `${out}/home_${g}_${charm}.png`);
  console.log('home', g, charm);
}

// while focusing the charm moves up and out of the charge ring
for (const g of want.filter((g) => ['volti', 'luna', 'pirate', 'kitsune', 'reaper', 'forest'].includes(g))) {
  const charm = charms[(ghosts.indexOf(g) + 3) % charms.length];
  await seed(g, charm);
  await sleep(800);
  await page.getByText(/Start charging|Aufladen starten/).first().click();
  await sleep(3200);
  await snap('.focus-stage', `${out}/focus_${g}_${charm}.png`);
  console.log('focus', g, charm);
}
await browser.close();
