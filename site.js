/* surr — getsurr.com. the band, the branches, the snap phone, the list form, the radio.
   no storage, no analytics; the only calls out are the form (Supabase) and, after its own tap, the radio (SoundCloud). */
(function () {
  'use strict';
  var C = window.SURR || {};
  var BASE = C.BASE || '/';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var deskMQ = matchMedia('(min-width: 721px)');
  var smooth = still ? 'auto' : 'smooth';

  var TITLES = { surr: 'surr', rings: 'mood rings · surr', map: 'map · surr', nights: 'nights · surr', list: 'the list · surr' };
  var SLUGS = { rings: 'rings/', map: 'map/', nights: 'nights/', list: 'list/' };

  /* which branch the address asks for: '' | rings | map | nights | list | beta */
  function route() {
    var p = location.pathname;
    if (p.indexOf(BASE) !== 0) return '';
    p = p.slice(BASE.length).replace(/(^|\/)index\.html$/, '').replace(/\/$/, '');
    if (p === 'drive') return 'list';
    return ['rings', 'map', 'nights', 'list', 'beta'].indexOf(p) >= 0 ? p : '';
  }
  var START = route();
  var DEEP = document.documentElement.className.indexOf('deep') >= 0;

  function setAddress(path, title) {
    try { history.replaceState(null, '', BASE + path); } catch (e) { /* file:// or sandbox */ }
    document.title = title;
  }

  /* ————— shared: the next-night line ————— */
  var N = C.NEXT_NIGHT;
  $$('[data-night]').forEach(function (el) {
    if (!N) { el.remove(); return; }
    el.outerHTML =
      '<div class="mono ev"><svg aria-hidden="true"><use href="#cal"/></svg><span>' + N.city + '</span><span>·</span><span>' + N.date +
      '</span><span>·</span><a href="' + N.link + '" target="_blank" rel="noopener">' + N.name + '</a></div>' +
      (N.offer ? '<div class="mono offer">' + N.offer + '</div>' : '');
  });

  /* ————— shared: open in testflight ————— */
  $$('[data-app]').forEach(function (a) {
    if (C.APP_URL) { a.href = C.APP_URL; a.hidden = false; }
  });

  /* ————— shared: the list form ————— */
  var formN = 0;
  $$('[data-form]').forEach(function (slot) {
    var n = ++formN;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<form class="list" novalidate>' +
      '<label class="sr" for="em' + n + '">email</label><input id="em' + n + '" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
      '<label class="sr" for="ci' + n + '">city</label><input id="ci' + n + '" name="city" type="text" autocomplete="address-level2" placeholder="city">' +
      '<label class="sr" for="li' + n + '">instagram or a link, optional</label><input id="li' + n + '" name="link" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="instagram or a link, optional">' +
      '<button class="go" type="submit">put me on the list →</button>' +
      '<p class="err" role="status" aria-live="polite" hidden></p></form>';
    var form = wrap.firstChild, btn = $('button', form), err = $('.err', form);
    slot.replaceWith(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var email = form.email.value.trim().toLowerCase(), city = form.city.value.trim(), link = form.link.value.trim() || null;
      btn.disabled = true; btn.textContent = 'sending…'; err.hidden = true;
      fetch(C.SUPABASE_URL + '/rest/v1/rpc/join_waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY },
        body: JSON.stringify({ p_email: email, p_city: city, p_link: link }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      }).then(function (r) {
        if (r.ok) return null;
        return r.json().catch(function () { return {}; }).then(function (j) { return j || {}; });
      }).then(function (j) {
        if (!j) {
          var ok = document.createElement('p');
          ok.className = 'done'; ok.setAttribute('role', 'status');
          ok.textContent = "We'll email you a code when there's room. Speed things up by asking around, every member has three.";
          form.replaceWith(ok);
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
  });

  /* ————— shared: scroll hint — a fade and ↓ more, gone at the end or when nothing scrolls ————— */
  var hints = [];
  $$('.scrollwrap').forEach(function (w) {
    var el = $('.scroll', w);
    var upd = function () { w.classList.toggle('end', el.scrollHeight - el.clientHeight <= el.scrollTop + 2); };
    el.addEventListener('scroll', upd, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(upd).observe(el);
    hints.push(upd); upd();
  });
  function hintAll() { hints.forEach(function (f) { f(); }); }
  document.addEventListener('toggle', function () { setTimeout(hintAll, 0); }, true);

  /* ————— shared: mood rings — four soft auras drifting, trading colours when they touch ————— */
  var MOODS = [[222, 10, 38], [255, 140, 0], [242, 201, 76], [120, 120, 130]];
  function aura(cv) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, run = false, raf = 0;
    var rings = [0, 1, 2, 3].map(function (i) {
      return { x: .2 + Math.random() * .6, y: .2 + Math.random() * .6, vx: (Math.random() - .5) * .002, vy: (Math.random() - .5) * .002,
        c: MOODS[i].slice(), t: MOODS[i].slice(), r: .30 + Math.random() * .08, hit: 0 };
    });
    function size() {
      var b = cv.getBoundingClientRect(); if (!b.width || !b.height) return false;
      var d = window.devicePixelRatio || 1, w = Math.round(b.width * d), h = Math.round(b.height * d);
      if (w !== W || h !== H) { W = cv.width = w; H = cv.height = h; }
      return true;
    }
    function draw(move) {
      if (!size()) return;
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
      var i, j, k, a, b;
      if (move) {
        for (i = 0; i < 4; i++) {
          a = rings[i]; a.x += a.vx; a.y += a.vy;
          if (a.x < .15 || a.x > .85) a.vx *= -1; if (a.y < .15 || a.y > .85) a.vy *= -1;
          for (k = 0; k < 3; k++) a.c[k] += (a.t[k] - a.c[k]) * .0375;
        }
        for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) {
          a = rings[i]; b = rings[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < .14 && !a.hit && !b.hit) { var t = a.t; a.t = b.t; b.t = t; a.hit = b.hit = 60; }
        }
        rings.forEach(function (r) { if (r.hit) r.hit--; });
      }
      ctx.globalCompositeOperation = 'lighter';
      rings.forEach(function (a) {
        var x = a.x * W, y = a.y * H, r = a.r * Math.min(W, H), g = ctx.createRadialGradient(x, y, 0, x, y, r);
        var c = a.c.map(Math.round).join(',');
        g.addColorStop(0, 'rgba(' + c + ',.85)'); g.addColorStop(.35, 'rgba(' + c + ',.45)'); g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      });
    }
    function loop() { if (!run) return; draw(true); raf = requestAnimationFrame(loop); }
    new IntersectionObserver(function (es) {
      var vis = es[es.length - 1].isIntersecting;
      if (still) { if (vis) draw(false); return; }
      if (vis && !run) { run = true; loop(); } else if (!vis) { run = false; cancelAnimationFrame(raf); }
    }).observe(cv);
  }
  $$('[data-aura]').forEach(aura);

  /* ————— shared: the radio (off until the premiere; SoundCloud loads only on its own tap) ————— */
  var playing = false;
  function radioPlay(bar) {
    if (playing || !C.RADIO_EMBED_URL) return;
    playing = true;
    var f = document.createElement('iframe');
    f.title = 'surr radio 001'; f.allow = 'autoplay'; f.scrolling = 'no';
    f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(C.RADIO_EMBED_URL) +
      '&color=%23de0a26&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false';
    bar.appendChild(f); bar.classList.add('playing');
  }
  $$('[data-play]').forEach(function (b) { b.addEventListener('click', function () { radioPlay(b.parentNode); }); });

  /* ————————————————— desktop ————————————————— */
  var site = $('#site'), band = $('#band'), splash = $('#splash');
  var openId = '';

  function setHot(cell) {
    $$('.cell', band).forEach(function (c) { c.classList.toggle('hot', c === cell); });
    band.classList.toggle('hot', !!cell && !openId);
  }
  band.addEventListener('pointerover', function (e) { if (openId) return; var c = e.target.closest('.cell'); if (c) setHot(c); });
  band.addEventListener('pointerleave', function () { setHot(null); });
  band.addEventListener('focusin', function (e) { if (!openId && e.target.classList.contains('cell')) setHot(e.target); });
  band.addEventListener('focusout', function () { setHot(null); });

  function closeDesk(keepAddress) {
    var was = openId;
    openId = '';
    site.classList.remove('has-open');
    $$('.branch', site).forEach(function (b) { b.classList.remove('on'); });
    $$('.cell', band).forEach(function (c) { c.classList.remove('open', 'hot'); });
    band.classList.remove('hot');
    if (!playing) site.classList.remove('radio');
    if (!keepAddress) setAddress('', 'surr');
    if (was) { var c = $('.cell[data-i="' + was + '"]', band); if (c && document.activeElement && document.activeElement.closest && document.activeElement.closest('.branch')) c.focus({ preventScroll: true }); }
  }
  function openDesk(id, beta) {
    closeDesk(true);
    openId = id;
    $('.cell[data-i="' + id + '"]', band).classList.add('open');
    site.classList.add('has-open');
    var br = $('.branch[data-b="' + id + '"]', site);
    br.classList.add('on');
    if (id === 'nights' && C.RADIO_ON) site.classList.add('radio');
    var d = $('details.beta', br);
    if (d) d.open = !!beta;
    var dl = $('details.deal', br); if (dl && beta) dl.open = false;
    setAddress(beta ? 'beta/' : (SLUGS[id] || ''), TITLES[id]);
    hintAll();
    if (beta && d) setTimeout(function () {
      var sc = d.closest('.scroll');
      sc.scrollTo({ top: d.offsetTop - sc.offsetTop, behavior: smooth });
    }, 60);
    var x = $('.x', br); if (x) x.focus({ preventScroll: true });
  }
  band.addEventListener('click', function (e) {
    var c = e.target.closest('.cell'); if (!c) return;
    if (openId) { closeDesk(); return; }
    openDesk(c.dataset.i);
  });
  $('#veil').addEventListener('click', function () { closeDesk(); });
  $$('[data-close]', site).forEach(function (b) { b.addEventListener('click', function () { closeDesk(); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openId) closeDesk();
    if ((e.key === 'Enter' || e.key === ' ') && (e.target === splash || e.target === ssplash)) { e.preventDefault(); e.target.click(); }
  });

  /* the map leans a few percent towards the cursor */
  var lean = $('.br-map .lean');
  site.addEventListener('mousemove', function (e) {
    if (openId !== 'map' || still) return;
    var x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    lean.style.transform = 'translate(' + (-x * 4).toFixed(2) + '%,' + (-y * 4).toFixed(2) + '%)';
  });

  /* the splash: a door, not a gate — one click cuts in */
  if (DEEP) { splash.remove(); }
  else {
    splash.addEventListener('click', function () {
      if (splash.classList.contains('cut')) return;
      splash.classList.add('cut');
      setTimeout(function () { splash.remove(); band.querySelector('.cell').blur(); }, still ? 0 : 1750);
    });
  }

  /* ————————————————— phone: snap ————————————————— */
  var wrap = $('#snapwrap'), snap = $('#snap'), ssplash = $('#ssplash'), s0 = $('#s0');
  var home = $('#home'), ticks = $$('#ticks i'), tickBox = $('#ticks'), swipe = $('#swipe'), pbar = $('#pbar');
  var secs = $$('.sec', snap);
  function vh() { document.documentElement.style.setProperty('--vh', (innerHeight / 100) + 'px'); }
  vh(); addEventListener('resize', vh);
  function sec(id) { return $('.sec[data-i="' + id + '"]', snap); }
  function goSec(id, beta, how) {
    var s = sec(id); if (!s) return;
    if (id === 'surr') { var d = $('details.beta', s); if (beta) d.open = true; }
    if (how === 'auto') { snap.scrollTop = s.offsetTop; mark(); }
    else snap.scrollTo({ top: s.offsetTop, behavior: smooth });
    if (beta) setTimeout(function () {
      var d = $('details.beta', s), sc = d.closest('.scroll');
      sc.scrollTop = d.offsetTop - sc.offsetTop;
      hintAll();
    }, how === 'auto' ? 50 : 600);
  }
  function enterSnap() {
    if (ssplash.parentNode) ssplash.remove();
    wrap.classList.remove('pre');
    snap.classList.add('open');
    snap.scrollTop = 0;
    mark();
  }

  if (DEEP) {
    enterSnap();
  } else {
    wrap.classList.add('pre');
    ssplash.addEventListener('click', function () {
      if (ssplash.classList.contains('cut')) return;
      ssplash.classList.add('cut');
      setTimeout(function () { s0.classList.add('arrive'); enterSnap(); }, still ? 0 : 750);
    });
  }

  /* which screen is showing: the ticks, `surr ↑`, the swipe hint, the text rising in */
  var shown = null;
  function mark() {
    if (!snap.classList.contains('open')) return;
    var el = snap.children[Math.round(snap.scrollTop / (snap.clientHeight || 1))];
    if (!el || el === shown) return;
    shown = el;
    var n = secs.indexOf(el), away = n >= 0;
    if (away) el.classList.add('in');
    ticks.forEach(function (t, i) { t.classList.toggle('on', i === n); });
    home.classList.toggle('on', away); tickBox.classList.toggle('on', away);
    swipe.classList.toggle('off', away);
    if (C.RADIO_ON) pbar.classList.toggle('up', playing || el.dataset.i === 'nights');
    document.title = away ? TITLES[el.dataset.i] : 'surr';
  }
  var ticking = false;
  snap.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; mark(); });
  }, { passive: true });
  $$('.tile', snap).forEach(function (t) { t.addEventListener('click', function () { goSec(t.dataset.i); }); });
  home.addEventListener('click', function () { snap.scrollTo({ top: s0.offsetTop, behavior: smooth }); });

  /* ————— both: the door line and the "join the list" link ————— */
  $$('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var beta = a.dataset.go === 'beta';
      if (deskMQ.matches) openDesk(beta ? 'surr' : 'list', beta);
      else goSec(beta ? 'surr' : 'list', beta);
    });
  });

  /* ————— land on the branch the address names ————— */
  function land() {
    if (!START) return;
    var beta = START === 'beta', id = beta ? 'surr' : START;
    if (deskMQ.matches) openDesk(id, beta);
    else goSec(id, beta, 'auto');
  }
  document.body.classList.toggle('is-desk', deskMQ.matches);
  if (deskMQ.addEventListener) deskMQ.addEventListener('change', function () { document.body.classList.toggle('is-desk', deskMQ.matches); });
  if (document.readyState === 'complete') land(); else addEventListener('load', land);
})();
