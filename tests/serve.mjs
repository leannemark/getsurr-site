// A tiny local copy of GitHub Pages for the tests: folders answer with their index.html,
// unknown paths answer 404 with 404.html, audio answers Range requests. No caching, nothing from another host.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const root = process.env.SITE_ROOT || fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.json': 'application/json', '.ico': 'image/x-icon', '.ics': 'text/calendar',
  '.m4a': 'audio/mp4',
};
const hidden = /^\/(\.|node_modules|tests|scripts|_legal|package|security-headers)/;
// every answer carries the headers Cloudflare adds live (security-headers.json), so the tests see what visitors get.
// upgrade-insecure-requests is dropped locally: it would send the plain-http test server's own requests to https.
const security = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL('../security-headers.json', import.meta.url), 'utf8')))
  .filter(([k]) => k !== '_').map(([k, v]) => [k, v.replace(/;\s*upgrade-insecure-requests/, '')]));

async function file(path) {
  try {
    const s = await stat(path);
    if (s.isDirectory()) return file(join(path, 'index.html'));
    // the radio's audio is streamed, never read whole (65 MB)
    return { path, size: s.size, body: extname(path) === '.m4a' ? null : await readFile(path) };
  } catch { return null; }
}

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url.endsWith('/') === false && !extname(url)) {
      const dir = await file(join(root, url, 'index.html'));
      if (dir) { res.writeHead(301, { location: url + '/' }); return res.end(); }
    }
    const safe = normalize(url).replace(/^(\.\.[/\\])+/, '');
    const hit = hidden.test(safe) ? null : await file(join(root, safe));
    if (!hit) {
      const nf = await file(join(root, '404.html'));
      res.writeHead(404, { ...security, 'content-type': types['.html'] });
      return res.end(nf ? nf.body : 'not found');
    }
    const head = { ...security, 'content-type': types[extname(hit.path)] || 'application/octet-stream', 'cache-control': 'no-store' };
    // audio answers Range requests like GitHub Pages does (Safari asks for bytes 0-1 first, then the parts it plays)
    if (!hit.body) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      let start = 0, end = hit.size - 1;
      if (m) {
        start = m[1] ? Number(m[1]) : Math.max(0, hit.size - Number(m[2]));
        end = m[1] && m[2] ? Math.min(Number(m[2]), hit.size - 1) : hit.size - 1;
        if (start > end || start >= hit.size) { res.writeHead(416, { ...head, 'content-range': `bytes */${hit.size}` }); return res.end(); }
      }
      res.writeHead(m ? 206 : 200, { ...head, 'accept-ranges': 'bytes', 'content-length': end - start + 1, ...(m ? { 'content-range': `bytes ${start}-${end}/${hit.size}` } : {}) });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(hit.path, { start, end });
      res.on('close', () => stream.destroy());
      return stream.pipe(res);
    }
    res.writeHead(200, head);
    res.end(hit.body);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { base } = await serve(Number(process.argv[2]) || 8000);
  console.log(`serving the site at ${base}`);
}
