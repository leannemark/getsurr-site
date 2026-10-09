# speed, share previews and animation cost — results by date

Fail line (brief `getsurr-site-launch-tests`): performance ≥ 95, accessibility 100, layout shift < 0.05, words on screen < 1.5 s on the 4G profile. Newest first.

## 2026-10-09 — launch-tests branch

### Lighthouse (Lighthouse 12, Chrome, this Mac in Berlin)

| page | where | profile | performance | accessibility | words on screen | biggest thing drawn | layout shift | bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | live getsurr.com | phone, slow 4G + 4× CPU | **99** | **100** | 1.0 s | 2.1 s | 0 | 311 KB* |
| `/` | live getsurr.com | desktop | **100** | 98 → **100** after this branch† | 0.2 s | 0.4 s | 0 | 311 KB* |
| `/list/` | live getsurr.com | phone, slow 4G + 4× CPU | **99** | **100** | 1.0 s | 2.1 s | 0 | 311 KB* |
| `/list/` | live getsurr.com | desktop | **100** | **100** | 0.2 s | 0.4 s | 0 | 311 KB* |
| `/` and `/list/` | this branch, local | phone | 92 | 100 | 1.1 s | 3.4 s | 0 | 446 KB‡ |
| `/` and `/list/` | this branch, local | desktop | 100 | 100 | 0.3 s | 0.7 s | 0 | 446 KB‡ |

\* everything the page fetches, including the map poster that loads after the band; the first load the budget counts is 224 KB (`scripts/check-weight.mjs`).
† the one miss was "the page has no main landmark"; `role="main"` is now on the desktop and phone wrappers.
‡ the local test server does not compress (GitHub Pages does), so local numbers are slower than the live ones; the live rows are the ones that count. On the phone profile the "biggest thing drawn" is the `got a code? try the beta →` bar, which fades in on purpose once the page has settled.

**PageSpeed Insights (Google's servers):** not run today — Google's free daily allowance for the anonymous API was used up (`429 quota exceeded`), and the web page waits on the same allowance. Run it again from https://pagespeed.web.dev/ before 15 Oct; expected close to the live Lighthouse rows above (same engine, same throttling). **WebPageTest from five cities (W7):** not run — it now needs an account; left for Leanne's decision with the real-device cloud.

### Share previews (W6)

- Every public page (`/`, `/list/`, `/rings/`, `/deal/`, `/press/`, checked live) carries `og:title` `surr`, `og:description` "for lesbians, sapphics, trans & nonbinary people who'd rather link than scroll.", its own `og:url`, `og:image` `https://getsurr.com/img/share.jpg` (1200 × 630) and `twitter:card` `summary_large_image`.
- The live `img/share.jpg` is byte for byte the decided picture (`docs/brand/share-picture/surr-share-1200x630.jpg` in the app repo, sha1 `64f3d5e3…`): the grain with the logo. 228 KB, under WhatsApp's 300 KB preview limit.
- The Facebook, LinkedIn and X debuggers need a signed-in account, so they were not run by the chat; the in-app look (Instagram, WhatsApp, iMessage) is Leanne's phone check, step 3.

### Animation cost (W1, W9)

The friend's Safari lag: each splash scissors carried a `drop-shadow` **and** turned its second blade *inside* the same drawing, so on every frame of the cut the browser had to redraw the whole scissors and re-blur its shadow, four times over (PR #9's `will-change` could not help: the picture itself was changing). Now each scissors is five stacked layers (shadows, fixed blade, moving blade, bows and screw); the shadow is the same `0 20px 24px` at .9, taken apart into a black outline, nudged 20 px down and blurred with `blur(12px)` — which the graphics card applies itself. During the cut only finished layers move.

| measured | before (main) | after | how |
| --- | --- | --- | --- |
| Chromium: repaints during the cut, desktop 1440 | 64 | 22 | `node tests/paints.mjs` (Chrome's own trace) |
| Chromium: repaints during the cut, phone 390 | 21 | 4 | same |
| WebKit (Safari's engine), visible window, this Mac: 95 % of frames under | 17–18 ms | 17–18 ms | `HEADED=1 node tests/frames.mjs webkit` |
| WebKit: the one slowest frame (the click), desktop 1440 | 38–45 ms | 53–64 ms | same |
| looks: pixels an eye could see differ, splash at rest and cut, 3 sizes × 2 engines | — | 54–2,122 px, all on the hairline edges (anti-aliasing) | `node tests/splash.mjs compare` |

Read honestly: this Mac (Apple silicon) never stuttered, before or after, so its frame times cannot show the fix; the stutter lives in Safari's graphics-card work, which a test robot cannot time. What the numbers do show is that the cut no longer redraws the scissors on every frame. The proof is Leanne's step 1 in Safari on her Mac (Develop → Show Web Inspector → Timelines → record through the cut: frames under the 16 ms line). The click's first frame is ~15 ms slower than before (Safari building the new layers once) — about one frame, at the moment the cut starts.

Tried and dropped: an SVG `feGaussianBlur` shadow painted once into each layer (the brief's step 2). It looked identical but Safari repainted it in software twice per cut, ~155 ms each — worse than before.

### Every effect that still animates (W9)

| what | moves by | cost |
| --- | --- | --- |
| splash layers, scissors, blades | `transform`, `opacity` | layers only |
| band hover ("the others step back") | `opacity` | layers only (PR #9) |
| veil behind an open box | `opacity` | layers only (PR #9; no blur) |
| boxes opening, phone screens arriving, menu row, ticks | `opacity`, `transform` | layers only |
| map drift and lean | `transform` | layers only |
| band pictures arriving | `opacity` | layers only (PR #9) |
| **nights cell colour reveal** (grey → colour on hover/open) | `filter` (`grayscale`/`contrast`/`brightness` → none), 0.6 s | **kept on purpose**: one band cell (a fifth of the window), and colour filters are a cheap colour-matrix the graphics card applies without redrawing — not a blur. Turning it into a cross-fade would need a second copy of the picture. |
| `.s-spec` soft highlight on the blades | static SVG blur | painted once per layer, never animated |
