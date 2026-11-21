// A still portrait of a ghost as a PNG on a clear background, drawn by the app's own renderPortrait.
// Needs the dev server (npm run dev). Usage: node tools/portrait.mjs <ghost id> <out.png> [size]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [, , id, out, size = '1024'] = process.argv;
if (!id || !out) {
  console.error('usage: node tools/portrait.mjs <ghost id> <out.png> [size]');
  process.exit(1);
}
const URL = process.env.CG_URL ?? 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(URL);
const data = await page.evaluate(
  async ([ghost, px]) => {
    const rig = await import('/src/rig/rig.ts');
    const cv = await rig.renderPortrait({ ghost }, px);
    return cv.toDataURL('image/png');
  },
  [id, Number(size)],
);
await browser.close();
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`portrait of ${id} written: ${out} (${size} px)`);
