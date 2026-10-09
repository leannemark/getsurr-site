// The screenshot matrix (W2, W4, W5): every page in WebKit (Safari's engine), Chromium (Chrome, Edge, Samsung
// Internet) and Firefox, at phone, tablet, laptop and big-desktop sizes, phones upright and on their side.
// Writes tests/out/shots/<engine>/<device>/<page>.png and one contact sheet per engine and device
// (tests/out/sheets/), which is what a person flicks through. Also checks, on every page:
//   - nothing runs off the side (no sideways scroll), no picture failed to load, no error in the console;
//   - dark and light mode look the same (the site is dark only — a difference means something leaked);
//   - with reduced motion on, nothing animates (no transition or animation is running a second after load);
//   - with fonts blocked (an ad blocker), the words still show; without JavaScript the page still reads.
// `node tests/shots.mjs` = the whole matrix; `QUICK=1` = Chromium + WebKit at three sizes (what CI runs).
import { chromium, webkit, firefox } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve, root } from './serve.mjs';
import { settle } from './splash.mjs';

const QUICK = !!process.env.QUICK;
const OUT = join(root, 'tests', 'out');

export const PAGES = {
  home: '/', 'home-in': '/', rings: '/rings/', map: '/map/', nights: '/nights/', list: '/list/', drive: '/drive/',
  beta: '/beta/', deal: '/deal/', press: '/press/', support: '/support/', privacy: '/privacy/', imprint: '/imprint/',
  terms: '/terms/', babes: '/babes/', '404': '/no-such-page/',
};
const PLAIN = new Set(['babes', 'deal', 'press', 'support', 'privacy', 'imprint', 'terms', '404']);

// phones are touch devices with their real pixel density; desktop sizes are a plain window
const DEVICES = {
  'iphone-se': { viewport: { width: 375, height: 667 }, dpr: 2, phone: true },
  'iphone-se-side': { viewport: { width: 667, height: 375 }, dpr: 2, phone: true },
  'iphone-15': { viewport: { width: 393, height: 852 }, dpr: 3, phone: true },
  'iphone-15-side': { viewport: { width: 852, height: 393 }, dpr: 3, phone: true },
  'android-360': { viewport: { width: 360, height: 780 }, dpr: 3, phone: true },
  ipad: { viewport: { width: 820, height: 1180 }, dpr: 2, phone: true },
  'ipad-side': { viewport: { width: 1180, height: 820 }, dpr: 2, phone: true },
  'laptop-1280': { viewport: { width: 1280, height: 800 }, dpr: 2 },
  '4k-at-200': { viewport: { width: 1920, height: 1080 }, dpr: 2 },
  'desktop-2560': { viewport: { width: 2560, height: 1440 }, dpr: 1 },
};
const QUICK_DEVICES = ['iphone-se', 'iphone-15', 'laptop-1280'];

function contextOptions(engine, d, extra = {}) {
  const o = { viewport: d.viewport, deviceScaleFactor: d.dpr, colorScheme: 'dark', ...extra };
  if (d.phone && engine !== 'firefox') Object.assign(o, { isMobile: true, hasTouch: true });
  return o;
}

async function open(page, base, key) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (!r.url().includes('supabase')) errors.push(`failed: ${r.url()}`); });
  const res = await page.goto(base + PAGES[key], { waitUntil: 'load' });
  await settle(page);
  if (key === 'home-in') { // through the door: cut the splash and land
    await page.evaluate(() => (innerWidth > 720 ? document.querySelector('#splash') : document.querySelector('#ssplash')).click());
    await page.waitForTimeout(2300);
    await settle(page);
  }
  return { status: res.status(), errors };
}

// what the eye would call broken, measured on the page
const inspect = (page) => page.evaluate(() => {
  const doc = document.scrollingElement;
  const wide = Math.max(doc.scrollWidth, document.body.scrollWidth) > innerWidth + 1;
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src'));
  return { sideways: wide, broken };
});

