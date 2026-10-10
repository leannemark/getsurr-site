// How much the browser re-draws while the splash cuts (W1/W9) — Chromium's own trace, counted.
// Moving a finished layer costs nothing; a "paint" is the browser drawing pixels again. The cut should only move layers.
import { chromium } from '@playwright/test';
import { serve } from './serve.mjs';

export async function paints() {
  const { server, base } = await serve();
  const browser = await chromium.launch();
  const out = [];
  for (const [label, viewport] of [['desktop 1440', { width: 1440, height: 900 }], ['phone 390', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const cdp = await page.context().newCDPSession(page);
    const events = [];
    cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
    await page.evaluate(() => (document.querySelector('#splash')?.offsetParent ? document.querySelector('#splash') : document.querySelector('#ssplash')).click());
    await page.waitForTimeout(700); // the blades' turn
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end');
    await done;
    const p = events.filter((e) => e.name === 'Paint' && e.ph === 'X');
    out.push({ size: label, paints: p.length, 'paint ms': +p.reduce((s, e) => s + (e.dur || 0) / 1000, 0).toFixed(1) });
    await page.close();
  }
  await browser.close();
  server.close();
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) console.table(await paints());
