/* surr — the drive, getsurr.com/drive/ (brief docs/briefs/drive-page.md in the app repo).
   the six sections, the three price sets, the city race, the pay bar and the after-screens, the soli sheet, the allies' share picture.
   no storage, no analytics. the only call out is the list form (join_waitlist), exactly as on the one page.
   payments are not wired: pay() and sendAsk() only move between the page's own states; nothing is charged or sent. */
(function () {
  'use strict';
  var C = window.SURR || {};
  var D = C.DRIVE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var deskMQ = matchMedia('(min-width: 721px)');
  var n0 = function (x) { x = Math.floor(+x); return x > 0 ? x : 0; };

  /* the allies' door (getsurr.com/drive/allies/, a copy of this page made by scripts/build.mjs): opens on section 03 and is never indexed */
  var DOOR = document.documentElement.getAttribute('data-door') === 'allies';
  var DOORLINK = 'https://surr.gay/allies';

  /* switch-on: with DRIVE.ON the page may be indexed (switch-on also deletes the noindex line from drive/index.html) */
  if (D.ON && !DOOR) { var ni = $('meta[name="robots"]'); if (ni) ni.remove(); }

  /* ————— the prices (MARKET_ANALYSIS.md §13.2 and §16, decided). the picked city decides the set; no fourth set, ever ————— */
  var SETS = {
    /* list: a year, three years (after the drive: listAfter a year); backstage: a year, three years (owner, 2026-10-09: three for two;
       after the drive: backAfter a year); for life: list in two steps, backstage for life; soli */
    eur: { sym: '€', year: 120, three: 300, listAfter: 150, back1: 300, back3: 600, backAfter: 350, life: [450, 550], blife: 888, soli: 30 },
    gbp: { sym: '£', year: 140, three: 340, listAfter: 170, back1: 340, back3: 680, backAfter: 400, life: [500, 600], blife: 888, soli: 45 },
    usd: { sym: '$', year: 160, three: 400, listAfter: 200, back1: 390, back3: 780, backAfter: 450, life: [600, 725], blife: 1188, soli: 50 }
  };
  /* the visitor's country decides the set (owner, 2026-10-09): preset from the phone's own time zone, nothing asked of a server */
  var COUNTRIES = ['germany', 'austria', 'belgium', 'denmark', 'france', 'greece', 'ireland', 'italy', 'netherlands', 'poland', 'portugal', 'spain', 'sweden', 'switzerland',
    'united kingdom', 'united states', 'canada', 'mexico', 'brazil', 'australia', 'somewhere else'];
  var countrySet = function (c) { return c === 'united kingdom' ? 'gbp' : c === 'united states' ? 'usd' : 'eur'; };
  function guessCountry() {
    var z = '';
    try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    if (/^Europe\/(London|Belfast|Guernsey|Jersey|Isle_of_Man)$/.test(z)) return 'united kingdom';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Adak|Indiana|Kentucky|North_Dakota|Menominee|Nome|Sitka|Metlakatla|Yakutat)|^Pacific\/Honolulu$/.test(z)) return 'united states';
    var m = { Berlin: 'germany', Vienna: 'austria', Brussels: 'belgium', Copenhagen: 'denmark', Paris: 'france', Athens: 'greece', Dublin: 'ireland', Rome: 'italy',
      Amsterdam: 'netherlands', Warsaw: 'poland', Lisbon: 'portugal', Madrid: 'spain', Stockholm: 'sweden', Zurich: 'switzerland' }[(z.match(/^Europe\/(\w+)$/) || [])[1]];
    if (m) return m;
    if (/^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina)$/.test(z)) return 'canada';
    if (/^America\/(Mexico_City|Cancun|Monterrey|Tijuana|Merida)$/.test(z)) return 'mexico';
    if (/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Manaus|Belem)$/.test(z)) return 'brazil';
    if (/^Australia\//.test(z)) return 'australia';
    return 'somewhere else';
  }
  var HOME = { eur: 'berlin', gbp: 'london', usd: 'new york' };
  /* the weekend is a Berlin event: euros in every set (the allies and the pieces too) */
  var WEEKEND = 1800, WEEKEND_FRIEND = 2100;
  /* for life: the first 100 in each city at the lower price, then the higher one, up to the city's cap */
  var LIFE_FIRST = 100;
  var LIFE_CAP = { berlin: 200, paris: 100, amsterdam: 50, barcelona: 50, london: 300, 'new york': 500 };
  var CITIES = ['berlin', 'amsterdam', 'barcelona', 'london', 'paris', 'new york', 'toronto', 'montreal', 'los angeles', 'mexico city', 'são paulo', 'rio de janeiro', 'athens', 'copenhagen', 'melbourne'];
  var PLAN = ['berlin', 'amsterdam', 'barcelona', 'london', 'paris', 'new york'];

  var money = function (sym, n) { return sym + n.toLocaleString('en-US'); };
  var eur = function (n) { return money('€', n); };
  var cap = function (s) { return s.split(' ').map(function (w) { return w === 'de' ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); };
  var nb = function (n) { return n + (n === 1 ? ' bid' : ' bids'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ————— the state, and the preview switch (?show=paying | after | ally | soli | giving | strip) — it sends nothing and charges nothing ————— */
  var SHOW = (location.search.match(/[?&]show=([a-z]+)/) || [])[1] || '';
  var PREVIEW = ['paying', 'after', 'ally', 'soli', 'giving'].indexOf(SHOW) >= 0;
  var PICK = !!D.PAY_ON || PREVIEW;
  var S = { country: guessCountry(), set: 'eur', city: '', sel: null, done: false, all: false, amount: '', sheet: false, sent: false, showName: false, slim: DOOR, form: null };
  S.set = countrySet(S.country);
  if (SHOW === 'paying') S.sel = { k: 'p', id: 'life', lvl: 'list' };
  if (SHOW === 'after') { S.sel = { k: 'p', id: 'life', lvl: 'list' }; S.city = 'barcelona'; S.done = true; }
  if (SHOW === 'ally') { S.sel = { k: 'a', id: 'table' }; S.done = true; }
  if (SHOW === 'soli') S.sheet = true;
  if (SHOW === 'giving') S.sel = { k: 'a', id: 'table' };
  var P = function () { return SETS[S.set]; };

  /* the count and the cap follow the city picked for the bids (Berlin, London or New York by the visitor's country until one is picked);
     the prices follow the visitor's country. a city capped at 100 or fewer sells at the first price only */
  function lifeInfo() {
    var city = LIFE_CAP[S.city] ? S.city : HOME[S.set], top = LIFE_CAP[city], sold = n0((D.LIFE_SOLD || {})[city]), p = P();
    var where = 'For life: ' + top + ' in ' + cap(city) + ', only in the first season.';
    if (top <= LIFE_FIRST) return { price: p.life[0], left: Math.max(0, top - sold) + ' of ' + top + ' left', note: where + ' At ' + money(p.sym, p.life[0]) + '.' };
    var first = sold < LIFE_FIRST;
    return {
      price: first ? p.life[0] : p.life[1],
      left: first ? (LIFE_FIRST - sold) + ' of the first ' + LIFE_FIRST + ' left' : Math.max(0, top - sold) + ' of ' + top + ' left',
      note: where + ' The first ' + LIFE_FIRST + ' at ' + money(p.sym, p.life[0]) + ', then ' + money(p.sym, p.life[1]) + '.'
    };
  }

  /* the patron menu: how long × list or backstage (owner, 2026-10-09), then the weekend */
  var LENGTHS = [
    { id: 'year', nm: 'a year', bids: 1 },
    { id: 'three', nm: 'three years', bids: 3 },
    { id: 'life', nm: 'for life', bids: 10, hero: true }
  ];
  function patronItem(id, lvl) {
    var p = P();
    if (id === 'weekend') return { nm: 'the weekend', bids: 10, price: eur(WEEKEND) };
    if (id === 'year') return lvl === 'back' ? { nm: 'a year of backstage', bids: 1, price: money(p.sym, p.back1) } : { nm: 'a year', bids: 1, price: money(p.sym, p.year) };
    if (id === 'three') return lvl === 'back' ? { nm: 'three years of backstage', bids: 3, price: money(p.sym, p.back3) } : { nm: 'three years', bids: 3, price: money(p.sym, p.three) };
    return lvl === 'back' ? { nm: 'backstage for life', bids: 10, price: money(p.sym, p.blife) } : { nm: 'for life', bids: 10, price: money(p.sym, lifeInfo().price) };
  }
  function lengthNote(id) {
    var p = P();
    if (id === 'year') return 'After the drive: ' + money(p.sym, p.listAfter) + ' · backstage ' + money(p.sym, p.backAfter) + '.';
    if (id === 'three') return 'After the drive: ' + money(p.sym, p.listAfter * 3) + ' · backstage ' + money(p.sym, p.backAfter * 3) + '.';
    return lifeInfo().note + " Backstage for life: 88 in each city, numbered. There's no next issue.";
  }

  /* the allies' symbols: the SVG bodies from the ladder mockup (look a), verbatim, viewBox 0 0 24 24 */
  var SYM = {
    round: '<g transform="rotate(12 4.5 16.5)"><path d="M1.5 6.5h6l-3 4.6zM4.5 11.1v5.4M3 16.5h3"/></g><g transform="rotate(-12 19.5 16.5)"><path d="M16.5 6.5h6l-3 4.6zM19.5 11.1v5.4M18 16.5h3"/></g><path d="M7.6 7.5h8.8L12 14z" style="fill:var(--bg)"/><path d="M12 14v6.5M9.8 20.5h4.4"/><circle cx="14.2" cy="9.2" r=".7"/>',
    bottle: '<path d="M10.6 2h2.8v3.6c0 1.6 2.6 2.6 2.6 6V21a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9.4c0-3.4 2.6-4.4 2.6-6z"/><path d="M10.6 5.2h2.8M8 13.5h8v4.2H8"/>',
    table: '<path d="M2 16h20M5 16v6M19 16v6"/><path d="M9 11h6l-.8 5H9.8z"/><path d="M11.1 11V7.4c0-.5.4-.8.6-1.1V4h1.1v2.3c.2.3.6.6.6 1.1V11"/><path d="M3.2 11h3.6q0 2.2-1.8 2.2T3.2 11zM5 13.2V16M17.2 11h3.6q0 2.2-1.8 2.2T17.2 11zM19 13.2V16"/>',
    section: '<circle cx="5" cy="6.2" r="1.3"/><circle cx="19" cy="6.2" r="1.3"/><path d="M5 7.5V20M19 7.5V20M3 20h4M17 20h4"/><path class="r" d="M5 9.5c3 5 11 5 14 0"/>',
    cabana: '<path class="rf" d="M5.2 10.6c2.6 2.6 3 6 1.6 9.4H5.2zM18.8 10.6c-2.6 2.6-3 6-1.6 9.4h1.6z"/><path d="M3 10l9-6 9 6z"/><path d="M5 10v10M19 10v10M2 20h20"/><path d="M3 10q1.5 1.6 3 0t3 0 3 0 3 0 3 0 3 0"/>',
    yacht: '<path d="M2 14.5h20l-3 4.5H5z"/><path d="M6.5 14.5V12h7.5l2.5 2.5M9 12V7.6M9.8 13.2h1.2M12.4 13.2h1.2"/><circle class="rf" cx="9" cy="6.6" r="1"/><path d="M3 21.5q1.5-1 3 0t3 0 3 0 3 0 3 0 3 0"/>',
    villa: '<path d="M2.5 17h15M4 17v-6h12v6M3.4 11h13.2M7 11V7.6h7V11"/><path d="M5.6 17v-2.6a1.1 1.1 0 0 1 2.2 0V17M8.9 17v-2.6a1.1 1.1 0 0 1 2.2 0V17M12.2 17v-2.6a1.1 1.1 0 0 1 2.2 0V17M9.4 9.6v-.4a1.1 1.1 0 0 1 2.2 0v.4"/><path d="M20 17c-1.5-2.8-1.5-7.4 0-11 1.5 3.6 1.5 8.2 0 11zM20 17v1"/><path d="M3 20.5q1.5-1 3 0t3 0 3 0 3 0 3 0 3 0"/><path class="rf" d="M4 2.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>'
  };
  var svg = function (id) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + SYM[id] + '</svg>'; };
  /* each rung comes with everything below it; merch from a bottle up. `no` is the card's number on the scarce three (preview values until payments) */
  var ALLIES = [
    { id: 'round', nm: 'a round', eur: 25, sub: 'Your name in the credits.', line: 'a round for the lesbians.' },
    { id: 'bottle', nm: 'a bottle', eur: 75, sub: 'Plus merch.', line: 'i just sent the lesbians a bottle.' },
    { id: 'table', nm: 'a table', eur: 250, sub: 'Plus deluxe merch.', line: "let's give these babes a table." },
    { id: 'section', nm: 'the section', eur: 500, sub: 'Plus your name in bold.', line: 'the section is on me.' },
    { id: 'cabana', nm: 'the cabana', eur: 1000, left: '20 places', no: 'cabana 07 of 20', sub: 'Plus the list for the opening, with a plus one.', line: "call the lesbians. i've got the cabana." },
    { id: 'yacht', nm: 'the yacht', eur: 5000, left: '5 places', no: 'yacht 2 of 5', sub: 'Plus a drink named after you at the opening.', line: 'lesbians need yachts too.' },
    { id: 'villa', nm: 'the villa', eur: 10000, left: 'only one', no: 'the only one', sub: 'Plus your name on the wall at the opening, and your official title: the ultimate lez breastie, famous among lesbians worldwide. A short portrait and a write-up about you on our socials.', line: 'let the lesbians know this villa is on me.', under: 'the ultimate lez breastie, famous among lesbians worldwide.' }
  ];
  var ally = function (id) { return ALLIES.filter(function (a) { return a.id === id; })[0]; };

  /* ————— the city race: bids from config.js; ties keep the plan's order, then the alphabet ————— */
  var added = function () { return S.sel && S.sel.k === 'p' ? patronItem(S.sel.id, S.sel.lvl).bids : 0; };
  var bidsOf = function (c) { return n0((D.BIDS || {})[c]) + (S.done && c === S.city ? added() : 0); };
  function racers() {
    return CITIES.slice(1).sort(function (a, b) {
      var d = bidsOf(b) - bidsOf(a); if (d) return d;
      var pa = PLAN.indexOf(a), pb = PLAN.indexOf(b);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      return a.localeCompare(b);
    });
  }
  function board() {
    var rs = racers(), max = Math.max.apply(null, rs.map(bidsOf)) + 10, list = S.all ? rs : rs.slice(0, 5);
    var row = function (c, i) {
      var on = S.city === c, plus = on && !S.done ? added() : 0, pos = i + 2, plan = PLAN.indexOf(c) + 1;
      var mv = plan ? (pos < plan ? '↑' : pos > plan ? '↓' : '') : '';
      return '<div class="brow' + (on ? ' on' : '') + '"><span class="rk">' + (pos < 10 ? '0' : '') + pos + '</span><span class="cn">' + c + '<span class="mv">' + mv + '</span></span>' +
        '<span class="bd">' + bidsOf(c) + (plus ? ' <em>+' + plus + '</em>' : '') + '</span><span class="bbar"><i style="width:' + (bidsOf(c) / max * 100) + '%"></i>' +
        (plus ? '<u style="width:' + (plus / max * 100) + '%"></u>' : '') + '</span></div>';
    };
    return '<div class="board"><div class="brow' + (S.city === 'berlin' ? ' on' : '') + '"><span class="rk">01</span><span class="cn">berlin</span><span class="bd">open first</span><span class="bbar"></span></div>' +
      list.map(row).join('') + '</div><button class="link" type="button" data-act="all">' + (S.all ? 'show fewer ←' : 'see all fourteen →') + '</button>';
  }
  function cityLine() {
    var c = S.city;
    if (!c) return '';
    if (c === 'berlin') return 'Berlin opens first.';
    if (c === 'somewhere else') return 'Your city is not in the race yet. We keep a note of it.';
    var rs = racers(), i = rs.indexOf(c);
    var j = i === 0 ? 1 : i - 1, d = Math.abs(bidsOf(c) - bidsOf(rs[j]));
    if (!d) return cap(c) + ' is level with ' + cap(rs[j]) + '.';
    if (i === 0) return cap(c) + ' is in front, ' + nb(d) + ' ahead of ' + cap(rs[1]) + '.';
    return cap(c) + ' is ' + nb(d) + ' behind ' + cap(rs[j]) + '.';
  }

  /* ————— the strip: the allies' newest gifts, running sideways (DRIVE.STRIP; the payments build feeds it — allies only, a first name only with the tick, never a patron).
     this page only draws the lines it is given ————— */
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SCARCE = { cabana: 'a cabana is gone.', yacht: 'a yacht is gone.', villa: 'the villa is gone.' };
  var ago = function (at) {
    var m = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' h' : Math.floor(m / 1440) + ' d';
  };
  var minsAgo = function (m) { return new Date(Date.now() - m * 60000).toISOString(); };
  var stripLine = function (g) {
    var first = String(g.name || '').trim().split(/\s+/)[0].toLowerCase().slice(0, 24), city = String(g.city || '').trim().toLowerCase();
    var who = first || (city ? 'someone in ' + city : 'someone');
    return '<b>' + esc(who) + ':</b> ' + esc(ally(g.rung).line) + (first && city ? ' <em>' + esc(city) + '</em>' : '');
  };
  /* ?show=strip: the mockup's eight sample lines and its villa takeover */
  var SAMPLE = [
    { name: 'ali', city: 'berlin', rung: 'table', at: 2 }, { name: '', city: 'berlin', rung: 'round', at: 4 }, { name: 'marco', city: 'berlin', rung: 'yacht', at: 11 },
    { name: '', city: 'london', rung: 'bottle', at: 14 }, { name: 'tom', city: 'london', rung: 'section', at: 20 }, { name: 'jonas', city: 'berlin', rung: 'cabana', at: 38 },
    { name: '', city: 'hamburg', rung: 'round', at: 60 }, { name: 'kemal', city: 'berlin', rung: 'bottle', at: 64 }
  ].map(function (g) { g.at = minsAgo(g.at); return g; });
  var SAMPLE_TAKE = { name: '', city: 'london', rung: 'villa', at: minsAgo(0) };
  var stripNode = null, stripT0 = Date.now(), stripTimer = 0;
  function buildStrip() {
    clearInterval(stripTimer); stripNode = null;
    var list = (SHOW === 'strip' ? SAMPLE : (D.STRIP || [])).filter(function (g) { return g && ally(g.rung); }), take = null;
    if (!list.length) return;
    if (SHOW === 'strip') take = SAMPLE_TAKE;
    else if (SCARCE[list[0].rung] && Date.now() - new Date(list[0].at).getTime() < 864e5) take = list[0];
    if (REDUCED) { list = list.slice(0, 3); take = null; }
    var set = function (hide) {
      return list.map(function (g) {
        return '<span class="it"' + (hide ? ' aria-hidden="true"' : '') + '><i>' + svg(g.rung) + '</i><span>' + stripLine(g) + '</span><em>' + ago(g.at) + '</em></span><span class="star" aria-hidden="true">✦</span>';
      }).join('');
    };
    var el = document.createElement('div');
    el.className = 'stripw' + (REDUCED ? ' still' : '');
    el.innerHTML = '<div class="strip" role="region" aria-label="the newest gifts"><div class="lane">' + set(false) + (REDUCED ? '' : set(true)) + '</div>' +
      (take ? '<div class="take" aria-hidden="true"><i>' + svg(take.rung) + '</i><p><b>' + SCARCE[take.rung] + '</b> ' + stripLine(take) + '</p></div>' : '') + '</div>';
    stripNode = el; el._set = set;
    /* the red takeover: a scarce newest line under a day old, 3.4 s, never more than once in 45 s */
    var tk = $('.take', el);
    if (tk) {
      var run = function () { tk.classList.add('on'); setTimeout(function () { tk.classList.remove('on'); }, 3400); };
      setTimeout(run, 6000);
      stripTimer = setInterval(run, 45000);
    }
  }
  /* put the one strip node into the page; the loop carries on from where it was, and a short list is repeated until it fills the width */
  function placeStrip(slot) {
    if (!stripNode || !slot) return;
    slot.appendChild(stripNode);
    var lane = $('.lane', stripNode), box = $('.strip', stripNode);
    if (REDUCED) return;
    var star = $('.star', lane), w = star.offsetLeft + star.offsetWidth + 34;
    if (!stripNode.dataset.fit && w > 40 && w < box.clientWidth) {
      stripNode.dataset.fit = '1';
      var reps = Math.ceil(box.clientWidth / w), rep = function (hide) { return new Array(reps + 1).join(stripNode._set(hide)); };
      lane.innerHTML = rep(false) + rep(true);
    }
    lane.style.animationDelay = '-' + (((Date.now() - stripT0) / 1000) % 38).toFixed(2) + 's';
  }

  /* ————— the sections ————— */
  var head = function (n, k, t) { return '<span class="num">' + n + '</span><span class="k">' + k + '</span>' + (t ? '<h3>' + t + '</h3>' : ''); };
  function counter() {
    if (n0(D.RAISED) > 0) return '<span class="count"><b>' + eur(n0(D.RAISED)) + '</b> from <b>' + n0(D.SUPPORTERS).toLocaleString('en-US') + '</b> supporters so far</span>';
    return PICK ? '' : '<span class="count">paying opens soon.</span>';
  }
  function secDrive() {
    return '<section class="ds hero"><div>' + head('01', 'the drive') + "<h2>surr is coming.<br>let's do this together.</h2></div>" +
      "<div><p class=\"body\">surr opens one city at a time, starting in Berlin. Be a supporter and you are with us from the start. You get better prices, your name in the credits, bids that help us choose the next city, and a few things we won't offer again.</p>" + counter() + '</div>' +
      '<div class="know"><div><span class="k">who can be a supporter</span><p class="fine">Anyone. You don\'t have to be gay! If you won\'t be on the app, support your local lesbian is for you.</p></div>' +
      '<div><span class="k">what bids do</span><p class="fine">They show us where surr is wanted. They do not promise a city or a date.</p></div>' +
      "<div><span class=\"k\">getting in</span><p class=\"fine\">Patrons don't skip the checks. Everyone applies the same way, so we know every account is real. No cis men.</p></div></div></section>";
  }
  function secPatrons() {
    /* the allies' door on desktop: section 02 is a slim bar until the pill opens it */
    if (DOOR && S.slim && deskMQ.matches) return '<section class="ds slim"><h3>become a patron.</h3><button class="up" type="button" data-act="patrons">↑ patrons</button></section>';
    var p = P(), tag = PICK ? 'button' : 'div';
    var on = function (id, lvl) { return !!(S.sel && S.sel.k === 'p' && S.sel.id === id && (S.sel.lvl || '') === (lvl || '')); };
    var cell = function (id, lvl) {
      var it = patronItem(id, lvl);
      return '<' + tag + ' class="pc"' + (PICK ? ' type="button" data-tier="' + id + '" data-lvl="' + lvl + '" aria-pressed="' + on(id, lvl) + '" aria-label="' + it.nm + ', ' + it.price + '"' : '') + '><span class="p">' + it.price + '</span></' + tag + '>';
    };
    var rows = LENGTHS.map(function (t) {
      return '<div class="mrow' + (t.hero ? ' hero' : '') + '"><span class="nm">' + t.nm + '</span><span class="b">' + nb(t.bids) + '</span>' + cell(t.id, 'list') + cell(t.id, 'back') +
        (t.hero ? '<span class="left">' + lifeInfo().left + '</span>' : '') +
        (t.hero ? '<span class="sub">List for as long as surr exists, with backstage for the first three years. Backstage for life keeps backstage for good. Either way: a place on the guest list for the opening, with a plus one, the first drinks on us, and the tank.</span>' : '') +
        '<small>' + lengthNote(t.id) + '</small></div>';
    }).join('');
    var wk = on('weekend', '');
    var weekend = '<' + tag + ' class="row"' + (PICK ? ' type="button" data-tier="weekend" data-lvl="" aria-pressed="' + wk + '"' : '') + '>' +
      '<span class="nm">the weekend</span><span class="b">10 bids</span><span class="p">' + eur(WEEKEND) + '</span>' +
      '<span class="sub">Backstage for life, and a place at the house: a weekend outside Berlin with sixteen of us, a cook and a lake.<small>Twelve places. Four more for friends, at ' + eur(WEEKEND_FRIEND) + '.</small></span></' + tag + '>';
    var where = '<label class="where"><span class="k">prices for</span><select class="field" id="pcountry" name="country">' +
      COUNTRIES.map(function (c) { return '<option value="' + c + '"' + (S.country === c ? ' selected' : '') + '>' + c + ' · ' + SETS[countrySet(c)].sym + '</option>'; }).join('') + '</select></label>';
    return '<section class="ds"><div>' + head('02', "for the ones who'll be on the app", 'become a patron.') +
      '<span class="k">every patron gets</span><ul class="gets"><li>your username, before anyone else</li><li>thirteen invite codes</li><li>your name in the credits</li><li>the patron mark on your profile, with your number</li></ul></div>' +
      '<div>' + where + '<dl class="key"><dt>list</dt><dd>Your annual pass to surr, for as many years as you choose.</dd><dt>backstage</dt><dd>List, plus our extras: special features, monthly gifts like bumps and layovers, and IRL privileges at our nights and partner events.</dd></dl>' +
      '<div class="pmenu' + (PICK ? ' pick' : '') + '"><div class="mhead"><span></span><span></span><b>list</b><b>backstage</b></div>' + rows + '</div>' +
      '<div class="rows' + (PICK ? ' pick' : '') + '">' + weekend + '</div>' +
      '<p class="fine">Bids show us where you want surr next. See the city race below.</p></div>' +
      '<div class="soli" style="grid-column:1/-1"><b>soli</b><span class="p">' + money(p.sym, p.soli) + ' a year</span><p class="fine">For the ones it\'s for. Tickets are released in batches, and a person reads every ask.</p><button class="link" type="button" data-act="ask">ask →</button></div></section>';
  }
  function secAllies() {
    var tag = PICK ? 'button' : 'div';
    var rows = ALLIES.map(function (a) {
      var on = !!(S.sel && S.sel.k === 'a' && S.sel.id === a.id);
      return '<' + tag + ' class="arow' + (a.id === 'villa' ? ' top' : '') + '"' + (PICK ? ' type="button" data-ally="' + a.id + '" aria-pressed="' + on + '"' : '') + '>' +
        '<i>' + svg(a.id) + '</i><span class="nm">' + a.nm + '</span><span class="b">' + eur(a.eur) + '</span><span class="sub">' + a.sub + '</span><span class="left">' + (a.left || '') + '</span></' + tag + '>';
    }).join('');
    var own = !!(S.sel && S.sel.k === 'a' && S.sel.id === 'own');
    rows += '<' + tag + ' class="arow own"' + (PICK ? ' type="button" data-ally="own" aria-pressed="' + own + '"' : '') + '><i></i><span class="nm">your amount</span><span class="b"></span></' + tag + '>';
    var ph = !deskMQ.matches;
    return '<section class="ds allies">' + (ph ? '' : '<div class="stripw-slot" data-strip></div>') + (DOOR && ph ? '<button class="up" type="button" data-act="patrons">↑ patrons</button>' : '') +
      '<div>' + head('03', 'friends, family and allies', 'support your local lesbian.') +
      '<p class="body">Not here to date? You can still be part of it. Your name goes in the credits.</p></div>' +
      '<div><span class="k">Each one comes with everything above it.</span><div class="arows' + (PICK ? ' pick' : '') + '">' + rows + '</div>' +
      '<p class="fine gift">You can also give a friend a year, three years, for life, or backstage for life. She still applies like everyone else.</p></div></section>';
  }
  function secPieces() {
    var pc = D.PIECES || {}, maker = String(D.RING_MAKER || '').trim();
    return '<section class="ds"><div>' + head('04', 'the pieces', 'made once.') + '<p class="body">Two things from the first season, numbered.</p></div>' +
      '<div><div class="rows"><div class="piece"><span class="nm">the tank</span><span class="p">' + eur(n0(pc.tank)) + '</span><span class="sub">Yours with for life and above.</span></div>' +
      '<div class="piece"><span class="nm">the ring</span><span class="p">' + eur(n0(pc.ring)) + '</span><span class="sub">A real mood ring, numbered. Made once' + (maker ? ', with ' + esc(maker) : '') + '.</span></div></div></div></section>';
  }
  function secRace() {
    return '<section class="ds"><div>' + head('05', 'the city race', 'berlin first. then where?') +
      '<p class="body">Bids show us where surr is wanted. They help us choose the next city. They are not a promise.</p>' +
      '<p class="order">our plan today, and it can change: berlin → amsterdam → barcelona → london → paris → new york</p></div><div>' + board() + '</div></section>';
  }
  function secList(phone) {
    return '<section class="ds"><div>' + head('06', 'the list', 'not today?') + '</div><div><p class="body">Leave your email and city. We\'ll send you a code when there\'s room.</p><div data-form></div>' +
      (phone ? '<footer class="sfoot"><a href="/press/">press</a><a href="/support/">support</a><a href="/imprint/">imprint</a><a href="/privacy/">privacy</a><a href="/deal/">the deal</a></footer>' : '') + '</div></section>';
  }

  /* ————— the pay bar ————— */
  function picked() { return S.sel ? (S.sel.k === 'p' ? patronItem(S.sel.id, S.sel.lvl) : ally(S.sel.id)) : null; }
  function payLabel() {
    var t = picked();
    if (S.sel.k === 'p') return 'become a patron · ' + t.price + ' →';
    if (S.sel.id === 'own') return n0(S.amount) ? 'give ' + eur(n0(S.amount)) + ' →' : 'give →';
    return 'give ' + eur(t.eur) + ' →';
  }
  function payBar() {
    if (!S.sel || S.done) return '';
    var t = picked();
    if (S.sel.k === 'a') {
      var own = S.sel.id === 'own';
      return '<div class="pay' + (own ? ' three' : '') + '"><div class="sum mono"><span>' + (own ? 'your amount' : t.nm) + ' · support your local lesbian</span><button type="button" data-act="clear">× clear</button></div>' +
        '<label class="sr" for="pname">your name, for the credits</label><input class="field" id="pname" name="name" type="text" autocomplete="name" placeholder="your name, for the credits">' +
        '<label class="sr" for="pemail">email</label><input class="field" id="pemail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
        (own ? '<label class="sr" for="pamount">amount in €</label><input class="field" id="pamount" name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="amount in €" value="' + esc(S.amount) + '">' : '') +
        '<label class="tick"><input type="checkbox" id="pshow" name="showname"' + (S.showName ? ' checked' : '') + '><span>show my first name on the page</span></label>' +
        '<button class="go solid" type="button" data-act="pay"' + (own && !n0(S.amount) ? ' disabled' : '') + '>' + payLabel() + '</button>' +
        '<p class="fine">This is support. It does not give you a place in the app.</p></div>';
    }
    var forCity = S.city && S.city !== 'somewhere else' ? ' for ' + S.city : '';
    return '<div class="pay"><div class="sum mono"><span>' + t.nm + ' · ' + nb(t.bids) + forCity + '</span><button type="button" data-act="clear">× clear</button></div>' +
      '<label class="sr" for="pcity">your city</label><select class="field' + (S.city ? '' : ' empty') + '" id="pcity" name="city"><option value="">your city</option>' +
      CITIES.concat('somewhere else').map(function (c) { return '<option' + (S.city === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
      '<label class="sr" for="pemail">email</label><input class="field" id="pemail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
      '<button class="go solid" type="button" data-act="pay"' + (S.city ? '' : ' disabled') + '>' + payLabel() + '</button>' +
      '<p class="fine">Next, you apply like everyone else. We check every account, patrons too.</p></div>';
  }

  /* ————— after paying ————— */
  function after() {
    var t = picked();
    if (S.sel.k === 'a') {
      var own = S.sel.id === 'own', merch = !own && ALLIES.indexOf(t) >= 1;
      return '<div class="after"><span class="k">done</span><div class="big">thank you.</div><div class="mk"><span>' + (own ? eur(n0(S.amount)) : t.nm) + '</span><i>·</i><span>support your local lesbian</span></div>' +
        '<ul class="next"><li><b>Your name goes in the credits</b>, the way you typed it.</li>' + (merch ? "<li><b>Your merch.</b> We'll email you for a size and an address.</li>" : '') + '<li>Your receipt is in your email.</li></ul>' +
        (own ? '' : '<div class="card"><canvas width="1080" height="1080" aria-label="' + esc(t.line) + '"></canvas><div class="btns">' +
          (deskMQ.matches ? '<button class="go" type="button" data-act="save-story">save the story ↓</button><button class="go" type="button" data-act="save-square">save the square ↓</button>'
            : '<button class="go" type="button" data-act="share">share it →</button>') + '<button class="go" type="button" data-act="copy">copy the link</button></div></div>') +
        '<button class="link" type="button" data-act="back">← back to the drive</button></div>';
    }
    var race = S.city && S.city !== 'somewhere else';
    return '<div class="after"><span class="k">done</span><div class="big">you\'re a patron.</div><div class="mk"><span>patron · 041</span><i>·</i><span>' + t.nm + '</span><i>·</i><span>' + (race ? nb(t.bids) + ' for ' + S.city : S.city) + '</span></div>' +
      '<p class="body">' + cityLine() + '</p>' +
      '<ul class="next"><li><b>Next: apply.</b> Everyone goes through the same checks, patrons too. Use this same email so we can match you.</li>' +
      '<li><b>Your years wait for your city.</b> They start the day surr opens there. Until then, you can use surr in Berlin.</li>' +
      '<li><b>Your thirteen invite codes</b> arrive on opening day.</li></ul>' +
      '<button class="link" type="button" data-act="back">← back to the drive</button></div>';
  }

  /* pay(): the payments brief replaces this one function with the real checkout. until then it only shows the after-screen — nothing is charged or sent. */
  function pay() {
    if (!S.sel || (S.sel.k === 'p' && !S.city) || (S.sel.id === 'own' && !n0(S.amount))) return;
    var v = function (id) { var i = $('#' + id); return i ? i.value.trim() : ''; };
    S.form = { name: v('pname'), email: v('pemail'), showName: S.showName };
    S.done = true;
    render(true);
  }

  /* ————— the soli sheet ————— */
  function sheetHTML() {
    var p = P();
    return '<div class="in"><button class="x" type="button" data-act="close-sheet">× close</button><h3>soli · ' + money(p.sym, p.soli) + ' a year.</h3>' +
      "<p class=\"body\">It's for the ones it's for. There's a number of them each year, and a person reads every ask.</p>" +
      (S.sent ? '<p class="sent" role="status">asked. batches go out monthly.</p>' :
        '<label class="k" for="swhy">why soli?</label><input class="field" id="swhy" name="why" type="text" maxlength="140" autocomplete="off" placeholder="one line">' +
        '<label class="k" for="slink">a link, if you like.</label><input class="field" id="slink" name="link" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="your instagram, your work, anything that\'s you">' +
        "<p class=\"fine\">Soli tickets are released in batches. Yours comes by email when it's your turn.</p>" +
        '<label class="sr" for="semail">email</label><input class="field" id="semail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
        '<button class="go" type="button" data-act="send"' + (PREVIEW ? '' : ' disabled') + '>send →</button>') + '</div>';
  }
  var sheet = $('#sheet'), sheetFrom = null;
  function drawSheet() {
    sheet.hidden = !S.sheet;
    sheet.innerHTML = S.sheet ? sheetHTML() : '';
  }
  function openSheet(from) {
    sheetFrom = from || null; S.sheet = true; S.sent = false; drawSheet();
    var f = $('input, button.x', sheet); if (f) f.focus({ preventScroll: true });
  }
  function closeSheet() {
    S.sheet = false; drawSheet();
    if (sheetFrom && document.contains(sheetFrom)) sheetFrom.focus({ preventScroll: true });
  }
  /* sendAsk(): sending the ask waits for the door's own plan (the soli pile on the desk). until then it only shows the sent state, in the preview. */
  function sendAsk() {
    if (!PREVIEW) return;
    S.sent = true; drawSheet();
    var x = $('.x', sheet); if (x) x.focus({ preventScroll: true });
  }
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

  /* ————— the list form: the site's own join_waitlist call, email and city only on this page ————— */
  function patience() {
    if (!window.AbortController) return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, 15000);
    return c.signal;
  }
  var listNode = (function () {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<form class="list" novalidate>' +
      '<label class="sr" for="dem">email</label><input id="dem" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
      '<label class="sr" for="dci">city</label><input id="dci" name="city" type="text" autocomplete="address-level2" placeholder="city">' +
      '<button class="go" type="submit">put me on the list →</button>' +
      '<p class="err" role="status" aria-live="polite" hidden></p></form>';
    var form = wrap.firstChild, btn = $('button', form), err = $('.err', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var email = form.email.value.trim().toLowerCase(), city = form.city.value.trim();
      btn.disabled = true; btn.textContent = 'sending…'; err.hidden = true;
      fetch(C.SUPABASE_URL + '/rest/v1/rpc/join_waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY },
        body: JSON.stringify({ p_email: email, p_city: city, p_link: null }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: patience()
      }).then(function (r) {
        if (r.ok) return null;
        return r.json().catch(function () { return {}; }).then(function (j) { return j || {}; });
      }).then(function (j) {
        if (!j) {
          var ok = document.createElement('p');
          ok.className = 'done'; ok.setAttribute('role', 'status');
          ok.textContent = "We'll email you a code when there's room. Speed things up by asking around, every member has three.";
          form.replaceWith(ok);
          listNode = ok;
          hintAll();
          return;
        }
        /* the function's own refusals ("that's not an email", "which city?") come back as they are, with a capital */
        var m = j.code === '22023' && j.message ? j.message : '';
        fail(m ? m.charAt(0).toUpperCase() + m.slice(1) : "That didn't go through. Try again in a moment.");
      }).catch(function () { fail("That didn't go through. Try again in a moment."); });
    });
    function fail(msg) {
      btn.disabled = false; btn.textContent = 'put me on the list →';
      err.textContent = msg; err.hidden = false;
      hintAll();
    }
    return form;
  })();

  /* ————— the scroll hint: the site's fade and ↓ more, gone at the end or when nothing scrolls ————— */
  var hints = [], ro = window.ResizeObserver ? new ResizeObserver(function () { hintAll(); }) : null;
  function hintAll() { hints.forEach(function (f) { f(); }); }
  function watchHints(root) {
    hints = []; if (ro) ro.disconnect();
    $$('.scrollwrap', root).forEach(function (w) {
      var el = $('.scroll', w);
      var upd = function () { w.classList.toggle('end', el.scrollHeight - el.clientHeight <= el.scrollTop + 2); };
      el.addEventListener('scroll', upd, { passive: true });
      if (ro) ro.observe(el);
      hints.push(upd); upd();
    });
  }

  /* ————— the phone: one screen per section, the marks on the right (the site's snap, from site.js) ————— */
  var dsnap = $('#dsnap'), dticks = $('#dticks'), shown = -1;
  function vh() { document.documentElement.style.setProperty('--vh', (innerHeight / 100) + 'px'); }
  vh(); addEventListener('resize', vh);
  function mark() {
    var n = Math.round(dsnap.scrollTop / (dsnap.clientHeight || 1));
    if (n === shown) return;
    shown = n;
    $$('i', dticks).forEach(function (t, i) { t.classList.toggle('on', i === n); });
  }
  var ticking = false;
  dsnap.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; mark(); });
  }, { passive: true });

  /* ————— render: the whole page from the state; the scroll positions and the list form survive ————— */
  var lastKey = '';
  /* the door opens on 03: desktop, the slim bar at the top of the box (01 stays above); phone, the snap on the 03 screen */
  var atDoor = DOOR;
  function toDoor(desk, inner) {
    if (desk) { var sl = $('.ds.slim', inner); if (sl) inner.scrollTop = sl.getBoundingClientRect().top - inner.getBoundingClientRect().top + inner.scrollTop; }
    else inner.scrollTop = 2 * inner.clientHeight;
  }
  function openPatrons() {
    atDoor = false; S.slim = false;
    if (deskMQ.matches) {
      render();
      var inner = $('#dscroll'), sec = inner.children[1];
      if (sec) { inner.scrollTop = sec.getBoundingClientRect().top - inner.getBoundingClientRect().top + inner.scrollTop; var h = $('h3', sec); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    } else dsnap.scrollTop = dsnap.clientHeight;
  }
  function render(reset) {
    var fa = document.activeElement, fsel = '';
    if (fa && fa.dataset) {
      if (fa.dataset.tier != null) fsel = '[data-tier="' + fa.dataset.tier + '"][data-lvl="' + (fa.dataset.lvl || '') + '"]';
      else if (fa.dataset.ally) fsel = '[data-ally="' + fa.dataset.ally + '"]';
      else if (fa.dataset.act) fsel = '[data-act="' + fa.dataset.act + '"]';
    }
    var desk = deskMQ.matches, key = (desk ? 'd' : 'p') + (S.done ? 1 : 0);
    var keep = !reset && key === lastKey;
    lastKey = key;
    var inner = desk ? $('#dscroll') : dsnap;
    var tops = keep ? [inner.scrollTop].concat($$('.scroll', inner).map(function (s) { return s.scrollTop; })) : null;
    var parts = S.done ? [after()] : [secDrive(), secPatrons(), secAllies(), secPieces(), secRace(), secList(!desk)];
    if (desk) {
      inner.innerHTML = parts.join('');
      dsnap.innerHTML = '';
    } else {
      inner.innerHTML = parts.map(function (h, i) {
        /* each screen scrolls on its own: a keyboard can reach it, a screen reader can name it */
        return '<section class="dscreen"><div class="scrollwrap"><div class="scroll" tabindex="0" role="region" aria-label="' + (i + 1) + ' of ' + parts.length + '">' + h + '</div><div class="fade"></div><span class="more" aria-hidden="true">↓ more</span></div></section>';
      }).join('');
      $('#dscroll').innerHTML = '';
      dticks.innerHTML = parts.length > 1 ? parts.map(function () { return '<i></i>'; }).join('') : '';
      shown = -1;
    }
    var slot = $('[data-form]', inner); if (slot) slot.replaceWith(listNode);
    /* the strip: across the top of 03 on desktop; pinned along the bottom of the 03 screen on the phone */
    if (!S.done) {
      if (desk) placeStrip($('[data-strip]', inner));
      else if (stripNode) { var scr = $$('.dscreen', inner)[2]; if (scr) placeStrip(scr); }
    }
    var typed = {}; $$('.pay input').forEach(function (i) { if (i.id !== 'pamount' && i.type !== 'checkbox') typed[i.id] = i.value; });
    var bar = payBar();
    $('#dpay').innerHTML = desk ? bar : '';
    $('#ppay').innerHTML = desk ? '' : bar;
    $('#pdoor').hidden = !!bar;
    $('.dphone').classList.toggle('paying', !!bar);
    Object.keys(typed).forEach(function (id) { var i = $('#' + id); if (i) i.value = typed[id]; });
    if (tops) { inner.scrollTop = tops[0]; $$('.scroll', inner).forEach(function (s, i) { if (tops[i + 1] != null) s.scrollTop = tops[i + 1]; }); }
    else inner.scrollTop = 0;
    if (reset && atDoor && !S.done) toDoor(desk, inner);
    watchHints(desk ? $('#desk') : $('.dphone'));
    if (!desk) mark();
    var cv = $('.card canvas', inner); if (cv) card(cv);
    /* keep the keyboard where it was: the same control, or the pay bar's first field, or the top of the box */
    if (fsel) {
      var root = desk ? $('#desk') : $('.dphone');
      var back = $(fsel, root) || (bar && $('.pay .field, .pay button', root)) || $('.after .k, .ds .num', inner);
      if (back) { if (!back.matches('button, a, input, select')) back.setAttribute('tabindex', '-1'); back.focus({ preventScroll: true }); }
    }
    drawSheet();
  }

  /* ————— the allies' share picture (look a · the symbol): story 1080 × 1920, square 1080 × 1080, the site's own fonts ————— */
  var INK = '#E8E8E8', DIM = '#BBBBBB', LINE = '#333333', BG = '#050505', RED = '#DE0A26';
  var FONTS = ['800 60px surr-display', '700 40px surr-head', '400 40px surr-text', '400 40px surr-mono'];
  var pics = {};
  function symbolOps(id) {
    var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + SYM[id] + '</svg>', 'image/svg+xml');
    var ops = [];
    (function walk(el, tf) {
      Array.prototype.forEach.call(el.children, function (c) {
        var t = tf, m = /rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/.exec(c.getAttribute('transform') || '');
        if (m) t = tf.concat([[+m[1], +m[2], +m[3]]]);
        if (c.tagName === 'g') walk(c, t);
        else ops.push({ el: c, tf: t, cls: c.getAttribute('class') || '', occ: /fill:var\(--bg\)/.test(c.getAttribute('style') || '') });
      });
    })(doc.documentElement, []);
    return ops;
  }
  function drawSymbol(ctx, id, x, y, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = 0.75; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    symbolOps(id).forEach(function (o) {
      ctx.save();
      o.tf.forEach(function (r) { ctx.translate(r[1], r[2]); ctx.rotate(r[0] * Math.PI / 180); ctx.translate(-r[1], -r[2]); });
      var path = new Path2D(), e = o.el;
      if (e.tagName === 'circle') path.arc(+e.getAttribute('cx'), +e.getAttribute('cy'), +e.getAttribute('r'), 0, Math.PI * 2);
      else path.addPath(new Path2D(e.getAttribute('d')));
      if (/\brf\b/.test(o.cls)) { ctx.fillStyle = RED; ctx.fill(path); }
      else {
        if (o.occ) { ctx.fillStyle = BG; ctx.fill(path); }
        ctx.strokeStyle = /\br\b/.test(o.cls) ? RED : INK; ctx.stroke(path);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  function font(ctx, f, px, track) {
    ctx.font = f.replace(/\d+px/, px + 'px');
    if ('letterSpacing' in ctx) ctx.letterSpacing = (track || 0) * px + 'px';
  }
  /* the headline wraps balanced, like text-wrap: balance */
  function wrap(ctx, text, width) {
    var words = text.split(' ');
    var lines = function (w) {
      var out = [], cur = '';
      words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > w) { out.push(cur); cur = wd; } else cur = t; });
      if (cur) out.push(cur);
      return out;
    };
    var best = lines(width), lo = width / 2, hi = width;
    for (var i = 0; i < 14; i++) { var mid = (lo + hi) / 2; if (lines(mid).length > best.length) lo = mid; else hi = mid; }
    return lines(hi);
  }
  function drawCard(cv, a, square) {
    var W = 1080, H = square ? 1080 : 1920, u = W / 100, ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    var pad = square ? 6 * u : 8 * u, padB = square ? 6 * u : 7 * u, inner = W - 2 * pad;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    /* top: surr left, the number on the scarce three right */
    var mk = 6 * u;
    font(ctx, FONTS[0], mk, -0.04); ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText('surr', pad, pad + mk * 0.8);
    if (a.no) { font(ctx, FONTS[3], 3.6 * u, 0); ctx.fillStyle = DIM; ctx.textAlign = 'right'; ctx.fillText(a.no, W - pad, pad + mk * 0.8); }
    /* bottom: the rule, support your local lesbian · surr.gay */
    var tag = (square ? 3.8 : 4.6) * u, footBase = H - padB - tag * 0.3, ruleY = footBase - tag * 0.95 - 3.4 * u;
    ctx.fillStyle = LINE; ctx.fillRect(pad, Math.round(ruleY), inner, 2);
    font(ctx, FONTS[1], tag, -0.01); ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText('support your local lesbian', pad, footBase);
    font(ctx, FONTS[3], 3.6 * u, 0.02); ctx.fillStyle = DIM; ctx.textAlign = 'right'; ctx.fillText('surr.gay', W - pad, footBase);
    /* the words above the rule */
    var hs = (square ? 8.5 : 11) * u, ss = (square ? 3.6 : 4.4) * u, sGap = (square ? 2 : 3) * u, txtB = ruleY - (square ? 4 : 7) * u;
    font(ctx, FONTS[2], ss, 0); var sLines = wrap(ctx, a.under || 'surr is opening in berlin.', inner);
    font(ctx, FONTS[0], hs, -0.035); var hLines = wrap(ctx, a.line, inner);
    var sTop = txtB - sLines.length * ss * 1.3, hTop = sTop - sGap - hLines.length * hs * 0.95;
    ctx.fillStyle = INK; ctx.textAlign = 'left';
    hLines.forEach(function (l, i) { ctx.fillText(l, pad, hTop + (i + 1) * hs * 0.95 - hs * 0.17); });
    font(ctx, FONTS[2], ss, 0); ctx.fillStyle = DIM;
    sLines.forEach(function (l, i) { ctx.fillText(l, pad, sTop + (i + 1) * ss * 1.3 - ss * 0.35); });
    /* the symbol, large, in the space between */
    var top = pad + mk, room = hTop - top, size = Math.min((square ? 40 : 62) * u, room * 0.92);
    drawSymbol(ctx, a.id, (W - size) / 2, top + (room - size) / 2, size);
  }
  function card(cv) {
    var a = picked(); if (!a || !a.line) return;
    var go = function () {
      drawCard(cv, a, true);
      var story = document.createElement('canvas'); drawCard(story, a, false);
      pics = { id: a.id };
      if (story.toBlob) {
        story.toBlob(function (b) { pics.story = b; }, 'image/png');
        cv.toBlob(function (b) { pics.square = b; }, 'image/png');
      }
    };
    var ready = document.fonts && document.fonts.load ? Promise.all(FONTS.map(function (f) { return document.fonts.load(f, 'surr €'); })) : Promise.resolve();
    ready.then(go, go);
  }
  function save(blob, name) {
    if (!blob) return;
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* share it →: the phone's share sheet with the story picture; a phone that cannot share a file saves it instead */
  function share() {
    if (!pics.story) return;
    var name = 'surr-' + pics.id + '.png';
    try {
      var file = new File([pics.story], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file], url: DOORLINK })) { navigator.share({ files: [file], url: DOORLINK }).catch(function () {}); return; }
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(function () {}); return; }
    } catch (e) { /* no File constructor: save instead */ }
    save(pics.story, name);
  }

  /* copy the link: the plain surr.gay/allies, the same for everyone; it goes out only when she chooses to share it */
  function copyLink(btn) {
    var done = function () {
      btn.textContent = 'copied';
      setTimeout(function () { if (btn.isConnected) btn.textContent = 'copy the link'; }, 2000);
    };
    var old = function () {
      var t = document.createElement('textarea');
      t.value = DOORLINK; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* nothing to do */ }
      t.remove(); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(DOORLINK).then(done, old); else old();
  }

  /* ————— taps ————— */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tier],[data-ally],[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.tier) {
      var lv = b.dataset.lvl || '';
      S.sel = S.sel && S.sel.k === 'p' && S.sel.id === b.dataset.tier && (S.sel.lvl || '') === lv ? null : { k: 'p', id: b.dataset.tier, lvl: lv };
      render(); return;
    }
    if (b.dataset.ally) { S.sel = S.sel && S.sel.k === 'a' && S.sel.id === b.dataset.ally ? null : { k: 'a', id: b.dataset.ally }; render(); return; }
    switch (b.dataset.act) {
      case 'clear': S.sel = null; render(); break;
      case 'pay': pay(); break;
      case 'all': S.all = !S.all; render(); break;
      case 'back': S.sel = null; S.city = ''; S.done = false; S.amount = ''; S.showName = false; S.form = null; render(true); break;
      case 'ask': openSheet(b); break;
      case 'close-sheet': closeSheet(); break;
      case 'send': sendAsk(); break;
      case 'share': share(); break;
      case 'copy': copyLink(b); break;
      case 'patrons': openPatrons(); break;
      case 'save-story': save(pics.story, 'surr-' + pics.id + '-story.png'); break;
      case 'save-square': save(pics.square, 'surr-' + pics.id + '-square.png'); break;
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'pcountry') { S.country = e.target.value; S.set = countrySet(S.country); render(); var pc = $('#pcountry'); if (pc) pc.focus({ preventScroll: true }); return; }
    if (e.target.id === 'pcity') { S.city = e.target.value; render(); var c = $('#pcity'); if (c) c.focus({ preventScroll: true }); }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'pshow') S.showName = e.target.checked; });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'pamount') {
      S.amount = e.target.value.replace(/[^\d]/g, '');
      if (e.target.value !== S.amount) e.target.value = S.amount;
      var go = $('[data-act="pay"]'); if (go) { go.textContent = payLabel(); go.disabled = !n0(S.amount); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.sheet) closeSheet();
    /* the sheet holds the keyboard while it is open */
    if (e.key === 'Tab' && S.sheet) {
      var f = $$('button:not([disabled]), input', sheet); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  document.body.classList.toggle('is-desk', deskMQ.matches);
  var onView = function () { document.body.classList.toggle('is-desk', deskMQ.matches); buildStrip(); render(true); };
  if (deskMQ.addEventListener) deskMQ.addEventListener('change', onView); else if (deskMQ.addListener) deskMQ.addListener(onView);

  buildStrip();
  render(true);
  if (S.sheet) openSheet(null);
  /* the strip and giving previews on the phone open on the 03 screen */
  if ((SHOW === 'strip' || SHOW === 'giving') && !deskMQ.matches) { dsnap.scrollTop = 2 * dsnap.clientHeight; mark(); }
  /* the paying preview on the phone opens on the patron screen, at the picked price */
  if (SHOW === 'paying' && !deskMQ.matches) {
    dsnap.scrollTop = dsnap.clientHeight;
    var pc = $('.dscreen .pc[aria-pressed="true"]'), sc = pc && pc.closest('.scroll');
    if (sc) sc.scrollTop = Math.max(0, pc.getBoundingClientRect().top - sc.getBoundingClientRect().top - 120);
    mark();
  }
})();
