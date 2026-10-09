// `npm test` — every launch test a machine can run, in order, ending in one table (docs/LAUNCH_TESTS.md part 1
// in the app repo). Run it before any announcement and before every pull request that changes how the site looks.
// OFFLINE=1 skips the checks against the live domain; QUICK=1 shoots two engines at three sizes instead of all.
import { execFileSync } from 'node:child_process';
import { links } from './links.mjs';
import { shots } from './shots.mjs';
import { form } from './form.mjs';
import { a11y } from './a11y.mjs';
import { paints } from './paints.mjs';
import { frames } from './frames.mjs';
import { root } from './serve.mjs';

const table = [];
const all = [], notes = [];
async function step(name, fn, summary) {
  const t = Date.now();
  process.stdout.write(`… ${name}\n`);
  try {
    const r = await fn();
    const problems = r.problems || [];
    all.push(...problems.map((p) => `${name}: ${p}`));
    notes.push(...(r.notes || []).map((n) => `${name}: ${n}`));
    table.push({ test: name, result: problems.length ? `✗ ${problems.length} problem(s)` : '✓', detail: summary(r), seconds: Math.round((Date.now() - t) / 1000) });
  } catch (e) {
    all.push(`${name}: crashed — ${e.message.split('\n')[0]}`);
    table.push({ test: name, result: '✗ crashed', detail: e.message.split('\n')[0].slice(0, 60), seconds: Math.round((Date.now() - t) / 1000) });
  }
}

await step('weight (W8)', () => { try { return { out: execFileSync('node', ['scripts/check-weight.mjs'], { cwd: root, encoding: 'utf8' }) }; } catch (e) { return { out: e.stdout, problems: ['over the budget — see node scripts/check-weight.mjs'] }; } },
  (r) => (r.out.match(/total[^\n]*/) || [''])[0].replace(/\s+/g, ' ').trim());
await step('links (W10)', () => links({ live: !process.env.OFFLINE }), (r) => `${r.checked} addresses${r.domain.length ? ', www/http → https://getsurr.com' : ''}`);
await step('list form (W11)', form, (r) => `${r.rows.length} cases, chromium + webkit`);
await step('accessibility (W16)', a11y, (r) => `${r.rows.length} page × size, axe + keyboard`);
await step('splash paints (W1/W9)', async () => { const r = await paints(); return { r, problems: r.filter((x) => x.paints > 30).map((x) => `${x.size}: ${x.paints} repaints during the cut`) }; },
  ({ r }) => r.map((x) => `${x.size}: ${x.paints} paints`).join(', '));
// frame times are for the record, not a pass/fail: a hidden (headless) browser's clock is too noisy to judge by.
// for a real reading: HEADED=1 node tests/frames.mjs — and Safari's own Timelines tab on a Mac.
await step('splash frames (W1, for the record)', async () => ({ r: await frames({ engines: ['webkit', 'chromium'], runs: 2 }) }),
  ({ r }) => r.map((x) => `${x.engine[0]}/${x.size.split(' ')[0]} p95 ${x.p95}ms`).join(', '));
await step('screenshots (W2/W4/W5)', shots, (r) => `${r.count} pictures → tests/out/sheets`);

console.log('');
console.table(table);
for (const n of notes) console.log('  · ' + n);
for (const p of all) console.log('  ✗ ' + p);
console.log(all.length ? `\n${all.length} problem(s).` : '\nall clear. now flick through tests/out/sheets/ — every picture, by eye.');
process.exitCode = all.length ? 1 : 0;
