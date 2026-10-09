// A tiny local copy of GitHub Pages for the tests: folders answer with their index.html,
// unknown paths answer 404 with 404.html. No caching, nothing from another host.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = process.env.SITE_ROOT || fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.json': 'application/json', '.ico': 'image/x-icon', '.ics': 'text/calendar',
};
const hidden = /^\/(\.|node_modules|tests|scripts|_legal|package)/;

async function file(path) {
  try {
    const s = await stat(path);
    if (s.isDirectory()) return file(join(path, 'index.html'));
    return { path, body: await readFile(path) };
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
      res.writeHead(404, { 'content-type': types['.html'] });
      return res.end(nf ? nf.body : 'not found');
    }
    res.writeHead(200, { 'content-type': types[extname(hit.path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(hit.body);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { base } = await serve(Number(process.argv[2]) || 8000);
  console.log(`serving the site at ${base}`);
}
