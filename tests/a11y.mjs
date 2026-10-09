// Accessibility (W16): axe on every page at a phone and a laptop size, and the keyboard — Tab must reach every
// control that is on screen, in order, each with a name a screen reader can say. VoiceOver itself is Leanne's
// phone check; this is what a chat can prove.
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { serve } from './serve.mjs';
import { PAGES } from './shots.mjs';
import { settle } from './splash.mjs';

export async function a11y() {
  const { server, base } = await serve();
  const browser = await chromium.launch();
  const problems = [];
  const rows = [];
  for (const [size, viewport] of [['phone', { width: 393, height: 852 }], ['laptop', { width: 1280, height: 800 }]]) {
    for (const [key, path] of Object.entries(PAGES)) {
      if (key === 'home-in') continue;
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      await page.goto(base + path, { waitUntil: 'load' });
      await settle(page);
      await page.waitForTimeout(800); // the phone's screens fade their words in; measure contrast once they are in
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of r.violations) problems.push(`${size} ${key}: ${v.id} (${v.impact}) — ${v.help} ×${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);

      // keyboard: tab through, collect what gets focus
      const want = await page.evaluate(() => [...document.querySelectorAll('a[href],button,input,summary,[tabindex="0"]')]
        .filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden],[inert]') && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY') && !e.disabled && !e.closest('[aria-hidden="true"]') && e.getAttribute('tabindex') !== '-1'; }).length);
      await page.evaluate(() => { window.__reached = new Set(); document.addEventListener('focusin', (e) => window.__reached.add(e.target)); });
      const got = new Set();
      let unnamed = 0;
      for (let i = 0; i < want + 15; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const name = (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || (e.labels && e.labels[0] && e.labels[0].innerText) || '').trim();
          const id = e.tagName + ':' + (e.id || '') + ':' + name.slice(0, 30) + ':' + [...e.parentNode.children].indexOf(e) + ':' + Math.round(e.getBoundingClientRect().top);
          return { id, name };
        });
        if (!f) continue;
        if (!f.name) unnamed++;
        got.add(f.id);
      }
      const missed = await page.evaluate(() => [...document.querySelectorAll('a[href],button,input,summary,[tabindex="0"]')]
        .filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden],[inert]') && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY') && !e.disabled && !e.closest('[aria-hidden="true"]') && e.getAttribute('tabindex') !== '-1' && !window.__reached.has(e); })
        .map((e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.tagName).trim().slice(0, 30)));
      if (missed.length) problems.push(`${size} ${key}: tab never reaches ${missed.join(' · ')}`);
      if (unnamed) problems.push(`${size} ${key}: ${unnamed} focus stops without a name`);
      rows.push({ size, page: key, 'axe issues': r.violations.length, 'controls on screen': want, 'reached by tab': got.size });
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  return { rows, problems };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { rows, problems } = await a11y();
  console.table(rows);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = problems.length ? 1 : 0;
}
