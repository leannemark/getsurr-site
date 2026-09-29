// Builds the pages under preview/ that are copies or plain pages.
// The one page is preview/index.html — edit that, then run: node scripts/build-preview.mjs
// It writes: the deep-link copies (rings, map, nights, list, drive, beta) and the plain pages (deal, press, support, 404).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'preview');
const BASE = '/preview/';
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
    ['imprint', '/imprint/'],
    ['the deal', `${BASE}deal/`],
  ]
    .map(([t, h]) => `<a href="${h}"${t === here ? ' aria-current="page"' : ''}>${t}</a>`)
    .join('');

const plain = (title, h1, body, here) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
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
<h1>${h1}</h1>
${body}
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

console.log('built: 6 deep-link copies, deal, support, press, 404');
