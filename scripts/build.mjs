// Builds the pages that are copies or plain pages.
// The one page is index.html — edit that, then run: node scripts/build.mjs
// It writes: the deep-link copies (rings, map, nights, list, beta), the plain pages (deal, press, support, 404),
// the legal pages (privacy, imprint — their text comes word for word from _legal/, which the site never serves),
// and the forwarding pages under preview/ that send the old hidden addresses to the live ones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/';
const SITE = 'https://getsurr.com';
const page = readFileSync(join(root, 'index.html'), 'utf8');

const write = (rel, html) => {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
};

// deep links: the same page, its own title; the page reads its path and opens the branch.
// the drive is not one of them: drive/ is a page of its own (drive/index.html, by hand)
const branches = {
  rings: 'mood rings · surr',
  map: 'map · surr',
  nights: 'nights · surr',
  list: 'the list · surr',
  beta: 'surr',
};
for (const [slug, title] of Object.entries(branches)) {
  write(
    `${slug}/index.html`,
    page
      .replace('<title>surr</title>', `<title>${title}</title>`)
      .replace(`content="${SITE}/">`, `content="${SITE}/${slug}/">`),
  );
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

// the share picture and the tab icon (decision 2026-10-01-site-share-picture in the app repo): every public page,
// never the desk or the forwarding pages. index.html carries the same lines by hand.
const share = (url) => `<meta property="og:type" content="website">
<meta property="og:title" content="surr">
<meta property="og:description" content="for lesbians, sapphics, trans &amp; nonbinary people who'd rather link than scroll.">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${BASE}img/share.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="surr">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="${BASE}img/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="${BASE}img/icon-180.png">`;

const plain = (title, h1, body, here, path) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="for lesbians, sapphics, trans &amp; nonbinary people who'd rather link than scroll.">
<meta name="theme-color" content="#050505">
<title>${title}</title>
${share(SITE + BASE + path)}
<link rel="stylesheet" href="${BASE}site.css">
<link rel="preload" as="font" type="font/woff2" crossorigin href="${BASE}fonts/ArchivoExpanded.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="${BASE}fonts/ArchivoSemiExpandedBold.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="${BASE}fonts/ArchivoRegular.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="${BASE}fonts/FragmentMono-Regular.woff2">
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
    'deal/',
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
    'support/',
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
    'press/',
  ),
);

write('404.html', plain('surr', 'nothing here.', `<p><a href="${BASE}">the door →</a></p>`, '', ''));

// the legal texts: word for word, wrapped in the plain page. the privacy policy is the generator's text as Till cleared it
// (2026-09-30); the generator's seal badge is left out because it loads from another domain.
const legal = (f) => `<div class="legal">\n${readFileSync(join(root, '_legal', f), 'utf8').trim()}\n</div>`;
write('privacy/index.html', plain('privacy · surr', 'privacy', legal('privacy-policy.html'), 'privacy', 'privacy/'));
write('imprint/index.html', plain('imprint · surr', '', legal('imprint.html'), 'imprint', 'imprint/'));

