// Builds the pages that are copies or plain pages.
// The one page is index.html — edit that, then run: node scripts/build.mjs
// It writes: the deep-link copies (rings, map, nights, list, drive, beta), the plain pages (deal, press, support, 404),
// the legal pages (privacy, imprint — their text comes word for word from _legal/, which the site never serves),
// and the forwarding pages under preview/ that send the old hidden addresses to the live ones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/';
const page = readFileSync(join(root, 'index.html'), 'utf8');

const write = (rel, html) => {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
};

// deep links: the same page, its own title; the page reads its path and opens the branch
const branches = {
  rings: 'mood rings · surr',
  map: 'map · surr',
  nights: 'nights · surr',
  list: 'the list · surr',
  drive: 'the list · surr',
  beta: 'surr',
};
for (const [slug, title] of Object.entries(branches)) {
  write(`${slug}/index.html`, page.replace('<title>surr</title>', `<title>${title}</title>`));
}

// plain pages
const DEAL = [
  "For dating, hooking up, making out — or just seeing who's around. Not for networking, selling or bots.",
  'No cis men. No exceptions.',
  "What's here stays here — no screenshots, no outing anyone.",
  `Invite only for now. No code? <a href="${BASE}list/">Join the list</a>.`,
  'A real person approves every profile. No fakes, no catfish.',
];
const mail = '<a href="mailto:hello@getsurr.com">hello@getsurr.com</a>';
const footer = (here) =>
  [
    ['press', `${BASE}press/`],
    ['support', `${BASE}support/`],
    ['imprint', `${BASE}imprint/`],
    ['privacy', `${BASE}privacy/`],
    ['the deal', `${BASE}deal/`],
  ]
    .map(([t, h]) => `<a href="${h}"${t === here ? ' aria-current="page"' : ''}>${t}</a>`)
    .join('');

const plain = (title, h1, body, here) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="for lesbians, sapphics, trans &amp; nonbinary people who'd rather link than scroll.">
<meta name="theme-color" content="#050505">
<title>${title}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${BASE}site.css">
</head>
<body>
<div class="plain">
<header><a href="${BASE}" class="big">surr</a><span class="mono">say less</span></header>
<main>
${h1 ? `<h1>${h1}</h1>\n` : ''}${body}
</main>
<footer>${footer(here)}</footer>
</div>
</body>
</html>
`;

write(
  'deal/index.html',
  plain(
    'the deal · surr',
    'the deal',
    `<ol>\n${DEAL.map((l, i) => `<li><b>0${i + 1}</b><span>${l}</span></li>`).join('\n')}\n</ol>
<p>If someone breaks it: block, report, unmatch. It's on every profile and in every chat. You can freeze your account or delete it any time, from the you tab. A person reads every report. ${mail} if you need one.</p>`,
    'the deal',
  ),
);

write(
  'support/index.html',
  plain(
    'support · surr',
    'support',
    `<p>A person reads every email. ${mail}</p>
<p>To delete your account: you tab → account → delete account. Everything goes with it.</p>
<p>To pause instead: you tab → account → freeze account.</p>
<p>To report or block someone: the ··· menu on their profile, or in the chat.</p>
<p>To leave the map: you tab → location, off.</p>`,
    'support',
  ),
);

write(
  'press/index.html',
  plain(
    'press · surr',
    'press',
    `<p>surr is a dating app for lesbians, sapphics, trans &amp; nonbinary people, made in Berlin. Invite only for now.</p>
<p>Founder: Leanne Mark. Write to ${mail} — a person answers.</p>
<p>Investors: the same address, subject "backstage".</p>`,
    'press',
  ),
);

write('404.html', plain('surr', 'nothing here.', `<p><a href="${BASE}">the door →</a></p>`, ''));

// the legal texts: word for word, wrapped in the plain page. the privacy policy is the generator's text as Till cleared it
// (2026-09-30); the generator's seal badge is left out because it loads from another domain.
const legal = (f) => `<div class="legal">\n${readFileSync(join(root, '_legal', f), 'utf8').trim()}\n</div>`;
write('privacy/index.html', plain('privacy · surr', 'privacy', legal('privacy-policy.html'), 'privacy'));
write('imprint/index.html', plain('imprint · surr', '', legal('imprint.html'), 'imprint'));

// the old hidden addresses: each forwards to its live address, and is never indexed
const forward = (to) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="https://getsurr.com${to}">
<title>surr</title>
</head>
<body style="background:#050505;color:#E8E8E8;font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:24px"><a href="${to}" style="color:inherit">surr →</a></body>
</html>
`;
const moved = ['', ...Object.keys(branches), 'deal', 'press', 'support'];
for (const slug of moved) write(`preview/${slug ? slug + '/' : ''}index.html`, forward(`${BASE}${slug ? slug + '/' : ''}`));

console.log(`built: 6 deep-link copies, deal, support, press, 404, privacy, imprint, ${moved.length} forwarding pages`);
