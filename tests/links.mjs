// Every link, picture, font, script and page answers (W10). Walks the site from / like a visitor would, locally,
// then (LIVE=1, or always in `npm test`) checks the real domain: www → bare domain, http → https, both land on the same page.
// Outside links (App Store, Instagram, SoundCloud) are listed, not fetched — their sites refuse robots, and a
// failure there is not ours to fix.
import { serve } from './serve.mjs';

const ATTR = /\s(?:href|src|data-src)="([^"]+)"|\scontent="(https?:\/\/[^"]+|\/[^"]*)"/g;

export async function links({ live = true } = {}) {
  const { server, base } = await serve();
  const seen = new Map(); // path → status
  const from = new Map(); // path → first page that links it
  const outside = new Set();
  const queue = ['/', '/babes/']; // /babes/ is unlinked on purpose (noindex, for the beta testers) — walked from its own address
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    const res = await fetch(base + path, { redirect: 'follow' });
    seen.set(path, res.status);
    const type = res.headers.get('content-type') || '';
    const text = await res.text(); // always read the body, or the connection is never handed back
    if (res.status !== 200 || (!type.includes('html') && !type.includes('css'))) continue; // a 404 page's own links are not followed
    const found = [...text.matchAll(ATTR)].map((m) => m[1] || m[2]);
    if (type.includes('css')) found.push(...[...text.matchAll(/url\(([^)#]+)\)/g)].map((m) => m[1].replace(/['"]/g, '')));
    for (let u of found) {
      u = u.replace(/&amp;/g, '&');
      if (/^(mailto:|tel:|#|data:|javascript:)/.test(u)) continue;
      if (/^https?:\/\//.test(u)) {
        const url = new URL(u);
        if (url.hostname === 'getsurr.com') u = url.pathname; else { if (!/supabase\.co/.test(u)) outside.add(u); continue; }
      }
      if (!u.startsWith('/')) u = new URL(u, base + path).pathname;
      u = u.split('#')[0].split('?')[0];
      if (!u || !/^\/[\w\-./]*$/.test(u)) continue;
      if (u.startsWith('/desk')) continue; // the desk is private and unlinked; never walked
      if (!from.has(u)) from.set(u, path);
      if (!seen.has(u)) queue.push(u);
    }
  }
  server.close();
  const problems = [...seen].filter(([p, s]) => s !== 200).map(([p, s]) => `${p} answered ${s} (linked from ${from.get(p) || 'start'})`);

  const domain = [];
  if (live) {
    for (const start of ['http://getsurr.com/', 'http://www.getsurr.com/', 'https://www.getsurr.com/', 'https://getsurr.com/', 'https://getsurr.com/list/']) {
      try {
        const r = await fetch(start, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
        await r.arrayBuffer();
        const ok = r.status === 200 && r.url.startsWith('https://getsurr.com/');
        domain.push({ start, lands: r.url, status: r.status, ok });
        if (!ok) problems.push(`${start} lands on ${r.url} (${r.status})`);
      } catch (e) { domain.push({ start, lands: String(e.cause?.code || e.message), ok: false }); problems.push(`${start}: ${e.message}`); }
    }
  }
  return { checked: seen.size, outside: [...outside].sort(), domain, problems };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const r = await links({ live: !process.env.OFFLINE });
  console.log(`${r.checked} local addresses checked`);
  if (r.domain.length) console.table(r.domain);
  console.log('outside links (not fetched):\n  ' + r.outside.join('\n  '));
  for (const p of r.problems) console.log('  ✗ ' + p);
  process.exitCode = r.problems.length ? 1 : 0;
}
