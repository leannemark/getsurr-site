// The splash, frozen at rest and at moments through the cut, in WebKit and Chromium — the "the scissors look
// the same" proof for any change to the splash. `node tests/splash.mjs save <dir>` writes the pictures;
// `node tests/splash.mjs compare <dirA> <dirB>` prints how many pixels differ between two runs.
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { serve } from './serve.mjs';

// two poses: the scissors at rest (blades open) and in their cut pose (blades shut), each held still over the
// splash's own background — everything in between is the same turn, so two equal ends mean an equal cut.
const POSES = ['open', 'shut'];
const SHUT = `*{transition:none!important;animation:none!important}
  .splash.cut .layer.a,.splash.cut .layer.b{transform:none!important;opacity:1!important}
  .ssplash.cut svg.one,.ssplash.cut .one{opacity:1!important}`;
const SIZES = { 'desktop-1440': { width: 1440, height: 900 }, 'laptop-1280': { width: 1280, height: 800 }, 'phone-390': { width: 390, height: 844 } };

// fonts in, every picture loaded and faded in, the map's slow drift held still
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))));
  await page.waitForTimeout(500);
  await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect && a.effect.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } });
}

export async function save(dir) {
  const { server, base } = await serve();
  for (const [name, engine] of Object.entries({ webkit, chromium })) {
    const browser = await engine.launch();
    for (const [size, viewport] of Object.entries(SIZES)) {
      for (const pose of POSES) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
        await page.goto(base + '/', { waitUntil: 'load' });
        await settle(page);
        if (pose === 'shut') {
          await page.addStyleTag({ content: SHUT });
          await page.evaluate(() => { document.querySelector('#splash').classList.add('cut'); document.querySelector('#ssplash').classList.add('cut'); });
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        }
        mkdirSync(join(dir, name, size), { recursive: true });
        await page.screenshot({ path: join(dir, name, size, `${pose}.png`) });
        await page.close();
      }
    }
    await browser.close();
  }
  server.close();
}

export function compare(a, b) {
  const rows = [];
  for (const engine of readdirSync(a)) for (const size of readdirSync(join(a, engine))) for (const f of readdirSync(join(a, engine, size))) {
    const A = PNG.sync.read(readFileSync(join(a, engine, size, f))), B = PNG.sync.read(readFileSync(join(b, engine, size, f)));
    const diff = new PNG({ width: A.width, height: A.height });
    const loose = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0.1 }); // a difference an eye could see
    const any = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0 });
    mkdirSync(join(b, '_diff', engine, size), { recursive: true });
    writeFileSync(join(b, '_diff', engine, size, f), PNG.sync.write(diff));
    rows.push({ engine, size, moment: f.replace('.png', ''), 'visible diff px': loose, 'any diff px': any });
  }
  return rows;
}

const [cmd, x, y] = process.argv.slice(2);
if (cmd === 'save') await save(x);
if (cmd === 'compare') console.table(compare(x, y));
