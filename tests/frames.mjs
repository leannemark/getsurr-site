// Frame times while the splash cuts (the Safari-lag check, W1/W9).
// Clicks the splash and records every animation frame for 1.9 s; prints the worst and the 95th-percentile frame.
// CPU=6 slows Chromium's processor six times (a cheap laptop), as the site README's slow look does.
// A frame over 16.7 ms is a dropped frame at 60 a second. Headed runs (HEADED=1) use the real graphics card.
import { chromium, webkit, firefox } from '@playwright/test';
import { serve } from './serve.mjs';

export async function frames({ engines = ['webkit', 'chromium', 'firefox'], runs = 3, headed = !!process.env.HEADED, cpu = Number(process.env.CPU) || 1 } = {}) {
  const { server, base } = await serve();
  const out = [];
  for (const name of engines) {
    const browser = await { chromium, webkit, firefox }[name].launch({ headless: !headed });
    for (const [label, vp] of [['desktop 1440', { width: 1440, height: 900 }], ['phone 390', { width: 390, height: 844 }]]) {
      const all = [];
      for (let i = 0; i < runs; i++) {
        const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 });
        if (cpu > 1 && name === 'chromium') { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
        await page.goto(base + '/', { waitUntil: 'load' });
        await page.waitForTimeout(600);
        const t = await page.evaluate(() => new Promise((done) => {
          const el = document.querySelector(innerWidth > 720 ? '#splash' : '#ssplash');
          const ts = [];
          const tick = (now) => { ts.push(now); if (now - ts[0] < 1900) requestAnimationFrame(tick); else done(ts.slice(1).map((v, k) => v - ts[k])); };
          requestAnimationFrame((now) => { ts.push(now); el.click(); requestAnimationFrame(tick); });
        }));
        all.push(...t);
        await page.close();
      }
      all.sort((a, b) => a - b);
      const sorted = [...all]; const worst3 = sorted.slice(-3).map((v) => Math.round(v));
      out.push({ engine: name, size: label, frames: all.length, 'worst 3': worst3.join(' '), p95: +all[Math.floor(all.length * 0.95)].toFixed(1), worst: +all[all.length - 1].toFixed(1), over: all.filter((v) => v > 17.5).length });
    }
    await browser.close();
  }
  server.close();
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  console.table(await frames({ engines: process.argv.slice(2).length ? process.argv.slice(2) : undefined }));
}
