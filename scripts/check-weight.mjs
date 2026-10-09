// Weight check for the one page (index.html) and the drive (drive/index.html). Run: node scripts/check-weight.mjs
// Fails (exit 1) when: either page's first load is over 250 KB, a picture a page shows is over 110 KB,
// site.css names a font that is not .woff2, or a src= points at a .png/.jpg/.jpeg other than the two icons.
// Text files (html, css, js, svg) are counted gzipped (GitHub Pages gzips them); pictures and fonts as they are.
// Font subsets (fonts/*.woff2) are Latin-1 plus the characters the site uses. To rebuild one after adding a character:
// (the full .ttf files are in git history: git show b44fefd^:fonts/<Name>.ttf > <Name>.ttf)
//   python3 -m fontTools.subset <Full>.ttf --unicodes="U+0020-00FF,U+00B7,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+20AC,U+2190,U+2191,U+2192,U+2193" --layout-features='kern,liga' --flavor=woff2 --output-file=fonts/<Name>.woff2
// To list the non-ASCII characters the pages use:
//   cat index.html drive/index.html drive/drive.js deal/index.html press/index.html support/index.html privacy/index.html imprint/index.html terms/index.html 404.html | python3 -c "import sys;print(''.join(sorted(set(c for c in sys.stdin.read() if ord(c)>126))))"
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = 250 * 1024;
const PICTURE_MAX = 110 * 1024;
const problems = [];
const gz = (rel) => gzipSync(readFileSync(join(root, rel))).length;
const raw = (rel) => (existsSync(join(root, rel)) ? statSync(join(root, rel)).size : (problems.push(`missing file: ${rel}`), 0));

// one page's first load: its html, the stylesheets and scripts it names, the preloaded fonts, every picture with a src=
function check(page) {
  const html = readFileSync(join(root, page), 'utf8');
  const rows = [];
  const add = (name, bytes) => rows.push([name, bytes]);
  add(`${page} (gzip)`, gzipSync(Buffer.from(html)).length);
  for (const m of html.matchAll(/<link rel="stylesheet" href="\/([^"]+\.css)"/g)) {
    add(`${m[1]} (gzip)`, gz(m[1]));
    const css = readFileSync(join(root, m[1]), 'utf8');
    for (const f of css.matchAll(/url\(([^)]+\.(?:ttf|otf|woff|eot))\)/g)) problems.push(`${m[1]} names a font that is not woff2: ${f[1]}`);
  }
  for (const m of html.matchAll(/<script src="\/([^"]+\.js)"/g)) add(`${m[1]} (gzip)`, gz(m[1]));

  for (const m of html.matchAll(/<link rel="preload"[^>]*href="\/([^"]+\.woff2)"/g)) add(m[1], raw(m[1]));

  const pictures = new Set([...html.matchAll(/\ssrc="\/(img\/[^"]+)"/g)].map((m) => m[1]));
  for (const p of pictures) {
    const size = p.endsWith('.svg') ? gz(p) : raw(p);
    add(p.endsWith('.svg') ? `${p} (gzip)` : p, size);
    if (size > PICTURE_MAX) problems.push(`${p} is ${(size / 1024).toFixed(0)} KB, over the ${PICTURE_MAX / 1024} KB picture limit`);
    if (/\.(png|jpe?g)$/i.test(p) && !/icon-(32|180)\.png$/.test(p)) problems.push(`${p}: pictures on the page must be WebP (or svg)`);
  }

  const total = rows.reduce((n, [, b]) => n + b, 0);
  const pad = Math.max(...rows.map(([n]) => n.length), 34);
  for (const [n, b] of rows) console.log(`${n.padEnd(pad)}  ${(b / 1024).toFixed(1).padStart(7)} KB`);
  console.log(`${'total'.padEnd(pad)}  ${(total / 1024).toFixed(1).padStart(7)} KB  (budget ${BUDGET / 1024} KB)\n`);
  if (total > BUDGET) problems.push(`${page}: first load is ${(total / 1024).toFixed(0)} KB, over the ${BUDGET / 1024} KB budget`);
}

check('index.html');
// the drive's band pictures sit behind the veil and load after the page (data-src), so they are not part of its first load
check('drive/index.html');

if (problems.length) {
  console.error(problems.map((p) => 'FAIL: ' + p).join('\n'));
  process.exit(1);
}
console.log('ok');
