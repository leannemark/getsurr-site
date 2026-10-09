# getsurr-site

The website at getsurr.com, built from the briefs `docs/briefs/getsurr-site-v04.md` and `docs/briefs/getsurr-site-go-live.md` in the `surr` app repo (the legal pages first came from `docs/briefs/getsurr-com-legal-pages.md`). Plain HTML, CSS and a little JS, hosted on GitHub Pages with a custom domain (`getsurr.com`, see `CNAME`). DNS and the mail records are not in this repo — never change them from here.

## Layout

- `index.html` is **the one page** (splash, band, five branches, the snap phone version). The branch addresses (`rings`, `map`, `nights`, `list`, `drive`, `beta`) are copies of it that open their branch on load.
- **Phone landing:** after the scissors the phone shows only `surr`, `say less` and a `↓` (scrolls to the first screen). A thin menu row with the five names drops in whenever a screen settles, holds 1.8 s and leaves; the five ticks on the right edge stay as the quiet trace. Scrolling up is the way back to the landing.
- `deal`, `press`, `support`, `terms`, `privacy`, `imprint` and `404.html` are plain pages; every page carries the footer `press · support · imprint · privacy · the deal` (on the phone it sits under the list form, the last thing on the last screen).
- `privacy` and `imprint` are legal texts, set **word for word** from `_legal/privacy-policy.html` and `_legal/imprint.html` (the generator's output; `_legal/` is never served). Never edit, shorten or "fix" those texts — a new version comes from the generator and Till. The generator's seal badge is left out because it would load from another domain.
- **Share picture and tab icon** (decision `docs/decisions/2026-10-01-site-share-picture.md` in the app repo): every public page carries the share lines (`img/share.jpg`, the grain with the logo — copied as it is from the app repo's `docs/brand/share-picture/`, never redrawn here, never any other picture) and the app icon (`img/icon-32.png`, `img/icon-180.png`). `index.html` has them by hand; `scripts/build.mjs` writes them into every copy and plain page with the page's own address. Not the desk, not `preview/`.
- `terms` carries the same words as the in-app terms (`TERMS` in `src/features/legal/legalText.ts` in the app repo), kept in `scripts/build.mjs`; when the app's terms change, change them there too. It is not in the footer (the app and the emails link it directly).
- `guidelines/` is a small forwarding page to `/deal/` (the deal is the community guidelines; the welcome email links `/guidelines`).
- `preview/` holds only small forwarding pages (noindex): the site was first built at the hidden address `getsurr.com/preview/`, and links shared from then still land on the live addresses.
- **After editing `index.html`, the plain-page words or a file in `_legal/`, run `node scripts/build.mjs`** to rewrite every copy, plain page and forwarding page.
- `config.js` holds the everyday switches: the Supabase project the list form writes to (public key only), `APP_URL` (the public TestFlight link; while it is empty the beta part shows one email box — "we'll tell you the day it's live" — in place of the four steps and `open in testflight →`; set it and the steps come back), `RADIO_ON` / `RADIO_EMBED_URL`, and `NEXT_NIGHT` (set to `null` the morning after).

## Weight — keep it light on a weak connection

A friend on a slow desktop line saw the pictures load oddly and the page lag (2026-10-08). Since then:

- **The one page must load under 250 KB in total** (html, css, js, the preloaded fonts and every picture `index.html` shows on first paint). `node scripts/check-weight.mjs` prints the table and fails above the budget; the GitHub Action runs it on every pull request.
- **Pictures:** WebP only, sized for the space they fill (a band cell is about a fifth of the window wide; 800 px on the long side is plenty), never over 110 KB. The map poster is loaded after the band by `site.js` (`data-src`), so a new heavy picture goes the same way, never straight into `src`. `share.jpg` and the icons are the exceptions (they are not part of the page).
- **Fonts:** subset WOFF2 only (`fonts/`, licences next to them). Adding a character the subset does not have (check with the command in `scripts/check-weight.mjs`'s header) means rebuilding the subsets, not switching back to the full files.
- **No effect that blurs the whole window** (`backdrop-filter`, animated `filter: blur`), and no new drop-shadows on animated things. Dim with opacity instead.
- **Before every pull request, look at the site slowly:** serve the folder (`python3 -m http.server 8000`), then in Chrome open the developer tools, Network tab, set the throttling dropdown to "Slow 3G", and in the Performance tab set CPU to "6× slowdown"; reload. The scissors must appear at once, the band's pictures must fade in within a few seconds, and no letters may change shape after they appear. Then `npx -y lighthouse http://localhost:8000/ --only-categories=performance` — the performance score must stay at 90 or above.

## Launch tests

`npm test` (first time: `npm install && npx playwright install chromium webkit firefox`) runs every check a machine can make — screenshots in three engines and ten sizes, links, the list form, accessibility, the splash's repaint count — and ends in one table; then look at every sheet in `tests/out/sheets/`. Run it before any announcement and before a pull request that changes how the site looks. What each test does: `tests/README.md`; speed results: `tests/speed.md`.

## What the site never does

- No third-party request on load: fonts are self-hosted (OFL, licences in `fonts/`), no analytics, no cookies. Only two things talk to Supabase: the list form (the `join_waitlist` function — email, city and an optional instagram or link, the same list as the app) and the beta box (the `ask_beta_link` function — one email, nothing else, kept until the "it's live" email has gone out and then deleted). Only the radio's own `play →` tap loads SoundCloud. The privacy policy depends on this.
- `cum inside` on the splash is drawn as outlines (`img/cum-inside.svg`), so it is never indexable text. The scissors are an inline SVG placeholder until the photograph.
## The desk

`desk/` is Leanne's private working page at `getsurr.com/desk/` (briefs `docs/briefs/desk-one.md` and `desk-two.md` in the app repo): applications, reports, the list (send a code / not now), the beta link (a count of the addresses left in the beta box, and `send the link` once the TestFlight link is set in the server's `config.desk.app_url`) and feedback (done / keep as a quote, plus the kept quotes at `#quotes`), one at a time, behind the app's own six-digit email code.

- **Unlinked and hidden:** no page links to it, it carries `noindex, nofollow`, and it is in no sitemap. `scripts/build.mjs` writes only the site's own pages, so it never touches `desk/`.
- **Stands alone:** its own fonts (`desk/fonts/`, same OFL files as the site) and its own `desk/config.js` (the project address and public key — never a service key). Nothing on it loads from anywhere else.
- **Talks only to Supabase, and only after login:** the auth server for the code, then the `desk` Edge Function for everything. The page holds no powers; the function checks every request (session under 30 days old, a desk member) and answers only `https://getsurr.com`.
- **Moving it to another project** means changing `desk/config.js` **and** the project address in the Content-Security-Policy line of `desk/index.html`.
