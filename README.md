# getsurr-site

The website at getsurr.com, built from the briefs `docs/briefs/getsurr-site-v04.md` and `docs/briefs/getsurr-site-go-live.md` in the `surr` app repo (the legal pages first came from `docs/briefs/getsurr-com-legal-pages.md`). Plain HTML, CSS and a little JS, hosted on GitHub Pages with a custom domain (`getsurr.com`, see `CNAME`). DNS and the mail records are not in this repo — never change them from here.

## Layout

- `index.html` is **the one page** (splash, band, five branches, the snap phone version). The branch addresses (`rings`, `map`, `nights`, `list`, `drive`, `beta`) are copies of it that open their branch on load.
- `deal`, `press`, `support`, `privacy`, `imprint` and `404.html` are plain pages; every page carries the footer `press · support · imprint · privacy · the deal` (on the phone it sits under the list form, the last thing on the last screen).
- `privacy` and `imprint` are legal texts, set **word for word** from `_legal/privacy-policy.html` and `_legal/imprint.html` (the generator's output; `_legal/` is never served). Never edit, shorten or "fix" those texts — a new version comes from the generator and Till. The generator's seal badge is left out because it would load from another domain.
- `preview/` holds only small forwarding pages (noindex): the site was first built at the hidden address `getsurr.com/preview/`, and links shared from then still land on the live addresses.
- **After editing `index.html`, the plain-page words or a file in `_legal/`, run `node scripts/build.mjs`** to rewrite every copy, plain page and forwarding page.
- `config.js` holds the everyday switches: the Supabase project the list form writes to (public key only), `APP_URL` (the public TestFlight link; empty hides `open in testflight →`), `RADIO_ON` / `RADIO_EMBED_URL`, and `NEXT_NIGHT` (set to `null` the morning after).

## What the site never does

- No third-party request on load: fonts are self-hosted (OFL, licences in `fonts/`), no analytics, no cookies. Only the list form talks to Supabase (the `join_waitlist` function — email, city and an optional instagram or link, the same list as the app), and only the radio's own `play →` tap loads SoundCloud. The privacy policy depends on this.
- `cum inside` on the splash is drawn as outlines (`img/cum-inside.svg`), so it is never indexable text. The scissors are an inline SVG placeholder until the photograph.
## The desk

`desk/` is Leanne's private working page at `getsurr.com/desk/` (briefs `docs/briefs/desk-one.md` and `desk-two.md` in the app repo): applications, reports, the list (send a code / not now) and feedback (done / keep as a quote, plus the kept quotes at `#quotes`), one at a time, behind the app's own six-digit email code.

- **Unlinked and hidden:** no page links to it, it carries `noindex, nofollow`, and it is in no sitemap. `scripts/build.mjs` writes only the site's own pages, so it never touches `desk/`.
- **Stands alone:** its own fonts (`desk/fonts/`, same OFL files as the site) and its own `desk/config.js` (the project address and public key — never a service key). Nothing on it loads from anywhere else.
- **Talks only to Supabase, and only after login:** the auth server for the code, then the `desk` Edge Function for everything. The page holds no powers; the function checks every request (session under 30 days old, a desk member) and answers only `https://getsurr.com`.
- **Moving it to another project** means changing `desk/config.js` **and** the project address in the Content-Security-Policy line of `desk/index.html`.
