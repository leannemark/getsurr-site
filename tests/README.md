# tests — the launch checks for getsurr.com

From `docs/briefs/getsurr-site-launch-tests.md` and `docs/LAUNCH_TESTS.md` part 1 in the app repo. **Run `npm test` before any announcement, and before every pull request that changes how the site looks** (first time: `npm install && npx playwright install chromium webkit firefox`). It serves the folder locally (`tests/serve.mjs`, a small copy of GitHub Pages), runs everything below and ends in one table. Pictures go to `tests/out/` (never committed); **open `tests/out/sheets/` and look at every sheet** — a machine can say nothing is cut off, but only an eye can say it looks right.

| file | what | launch row |
| --- | --- | --- |
| `shots.mjs` | every page × WebKit (Safari), Chromium (Chrome, Edge, Samsung Internet), Firefox × iPhone SE, iPhone 15, a 360-px Android, iPad (each upright and on its side), 1280 laptop, a 4k screen at 200 %, 2560 desktop; the five desktop boxes open; the splash mid-cut. Fails on sideways scroll, a broken picture, a console error, light mode differing from dark, anything moving with reduced motion on, no words with fonts blocked or JavaScript off | W2 W4 W5 |
| `links.mjs` | walks the site from `/`: every page, picture, font and script answers 200; then the live domain: `www.` and `http://` land on `https://getsurr.com/` (`OFFLINE=1` skips the live part) | W10 |
| `form.mjs` | the list form, abused, in Chromium and WebKit, against a stand-in that copies the server function's rules (nothing is written anywhere): empty, bad email, no city, 300 characters, emoji, server down, server never answers, double submit — each must end in a visible line | W11 |
| `form-staging.sql` | the real `join_waitlist` function on the **staging** server: the same cases plus 50 in a row, one row per address, test rows deleted after. Run from the app repo: `npm run db:query -- -f <path>/tests/form-staging.sql`. **Never on production.** | W11 |
| `a11y.mjs` | axe on every page at phone and laptop size; Tab reaches every control on screen and each has a name | W16 |
| `splash.mjs` | the splash held still with blades open and shut, in WebKit and Chromium — `save <dir>` before a change, `save <dir2>` after, `compare <dir> <dir2>` | W1 |
| `paints.mjs`, `frames.mjs` | how much the browser re-draws while the scissors cut, and the frame times (`HEADED=1` uses the real graphics card, `CPU=6` slows Chromium six times) | W1 W9 |
| `speed.md` | the speed and share-preview results, by date | W6 W7 W9 |

**Security headers:** `tests/serve.mjs` sends every answer with `security-headers.json` — the same headers Cloudflare adds live (app repo `docs/SITE_CLOUDFLARE.md`) — so a page that breaks under them (a blocked script, picture or font) fails here first. Change the file and Cloudflare together.

**Down-alert:** `.github/workflows/watch.yml` checks getsurr.com and the production server every 5 minutes and opens a "down: …" issue that mentions Leanne (closed by itself when they answer again).

The CI job (`.github/workflows/tests.yml`) runs the links and a two-engine screenshot pass on every pull request and keeps the pictures as a download for two weeks; the weight check stays in `check.yml`.
