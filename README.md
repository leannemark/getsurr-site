# getsurr-site

The static legal pages for getsurr.com (imprint now, privacy policy after Till's review). Plain HTML, inline CSS, system font — no analytics, cookies, web fonts, scripts or embeds, so nothing on this site ever calls another domain. See `docs/briefs/getsurr-com-legal-pages.md` in the `surr` app repo for the brief this was built from.

Hosted on GitHub Pages with a custom domain (`getsurr.com`, see `CNAME`). To add the privacy policy later: add `privacy/index.html` following the same pattern as `imprint/index.html`, and add its link to both footers.

## The website preview (`preview/`)

The whole site, built at the hidden address `getsurr.com/preview/` (noindex, unlinked) from the brief `docs/briefs/getsurr-site-v04.md` in the app repo. The root keeps the imprint-only front page until the site goes live.

- `preview/index.html` is **the one page** (splash, band, five branches, the snap phone version). The branch addresses (`rings`, `map`, `nights`, `list`, `drive`, `beta`) are copies of it that open their branch on load, and `deal`, `press`, `support`, `404.html` are plain pages. After editing `index.html` or the plain-page words, run `node scripts/build-preview.mjs` to rewrite them all.
- `preview/config.js` holds the everyday switches: the Supabase project the list form writes to (public key only), `APP_URL` (the public TestFlight link; empty hides `open in testflight →`), `RADIO_ON` / `RADIO_EMBED_URL`, and `NEXT_NIGHT` (set to `null` the morning after).
- No third-party request on load: fonts are self-hosted (OFL, licences in `preview/fonts/`), no analytics, no cookies. Only the list form talks to Supabase, and only the radio's own `play →` tap loads SoundCloud.
- `cum inside` on the splash is drawn as outlines (`img/cum-inside.svg`), so it is never indexable text. The scissors are an inline SVG placeholder until the photograph.
- GitHub Pages serves only the root `404.html`, so an unknown address under `/preview/` shows the legal front page's 404; `preview/404.html` is ready for when the site moves to the root.

## The desk

`desk/` is Leanne's private working page at `getsurr.com/desk/` (brief `docs/briefs/desk-one.md` in the app repo): applications and reports, one at a time, behind the app's own six-digit email code.

- **Unlinked and hidden:** no page links to it, it carries `noindex, nofollow`, and it is in no sitemap. `scripts/build.mjs` never touches `desk/`.
- **Stands alone:** its own fonts (`desk/fonts/`, same OFL files as the site) and its own `desk/config.js` (the project address and public key — never a service key). Nothing on it loads from anywhere else.
- **Talks only to Supabase, and only after login:** the auth server for the code, then the `desk` Edge Function for everything. The page holds no powers; the function checks every request (session under 30 days old, a desk member) and answers only `https://getsurr.com`.
- **Moving it to another project** means changing `desk/config.js` **and** the project address in the Content-Security-Policy line of `desk/index.html`.
