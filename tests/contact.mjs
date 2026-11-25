// The contact form on /support (brief imprint-personal-number-out in the app repo, break-it rows CF-1, CF-2, CF-3, CF-5,
// CF-7, CF-10, CF-11) — in the browser, with the server function stood in for by a copy of its rules
// (send_contact_note in the app repo's supabase/migrations/20261125163100_contact_form.sql), so nothing is ever sent.
// Every case must end in a visible line, never "Sending…"; on a failure the words stay in the box.
import { chromium, webkit } from '@playwright/test';
import { serve } from './serve.mjs';

// the function's rules, word for word: the trap first (filled → the usual answer, nothing written), then the address,
// the empty message (spaces, tabs and line breaks trimmed), over 4,000 characters refused (never cut), then the cap of
// 5 per connection per 10 minutes (P0001 with no message the page shows); a note waiting with the same words is not
// written twice
const chars = (v) => [...v].length;
function sendContactNote({ p_email, p_message, p_hp }, conn) {
  if (p_hp) return { status: 204, body: null };
  const email = String(p_email || '').trim().toLowerCase(), body = String(p_message || '').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email) || email.length > 254) return { status: 400, body: { code: '22023', message: "that's not an email" } };
  if (!body) return { status: 400, body: { code: '22023', message: 'your message is empty' } };
  if (chars(body) > 4000) return { status: 400, body: { code: '22023', message: "that's too long. 4,000 characters at most." } };
  if (conn.written.some((w) => w.email === email && w.body === body)) return { status: 204, body: null };
  if (conn.hits >= 5) return { status: 400, body: { code: 'P0001', message: 'contact_form: too many' } };
  conn.hits++;
  conn.written.push({ email, body });
  return { status: 204, body: null };
}

const SENT = 'Sent. We answer within one working day.';
const FAIL = "That didn't go through";
const CASES = [
  { name: 'nothing', email: '', message: '', expect: "That's not an email", writes: 0 },
  { name: 'bad address', email: 'not-an-email', message: 'hello', expect: "That's not an email", writes: 0 },
  { name: 'comma in the address', email: 'jo,anne@getsurr.de', message: 'hello', expect: "That's not an email", writes: 0, kept: true },
  { name: 'spaces only', email: 'a@getsurr.de', message: '   \n  ', expect: 'Your message is empty', writes: 0 },
  { name: '4,001 characters', email: 'a@getsurr.de', message: 'x'.repeat(4001), expect: "That's too long. 4,000 characters at most.", writes: 0, kept: true },
  { name: '4,000 characters', email: 'a@getsurr.de', message: 'x'.repeat(4000), expect: SENT, writes: 1 },
  { name: 'html and a link', email: 'a@getsurr.de', message: '<b>hi</b> https://x.test', expect: SENT, writes: 1 },
  { name: 'emoji', email: 'a@getsurr.de', message: 'hi 🌈🏳️‍🌈', expect: SENT, writes: 1 },
  { name: 'double press', email: 'twice@getsurr.de', message: 'once', twice: true, expect: SENT, writes: 1 },
  { name: 'robot fills the trap', email: 'robot@getsurr.de', message: 'buy', trap: 'http://spam.example', expect: SENT, writes: 0 },
  { name: 'sixth in ten minutes', email: 'late@getsurr.de', message: 'hello', hits: 5, expect: FAIL, writes: 0, kept: true },
  { name: 'offline', email: 'down@getsurr.de', message: 'hello', down: true, expect: FAIL, kept: true },
  { name: 'server never answers', email: 'slow@getsurr.de', message: 'hello', slow: true, expect: FAIL, kept: true },
];

export async function contact() {
  const { server, base } = await serve();
  const rows = [], problems = [];
  for (const [ename, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    for (const c of CASES) {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      let calls = 0;
      const conn = { hits: c.hits || 0, written: [] };
      await page.route(/\/rest\/v1\/rpc\/send_contact_note/, async (route) => {
        calls++;
        if (c.down) return route.abort('internetdisconnected');
        if (c.slow) return; // never answered: the page must give up by itself (15 s)
        const r = sendContactNote(JSON.parse(route.request().postData() || '{}'), conn);
        await new Promise((ok) => setTimeout(ok, 300)); // a real round trip, so a second press can land mid-send
        return route.fulfill({ status: r.status, contentType: 'application/json', body: r.body ? JSON.stringify(r.body) : '' });
      });
      await page.goto(base + '/support/', { waitUntil: 'load' });
      await page.fill('#cf-email', c.email);
      await page.fill('#cf-message', c.message);
      if (c.trap) await page.locator('[name=website]').evaluate((el, v) => { el.value = v; }, c.trap);
      const btn = page.locator('#contact button.go');
      if (c.twice) { await btn.click(); await btn.click({ force: true, timeout: 500 }).catch(() => {}); await btn.click({ force: true, timeout: 500 }).catch(() => {}); } else await btn.click();
      const line = page.locator('#contact .err:not([hidden]), p.done').first();
      let said = '';
      try { await line.waitFor({ timeout: c.slow ? 25000 : 8000 }); said = (await line.innerText()).trim(); } catch { said = '(nothing — still waiting)'; }
      const kept = !c.kept || (await page.inputValue('#cf-message')) === c.message;
      const ok = said.startsWith(c.expect) && kept && (!c.twice || calls === 1) && (c.writes === undefined || conn.written.length === c.writes);
      if (!ok) problems.push(`${ename} ${c.name}: said "${said}"${c.twice ? `, sent ${calls}×` : ''}, wrote ${conn.written.length}${kept ? '' : ', words lost'}`);
      rows.push({ engine: ename, case: c.name, sent: calls, says: said.slice(0, 48), ok });
      await page.close();
    }

    // CF-10 / CF-11: from the imprint's link to the form, at the smallest phone; both labels are real labels; the
    // button can be reached with the keyboard open (the page scrolls it into view when the message box has focus)
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto(base + '/imprint/', { waitUntil: 'load' });
    const link = page.locator('a[href="/support/#contact"], a[href="https://getsurr.com/support"]').first();
    if (!(await link.count())) problems.push(`${ename} imprint: no link to the contact form`);
    await page.goto(base + '/support/#contact', { waitUntil: 'load' });
    const top = await page.locator('#contact').evaluate((el) => el.getBoundingClientRect().top);
    if (top < -1 || top > 300) problems.push(`${ename} /support/#contact: the form starts at ${Math.round(top)}px, out of sight`);
    for (const [id, name] of [['cf-email', 'Your email'], ['cf-message', 'Your message']]) {
      const n = await page.getByLabel(name, { exact: true }).getAttribute('id').catch(() => null);
      if (n !== id) problems.push(`${ename}: "${name}" is not the label of #${id}`);
    }
    await page.setViewportSize({ width: 375, height: 667 - 290 }); // the keyboard takes the bottom of the screen
    await page.focus('#cf-message');
    await page.keyboard.press(ename === 'webkit' ? 'Alt+Tab' : 'Tab'); // Safari reaches buttons with option-tab
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent);
    if (focused !== 'Send') problems.push(`${ename}: Tab from the message does not reach Send (reached "${focused}")`);
    await page.close();
    await browser.close();
  }
  server.close();
  return { rows, problems };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { rows, problems } = await contact();
  console.table(rows);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = problems.length ? 1 : 0;
}