// the terms: the same words as the in-app terms (TERMS in src/features/legal/legalText.ts in the app repo), same sections,
// same order. when the app's terms change, change these with them.
const TERMS_INTRO = "the short version: be 18+, be who you say you are, treat people well, and what happens here stays here. the long version follows. last updated october 2026.";
const TERMS = [
  ["what surr is", "surr is a dating app for lesbians, sapphics, and trans and nonbinary people. we make the space; you bring the people and the conversations. we don’t write what’s posted here and we don’t control what people say to each other. we do check that every account belongs to a real person before it goes live, and we read every report. you’re responsible for how you treat people and what you share."],
  ["who it’s for", "adults only. by using surr you confirm you are 18 or older, and that anyone in the photos you share is too. surr is for lesbians, sapphics, and trans and nonbinary people. cis men aren’t welcome here. self-id is the only id that counts: we don’t police anyone’s gender, and trans women are women. if we believe an account doesn’t belong here, we can remove it."],
  ["getting in", "every signup is an application. a real person looks at your photos and a live selfie before your account goes live, usually within 24 hours. you need an invite code to apply. a code never skips the check. we can decline an application, and we don’t have to say why. your selfie is deleted once it has been reviewed, and after 14 days at the latest if it never was. surr is in beta in berlin: you can apply while visiting; outside the beta area you won’t appear to other people and they won’t appear to you, but your existing chats keep working."],
  ["your account", "one account per person, and it’s yours: don’t share it, sell it or hand it over. keep your login secure; what happens through your account is on you. the details you give us must be true. your date of birth can’t be changed after signup. we can ask you to verify again if something looks off."],
  ["what you share", "you own your photos, your words and everything else you post. so that surr works, you give us permission to store it, show it to other people on surr in line with your settings, and move it through our systems. that permission ends when you delete the content or your account, except where a copy is needed to handle a report, comply with the law, or keep our systems running for a short while afterwards. by posting, you confirm you have the right to share it, that everyone in it consented, and that it’s legal. your photos are you: recent, recognisable, yours. the photos you apply with are checked before your account goes live. photos you add later show straight away, and any photo can be reported and taken down. the rules: you’re in every photo, face clear in the first. no one under 18 anywhere in a photo, yours included. no nudity and no sex acts: underwear’s fine, nothing you’d have to blur. no one else’s face in your first photo. no screenshots, weapons or hate symbols. no phone numbers or handles in the image. no ai faces. a photo that breaks these comes down; a pattern loses the account. we don’t sell what you share and we don’t use it for advertising."],
  ["what’s not allowed", "the community guidelines are part of these terms. we have no tolerance for objectionable content or abusive people. in short: nothing involving anyone under 18 (we report this). nothing non-consensual and nothing illegal. no harassment, threats, hate or bigotry. no impersonation, fake profiles, stolen photos or bots. no selling: no promo, sugar arrangements, advertising, mlm or spam. don’t take anyone off surr: no screenshotting to out, mock or expose someone, no copying profiles, messages or identities elsewhere. no scraping, automation, reverse engineering, or attempts to get around the gate. if something crosses a line, we can remove the content, freeze the account, or remove it, with or without warning."],
  ["messages", "messages are between you and the person you’re talking to. we don’t control what they say and we can’t promise they’ll keep it to themselves. your chats are private to the two of you and protected in transit and at rest. they are not end-to-end encrypted: when someone reports a conversation, a person on our team can read the reported thread to deal with it. we don’t read messages otherwise."],
  ["location", "we never store your exact location. we verify which city you’re in and keep only that, and you can switch location off at any time in your settings. on the map: faces, not pins. areas, not addresses. appearing on it is a separate choice you make in the app and can undo in one tap, and it only ever places you somewhere inside an area of about a kilometre — never your exact location, never a distance. your phone rounds your location down to that area before anything is sent to us."],
  ["safety and enforcement", "you can report, block and unmatch anyone from their profile, your chats or the feed. blocking is silent and permanent unless you undo it. every report is read by a person. we can freeze or remove accounts that break these terms or the guidelines, and we can limit what new accounts can do for their first days. an account invited by someone who keeps inviting bad actors can lose its invite privileges. if you think we got a decision about your account wrong, write to hello@getsurr.com and we’ll look again."],
  ["your data", "how we handle your data is set out in the privacy policy, which is part of these terms. the short version: we collect what the app needs, we keep it in the eu, we don’t sell it, and you can delete your account and its data from your settings at any time. the newsletter is separate and opt-in; switch it off in your settings or from any email."],
  ["it’s free", "surr has no paid tier and nothing to buy. if that ever changes we’ll tell you in the app before it does, and nothing you already have will be put behind a payment without your agreement."],
  ["our role", "we run the platform and we do our best. surr is in beta: things will change, break, and sometimes go away. we don’t promise that the app will always be available, that it will work exactly as expected, or that you’ll meet anyone."],
  ["liability", "we’re not responsible for what other people on surr do or say, for what happens between people who meet through surr, or for how you choose to use it. as far as the law allows, we’re not liable for indirect losses. nothing here limits liability for intent or gross negligence, for harm to life, body or health, or for anything that can’t be limited under the law where you live. if your local consumer law gives you more rights than these terms, those rights still apply."],
  ["ending things", "you can delete your account at any time from your settings. that removes your profile and content from surr; some records are kept for as long as the law requires or a report needs. we can end your account for breaking these terms or the guidelines, for keeping surr safe, or if we stop running the service. where we can, we’ll tell you why."],
  ["changes", "we’ll update these terms as surr grows. when we make a meaningful change we’ll tell you in the app or by email before it takes effect. if you keep using surr after that, you accept the new terms. if you don’t, delete your account."],
  ["apple", "if you use surr on an iphone, these terms are between you and us, not apple. apple has no obligation to support or maintain surr and isn’t responsible for it. apple can enforce these terms as a third party where they concern the app."],
  ["law and where", "these terms are governed by the laws of germany. if you’re a consumer in the eu, the mandatory consumer protections of the country you live in still apply, and you can bring a claim where you live."],
  ["the company behind this", "surr is operated by mother loading ug (haftungsbeschränkt), stresemannstr. 23, 10963 berlin, germany, registered at amtsgericht charlottenburg, hrb 250040, represented by leanne mark. vat id de360762507."],
  ["contact", "support, questions and legal notices: hello@getsurr.com. reports: the report button in the app, or the same address."],
];
write(
  'terms/index.html',
  plain(
    'terms · surr',
    'terms',
    `<div class="legal">\n<p>${TERMS_INTRO}</p>\n${TERMS.map(([l, b]) => `<h2>${l}</h2>\n<p>${b}</p>`).join('\n')}\n</div>`,
    '',
    'terms/',
  ),
);

// the allies' door: getsurr.com/drive/allies/ is the drive page with the door set (drive.js reads data-door and opens on section 03).
// it is a door, not a page of its own: always noindex, canonical to /drive/ — so switch-on never has to touch it.
const drivePage = readFileSync(join(root, 'drive/index.html'), 'utf8');
write(
  'drive/allies/index.html',
  drivePage
    .replace('<html lang="en">', '<html lang="en" data-door="allies">')
    .replace(/<!-- hidden until the drive is public[^\n]*-->\n<meta name="robots" content="noindex">\n/, '')
    .replace(
      '<meta name="theme-color"',
      `<meta name="robots" content="noindex">\n<link rel="canonical" href="${SITE}${BASE}drive/">\n<meta name="theme-color"`,
    ),
);

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
const moved = ['', ...Object.keys(branches), 'drive', 'deal', 'press', 'support'];
for (const slug of moved) write(`preview/${slug ? slug + '/' : ''}index.html`, forward(`${BASE}${slug ? slug + '/' : ''}`));

// the guidelines are the deal: the welcome email links /guidelines
write('guidelines/index.html', forward(`${BASE}deal/`));

console.log(`built: ${Object.keys(branches).length} deep-link copies, deal, support, press, 404, privacy, imprint, terms, the allies door, ${moved.length} forwarding pages, guidelines`);