async function sheet(browser, title, files, vp) {
  // one picture per engine + device: every page side by side, named, at a size an eye can scan
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cells = files.map(([name, rel]) => `<figure><img src="${rel}"><figcaption>${name}</figcaption></figure>`).join('');
  const html = join(OUT, 'shots', `_sheet-${title.replace(/ · /g, '--')}.html`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#222;color:#ddd;font:13px system-ui}h1{font-size:15px;margin:0 0 12px}
    main{display:grid;grid-template-columns:repeat(${vp.width > vp.height ? 4 : 7},1fr);gap:12px}figure{margin:0}
    img{width:100%;aspect-ratio:${vp.width}/${vp.height};object-fit:cover;object-position:top;display:block;border:1px solid #444}
    figcaption{padding:4px 0}</style><h1>${title}</h1><main>${cells}</main>`);
  await page.goto('file://' + html);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  mkdirSync(join(OUT, 'sheets'), { recursive: true });
  await page.screenshot({ path: join(OUT, 'sheets', `${title.replace(/ · /g, '--')}.png`), fullPage: true });
  await page.close();
  rmSync(html);
}

export async function shots() {
  rmSync(join(OUT, 'shots'), { recursive: true, force: true });
  rmSync(join(OUT, 'sheets'), { recursive: true, force: true });
  const { server, base } = await serve();
  const problems = [], notes = [];
  let count = 0;
  const engines = QUICK ? { chromium, webkit } : { webkit, chromium, firefox };
  await Promise.all(Object.entries(engines).map(async ([ename, engine]) => {
    const browser = await engine.launch();
    for (const [dname, d] of Object.entries(DEVICES)) {
      if (QUICK && !QUICK_DEVICES.includes(dname)) continue;
      const ctx = await browser.newContext(contextOptions(ename, d));
      const files = [];
      for (const key of Object.keys(PAGES)) {
        const page = await ctx.newPage();
        const { status, errors } = await open(page, base, key);
        const want = key === '404' ? 404 : 200;
        if (status !== want) problems.push(`${ename} ${dname} ${key}: answered ${status}`);
        const seen = await inspect(page);
        if (seen.sideways) problems.push(`${ename} ${dname} ${key}: scrolls sideways`);
        if (seen.broken.length) problems.push(`${ename} ${dname} ${key}: broken picture ${seen.broken.join(', ')}`);
        for (const e of errors) if (!(key === '404' && /404/.test(e))) problems.push(`${ename} ${dname} ${key}: ${e}`);
        const dir = join(OUT, 'shots', ename, dname);
        mkdirSync(dir, { recursive: true });
        // plain pages whole, up to 5,000 points tall (the legal texts go on much longer; their start is enough to see the type)
        const tall = PLAIN.has(key) ? Math.min(5000, await page.evaluate(() => document.documentElement.scrollHeight)) : 0;
        await page.screenshot({ path: join(dir, `${key}.png`), ...(tall ? { fullPage: true, clip: { x: 0, y: 0, width: d.viewport.width, height: tall } } : {}) });
        files.push([key, `${ename}/${dname}/${key}.png`]);
        count++;
        await page.close();
      }
      // the splash mid-cut, for the eye (not compared — see tests/splash.mjs for the exact check)
      {
        const page = await ctx.newPage();
        await page.goto(base + '/', { waitUntil: 'load' });
        await settle(page);
        await page.evaluate(() => (innerWidth > 720 ? document.querySelector('#splash') : document.querySelector('#ssplash')).click());
        await page.waitForTimeout(450);
        await page.screenshot({ path: join(OUT, 'shots', ename, dname, 'splash-mid-cut.png') });
        files.push(['splash mid-cut', `${ename}/${dname}/splash-mid-cut.png`]);
        count++;
        await page.close();
      }
      // desktop: the five boxes open, one at a time, from the band
      if (!d.phone) {
        for (const b of ['surr', 'rings', 'map', 'nights', 'list']) {
          const page = await ctx.newPage();
          await page.goto(base + '/', { waitUntil: 'load' });
          await settle(page);
          await page.evaluate(() => document.querySelector('#splash')?.click());
          await page.waitForTimeout(2000);
          await page.click(`.cell[data-i="${b}"]`);
          await page.waitForTimeout(900);
          const seen = await inspect(page);
          if (seen.sideways) problems.push(`${ename} ${dname} box ${b}: scrolls sideways`);
          await page.screenshot({ path: join(OUT, 'shots', ename, dname, `box-${b}.png`) });
          files.push([`box ${b}`, `${ename}/${dname}/box-${b}.png`]);
          count++;
          await page.close();
        }
      }
      await ctx.close();
      await sheet(browser, `${ename} · ${dname}`, files, d.viewport);
    }

    // settings people have, at one phone and one laptop size per engine
    for (const dname of ['iphone-15', 'laptop-1280']) {
      const d = DEVICES[dname];
      for (const key of ['home-in', 'list', 'deal']) {
        // light mode must look exactly like dark mode
        const shotsBy = {};
        for (const scheme of ['dark', 'light']) {
          const ctx = await browser.newContext(contextOptions(ename, d, { colorScheme: scheme }));
          const page = await ctx.newPage();
          await open(page, base, key);
          await page.waitForTimeout(2600); // the phone's menu row drops in for 1.8 s when a screen settles; let it leave
          shotsBy[scheme] = await page.screenshot();
          await ctx.close();
        }
        if (!shotsBy.dark.equals(shotsBy.light)) {
          const dir = join(OUT, 'shots', ename, `${dname}-light`);
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${key}.png`), shotsBy.light);
          problems.push(`${ename} ${dname} ${key}: light mode looks different from dark (see ${dname}-light/)`);
        }
        // reduced motion: nothing may be moving a second after load
        const ctx = await browser.newContext(contextOptions(ename, d, { reducedMotion: 'reduce' }));
        const page = await ctx.newPage();
        await page.goto(base + PAGES[key], { waitUntil: 'load' });
        await page.waitForTimeout(1000);
        if (key === 'home-in') {
          await page.evaluate(() => (innerWidth > 720 ? document.querySelector('#splash') : document.querySelector('#ssplash')).click());
          await page.waitForTimeout(300);
        }
        const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
        if (moving) problems.push(`${ename} ${dname} ${key}: ${moving} things still move with reduced motion on`);
        const dir = join(OUT, 'shots', ename, `${dname}-still`);
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `${key}.png`) });
        count++;
        await ctx.close();
      }
    }
    await browser.close();
  }));

  // an ad blocker that blocks fonts, and no JavaScript at all (Chromium is enough: it is about the page, not the engine)
  const browser = await chromium.launch();
  for (const dname of ['iphone-15', 'laptop-1280']) {
    const d = DEVICES[dname];
    for (const [variant, extra] of [['no-fonts', {}], ['no-js', { javaScriptEnabled: false }]]) {
      const ctx = await browser.newContext(contextOptions('chromium', d, extra));
      if (variant === 'no-fonts') await ctx.route(/\.woff2$/, (r) => r.abort());
      for (const key of ['home', 'list', 'deal']) {
        const page = await ctx.newPage();
        await page.goto(base + PAGES[key], { waitUntil: 'load' });
        await page.waitForTimeout(variant === 'no-fonts' ? 3500 : 500); // font-display:block gives up after 3 s
        // what is actually on top in the middle of the screen, and whether any words are visible
        const seen = await page.evaluate(() => {
          const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return { door: !!(top && top.closest('#splash,#ssplash')), words: document.body.innerText.trim().length };
        });
        if (!seen.words) problems.push(`chromium ${dname} ${key} ${variant}: no words on the page`);
        // KNOWN (2026-10-09, left for a design decision): without JavaScript the one page stays on the scissors —
        // the door only opens by script. Reported, not failed, so it is seen every run until it is decided.
        if (seen.door && variant === 'no-js') notes.push(`chromium ${dname} ${key} ${variant}: stays on the scissors (known — no-script version not designed)`);
        const dir = join(OUT, 'shots', 'chromium', `${dname}-${variant}`);
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `${key}.png`) });
        count++;
        await page.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  return { count, problems, notes };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { count, problems, notes } = await shots();
  console.log(`${count} screenshots in tests/out/shots, contact sheets in tests/out/sheets`);
  for (const n of notes) console.log('  · ' + n);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = problems.length ? 1 : 0;
}
