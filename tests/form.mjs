// The list form, abused (W11) — in the browser, with the server function stood in for by a copy of its rules
// (join_waitlist in the app repo's supabase/migrations/20260920180000_invite_only.sql), so nothing is ever written
// anywhere. Every case must end in a visible line, never a spinner. The real function is checked separately,
// on the STAGING server only, by tests/form-staging.sql (see tests/README.md) — never production.
import { chromium, webkit } from '@playwright/test';
import { serve } from './serve.mjs';

// the server function's own rules, word for word
function joinWaitlist({ p_email, p_city }) {
  const email = String(p_email || '').trim().toLowerCase(), city = String(p_city || '').trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) return { status: 400, body: { code: '22023', message: "that's not an email" } };
  if (!city) return { status: 400, body: { code: '22023', message: 'which city?' } };
  return { status: 204, body: null };
}

const CASES = [
  { name: 'empty', email: '', city: '', expect: "That's not an email" },
  { name: 'bad email', email: 'not-an-email', city: 'berlin', expect: "That's not an email" },
  { name: 'no city', email: 'a@b.de', city: '', expect: 'Which city?' },
  { name: '300 characters', email: 'a'.repeat(290) + '@getsurr.de', city: 'b'.repeat(300), link: 'c'.repeat(300), expect: "We'll email you a code" },
  { name: 'emoji', email: 'emoji@getsurr.de', city: 'berlin 🌈🏳️‍🌈', link: '@💋', expect: "We'll email you a code" },
  { name: 'server down', email: 'down@getsurr.de', city: 'berlin', down: true, expect: "That didn't go through" },
  { name: 'server never answers', email: 'slow@getsurr.de', city: 'berlin', slow: true, expect: "That didn't go through" },
  { name: 'double submit', email: 'twice@getsurr.de', city: 'berlin', twice: true, expect: "We'll email you a code" },
];

export async function form() {
  const { server, base } = await serve();
  const rows = [], problems = [];
  for (const [ename, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    for (const c of CASES) {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      let calls = 0;
      await page.route(/\/rest\/v1\/rpc\/join_waitlist/, async (route) => {
        calls++;
        if (c.down) return route.abort('connectionrefused');
        if (c.slow) return; // never answered: the page must give up by itself (15 s)
        const r = joinWaitlist(JSON.parse(route.request().postData() || '{}'));
        await new Promise((ok) => setTimeout(ok, 300)); // a real round trip, so a second click can land mid-send
        return route.fulfill({ status: r.status, contentType: 'application/json', body: r.body ? JSON.stringify(r.body) : '' });
      });
      await page.goto(base + '/list/', { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const f = page.locator('form.list:visible').first();
      await f.locator('[name=email]').fill(c.email);
      await f.locator('[name=city]').fill(c.city);
      if (c.link) await f.locator('[name=link]').fill(c.link);
      const btn = f.locator('button.go');
      if (c.twice) { await btn.click(); await btn.click({ force: true }).catch(() => {}); await btn.click({ force: true }).catch(() => {}); } else await btn.click();
      const line = page.locator('form.list:visible .err:not([hidden]), p.done').first();
      let said = '';
      try { await line.waitFor({ timeout: c.slow ? 20000 : 8000 }); said = (await line.innerText()).trim(); } catch { said = '(nothing — still waiting)'; }
      const ok = said.startsWith(c.expect) && (!c.twice || calls === 1);
      if (!ok) problems.push(`${ename} ${c.name}: said "${said}"${c.twice ? `, sent ${calls}×` : ''}`);
      rows.push({ engine: ename, case: c.name, sent: calls, says: said.slice(0, 48), ok });
      await page.close();
    }
    await browser.close();
  }
  server.close();
  return { rows, problems };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { rows, problems } = await form();
  console.table(rows);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = problems.length ? 1 : 0;
}
