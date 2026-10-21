/* surr — getsurr.com. the band, the branches, the snap phone, the list form, the radio.
   no storage, no analytics, nothing from another host but the forms' calls to Supabase. the radio plays our own file, after its own tap. */
(function () {
  'use strict';
  var C = window.SURR || {};
  var BASE = C.BASE || '/';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var deskMQ = matchMedia('(min-width: 721px) and (min-height: 501px) and (orientation: landscape), (min-width: 721px) and (min-height: 501px) and (pointer: fine)'); /* same as site.css */
  var smooth = still ? 'auto' : 'smooth';
  /* a form send that has not answered in 15 s gives up and says so, never "sending…" forever */
  function patience() {
    if (!window.AbortController) return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, 15000);
    return c.signal;
  }

  var TITLES = { surr: 'surr', rings: 'mood rings · surr', map: 'map · surr', nights: 'nights · surr', drive: 'the drive · surr', list: 'the list · surr' };
  var SLUGS = { rings: 'rings/', map: 'map/', nights: 'nights/', list: 'list/' };

  /* which branch the address asks for: '' | rings | map | nights | list | beta */
  function route() {
    var p = location.pathname;
    if (p.indexOf(BASE) !== 0) return '';
    p = p.slice(BASE.length).replace(/(^|\/)index\.html$/, '').replace(/\/$/, '');
    return ['rings', 'map', 'nights', 'list', 'beta'].indexOf(p) >= 0 ? p : '';
  }
  var START = route();

  /* ————— the drive (its own page, /drive/): with DRIVE.ON the band's fifth tile is the fuse and the phone gets the drive screen,
     fifth, before the list; off, both stay exactly as before ————— */
  var DRIVE_ON = !!(C.DRIVE && C.DRIVE.ON);
  (function () {
    var dsec = $('.sec.drive'), dbtn = $('#menu [data-i="drive"]'), dtick = $('#ticks [data-drive]');
    if (!DRIVE_ON) { [dsec, dbtn, dtick].forEach(function (el) { if (el) el.remove(); }); return; }
    [dsec, dbtn, dtick].forEach(function (el) { if (el) el.hidden = false; });
    var five = $('#band .cell[data-i="list"]');
    if (!five || !dsec) return;
    five.dataset.i = 'drive';
    five.classList.add('fusecell');
    five.innerHTML = '<span class="sym"></span><span class="word big">drive</span>';
    five.firstChild.appendChild($('.fuse', dsec).cloneNode(true));
  })();
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

  /* ————— shared: the beta part — until APP_URL is set, one email box in place of the steps ————— */
  $$('[data-ask]').forEach(function (ask) {
    var steps = ask.parentNode.querySelector('[data-steps]');
    if (C.APP_URL) { ask.remove(); return; }
    if (steps) steps.remove();
    ask.hidden = false;
  });
  var askN = 0;
  $$('[data-ask-form]').forEach(function (slot) {
    var n = ++askN;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<form class="ask" novalidate><div class="cap">' +
      '<label class="sr" for="ab' + n + '">email</label><input id="ab' + n + '" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
      '<button class="dot" type="submit" aria-label="tell me">→</button></div>' +
      '<div class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<p class="err" role="status" aria-live="polite" hidden></p></form>';
    var form = wrap.firstChild, btn = $('button', form), err = $('.err', form);
    slot.replaceWith(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var email = form.email.value.trim().toLowerCase(), hp = form.website.value;
      btn.disabled = true; err.hidden = true;
      fetch(C.SUPABASE_URL + '/rest/v1/rpc/ask_beta_link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY },
        body: JSON.stringify(hp ? { p_email: email, p_hp: hp } : { p_email: email }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: patience()
      }).then(function (r) {
        if (r.ok) return null;
        return r.json().catch(function () { return {}; }).then(function (j) { return j || {}; });
      }).then(function (j) {
        if (!j) {
          var ok = document.createElement('p');
          ok.className = 'done'; ok.setAttribute('role', 'status');
          ok.textContent = "Got it. We'll email you when it's live.";
          form.replaceWith(ok);
          return;
        }
        /* the function's own refusal ("that's not an email") comes back as it is, with a capital */
        var m = j.code === '22023' && j.message ? j.message : '';
        fail(m ? m.charAt(0).toUpperCase() + m.slice(1) : "That didn't go through. Try again in a moment.");
      }).catch(function () { fail("That didn't go through. Try again in a moment."); });
    });
    function fail(msg) {
      btn.disabled = false;
      err.textContent = msg; err.hidden = false;
      hintAll();
    }
  });

  /* ————— shared: the list form ————— */
  /* both forms carry a bot trap (.hp, name="website"): people never see or reach it. Only a robot fills it; its value goes as p_hp and the server answers "done" and writes nothing. Sent only when filled, so a person's call is exactly as before. */
  var formN = 0;
  $$('[data-form]').forEach(function (slot) {
    var n = ++formN;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<form class="list" novalidate>' +
      '<label class="sr" for="em' + n + '">email</label><input id="em' + n + '" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="email">' +
      '<label class="sr" for="ci' + n + '">city</label><input id="ci' + n + '" name="city" type="text" autocomplete="address-level2" placeholder="city">' +
      '<div class="phone" role="group" aria-labelledby="ph' + n + '"><span class="sr" id="ph' + n + '">your phone, optional</span>' +
      '<button type="button" aria-pressed="false" data-phone="iphone">iphone</button><button type="button" aria-pressed="false" data-phone="android">android</button></div>' +
      '<label class="sr" for="li' + n + '">instagram or a link, optional</label><input id="li' + n + '" name="link" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="instagram or a link, optional">' +
      '<div class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<button class="go" type="submit">put me on the list →</button>' +
      '<p class="err" role="status" aria-live="polite" hidden></p></form>';
    var form = wrap.firstChild, btn = $('button.go', form), err = $('.err', form);
    /* the phone question (list-phone-question): optional, neither lit at first; a tap lights one, a second tap puts it out */
    var phone = null, phones = $$('[data-phone]', form);
    phones.forEach(function (b) {
      b.addEventListener('click', function () {
        phone = phone === b.dataset.phone ? null : b.dataset.phone;
        phones.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.phone === phone)); });
      });
    });
    slot.replaceWith(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var email = form.email.value.trim().toLowerCase(), city = form.city.value.trim(), link = form.link.value.trim() || null, hp = form.website.value;
      btn.disabled = true; btn.textContent = 'sending…'; err.hidden = true;
      fetch(C.SUPABASE_URL + '/rest/v1/rpc/join_waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY },
        body: JSON.stringify(Object.assign({ p_email: email, p_city: city, p_link: link }, hp ? { p_hp: hp } : {}, phone ? { p_phone: phone } : {})),
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

  /* ————— shared: the radio — "the chip" (brief getsurr-site-radio-chip; behaviour from the mockup in sap-business/inspo).
     one chip on the desk, one on the phone, over one <audio> that is made on the first play tap (preload none), so nothing of
     the mix is on the first load. the wave (600 loudness values, measured once from the file by scripts/wave.mjs) is fetched
     when nights opens. off — no chip at all — while RADIO_ON is false or RADIO_FILE is missing (an old cached config.js). ————— */
  var radio = (function () {
    var els = $$('[data-chip]');
    if (!(C.RADIO_ON && C.RADIO_FILE)) { els.forEach(function (el) { el.remove(); }); return null; }
    var LEN = 2618, BARS = 75, REST = '43:38', FAIL = "didn't start · tap again";
    var bars = [], wave = null, asked = false, audio = null, want = false, failT = 0, stallT = 0, failUntil = 0, raf = 0, ms = false;
    function fmt(s) { s = Math.max(0, Math.floor(s)); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
    function len() { return (audio && isFinite(audio.duration) && audio.duration) || LEN; }
    function pos() { return audio ? audio.currentTime : 0; }
    function amp(p) { return wave ? wave[Math.min(wave.length - 1, Math.floor(p / len() * wave.length))] / 99 : 0; }

    /* the wave: asked for once nights is on screen; a failed fetch is asked again next time */
    function loadWave() {
      if (wave || asked || !C.RADIO_WAVE || !window.fetch) return;
      asked = true;
      fetch(C.RADIO_WAVE).then(function (r) { return r.ok ? r.json() : null; }).then(function (w) {
        if (!Array.isArray(w) || !w.length) { asked = false; return; }
        wave = w; bars = [];
        for (var b = 0; b < BARS; b++) {
          var a = Math.floor(b * w.length / BARS), z = Math.floor((b + 1) * w.length / BARS), s = 0;
          for (var i = a; i < z; i++) s += w[i];
          bars.push(s / (z - a) / 99);
        }
        drawAll();
      }).catch(function () { asked = false; });
    }

    /* the sound: one element for both chips, so switching between desk and phone never plays twice */
    function make() {
      if (audio) return;
      audio = document.createElement('audio');
      audio.preload = 'none';
      audio.src = C.RADIO_FILE;
      audio.hidden = true;
      document.body.appendChild(audio);
      audio.addEventListener('play', function () { set(true); });
      audio.addEventListener('pause', function () { if (!audio.ended) set(false); });
      audio.addEventListener('playing', function () { clearTimeout(failT); clearTimeout(stallT); });
      /* a stall mid-play: if it has not picked up again in 20 s, show play again (never a dead button) */
      audio.addEventListener('waiting', function () {
        clearTimeout(stallT);
        stallT = setTimeout(function () { if (want && audio.readyState < 3) audio.pause(); }, 20000);
      });
      audio.addEventListener('ended', function () { want = false; clearTimeout(stallT); audio.currentTime = 0; set(false); });
      audio.addEventListener('error', function () { if (want) fail(); });
      /* leaving the page (press, the deal…): the music stops, and coming back the chip is at rest again */
      addEventListener('pagehide', function () { want = false; audio.pause(); audio.currentTime = 0; set(false); });
    }
    function play() {
      make();
      /* after a failed start or a dropped connection the element is stuck: load it again, from the same place */
      if (audio.error || audio.networkState === 3) { var at = audio.currentTime; audio.load(); if (at) audio.currentTime = at; }
      failUntil = 0;
      want = true;
      clearTimeout(failT);
      failT = setTimeout(fail, 4000); /* no sound within 4 s of the tap: say so, show play again */
      var p = audio.play();
      if (p && p.catch) p.catch(function (e) { if (!(e && e.name === 'AbortError') && want) fail(); });
      session();
      set(true);
    }
    function pause() { want = false; clearTimeout(failT); clearTimeout(stallT); if (audio) audio.pause(); set(false); }
    function fail() {
      want = false; clearTimeout(failT); clearTimeout(stallT);
      if (audio) audio.pause();
      failUntil = Date.now() + 3000;
      setTimeout(drawAll, 3050);
      set(false);
    }
    /* the phone's lock screen: the title, and play / pause from there — nothing else */
    function session() {
      if (ms || !('mediaSession' in navigator)) return;
      ms = true;
      try {
        if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: 'surr radio 001', artist: 'mobilegirl for surr', artwork: [{ src: BASE + 'img/blue-1-melt-tile.jpg', sizes: '700x700', type: 'image/jpeg' }] });
        navigator.mediaSession.setActionHandler('play', play);
        navigator.mediaSession.setActionHandler('pause', pause);
      } catch (e) { /* an older browser without these: the chip still plays */ }
    }
    function set(on) {
      want = on;
      chips.forEach(function (c) {
        c.el.classList.toggle('on', on);
        c.pp.setAttribute('aria-label', on ? 'pause' : 'play');
        if (on) c.arm(); else c.unfold();
      });
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(frame);
      drawAll();
    }
    function frame() { drawAll(); if (want) raf = requestAnimationFrame(frame); }
    function drawAll() { chips.forEach(function (c) { c.draw(); }); }

    function Chip(el) {
      var desk = !!el.closest('.site');
      var cv = $('canvas', el), cx = cv.getContext('2d'), t = $('[data-time]', el), pp = $('[data-pp]', el), led = $('.led', el), vu = $$('.vu i', el);
      var run = $('.run', el), link = null, foldT = 0, hideT = 0, shown = false, hover = false;
      if (C.RADIO_ARTIST_URL) $$('[data-artist]', el).forEach(function (s, i) {
        var a = document.createElement('a');
        a.href = C.RADIO_ARTIST_URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.textContent;
        if (i) a.tabIndex = -1; else link = a;
        s.replaceWith(a);
      });
      /* a keyboard on the link: the label stops with the link in view */
      if (link) {
        link.addEventListener('focus', function () { run.style.animation = 'none'; run.style.transform = 'translateX(' + (6 - link.offsetLeft) + 'px)'; });
        link.addEventListener('blur', function () { run.style.animation = ''; run.style.transform = ''; });
      }
      var c = { el: el, pp: pp };

      c.draw = function () {
        if (!shown) return;
        var w = cv.clientWidth, h = cv.clientHeight;
        if (!w) return;
        var k = Math.min(3, Math.max(2, window.devicePixelRatio || 1)), W = Math.round(w * k), H = Math.round(h * k);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        var at = pos(), p = at / len(), mid = at > 0, pitch = W / BARS;
        cx.clearRect(0, 0, W, H);
        for (var i = 0; i < bars.length; i++) {
          var bh = Math.max(k, bars[i] * (H - 4 * k)), x = i * pitch, y = (H - bh) / 2;
          cx.fillStyle = (i + .5) / BARS <= p ? '#d9dde0' : '#3a4047';
          cx.fillRect(x + pitch * .25, y, Math.max(1, pitch * .5), bh);
        }
        if (want || mid) { cx.fillStyle = '#DE0A26'; cx.fillRect(Math.round(p * W), 0, Math.max(1, k), H); }
        var txt = Date.now() < failUntil ? FAIL : (want || mid) ? fmt(at) : REST;
        if (t.textContent !== txt) t.textContent = txt;
        el.classList.toggle('mid', !want && mid);
        var a = want ? amp(at) : 0;
        if (!still) { led.style.transform = 'scale(' + (1 + a * 1.1) + ')'; led.style.opacity = want ? (.45 + a * .55) : 1; }
        vu.forEach(function (v, i) {
          var j = want ? a * (still ? 1 : .6 + Math.random() * .7) * (i === 1 ? 1 : .75) : 0;
          v.style.height = Math.max(2, Math.round(j * 12)) + 'px';
        });
      };

      /* folding: six seconds after play, to the light and the meter; never while the mouse or the keyboard is on it */
      function fold() {
        var had = el.contains(document.activeElement);
        el.classList.add('folded');
        el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', 'surr radio · open');
        if (had) el.focus({ preventScroll: true });
      }
      c.unfold = function () {
        clearTimeout(foldT);
        if (!el.classList.contains('folded')) return;
        el.classList.remove('folded');
        el.removeAttribute('role'); el.removeAttribute('tabindex'); el.removeAttribute('aria-label');
      };
      c.arm = function () {
        clearTimeout(foldT);
        foldT = setTimeout(function () {
          var keys = false;
          try { keys = !!el.querySelector(':focus-visible'); } catch (e) { /* no :focus-visible: fold anyway */ }
          if (!want) return;
          if (hover || keys) c.arm(); else fold();
        }, 6000);
      };
      function open() { c.unfold(); if (want) c.arm(); }
      pp.addEventListener('click', function (e) { e.stopPropagation(); if (want) pause(); else play(); });
      $('[data-fold]', el).addEventListener('click', function (e) { e.stopPropagation(); clearTimeout(foldT); fold(); });
      el.addEventListener('click', function () { if (el.classList.contains('folded')) open(); });
      el.addEventListener('keydown', function (e) {
        if (e.target !== el || !el.classList.contains('folded') || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); open(); pp.focus({ preventScroll: true });
      });
      el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; hover = true; if (el.classList.contains('folded')) open(); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });

      /* showing and hiding: on the desk it travels out of the nights tile and back into it; on the phone it grows in place.
         with reduced motion it only fades. */
      function toTile() {
        var tile = $('#band .cell[data-i="nights"]');
        if (!desk || still || !tile) return '';
        var r = tile.getBoundingClientRect();
        return 'translate(' + Math.round(r.left + r.width / 2 - (el.offsetLeft + el.offsetWidth / 2)) + 'px,' +
          Math.round(r.top + r.height / 2 - (el.offsetTop + el.offsetHeight / 2)) + 'px) scale(.2)';
      }
      c.show = function () {
        loadWave();
        if (shown) return;
        shown = true;
        clearTimeout(hideT);
        el.hidden = false; el.inert = false;
        el.style.left = el.style.top = el.style.right = '';
        el.style.transition = 'none';
        el.style.transform = toTile();
        void el.offsetWidth;
        el.style.transition = '';
        el.classList.remove('hidden-chip');
        el.style.transform = '';
        c.draw();
      };
      c.hide = function () {
        if (!shown || want) return;
        shown = false;
        c.unfold();
        el.inert = true;
        el.style.transform = toTile();
        el.classList.add('hidden-chip');
        clearTimeout(hideT);
        hideT = setTimeout(function () { if (!shown) el.hidden = true; }, 650);
      };
      c.desk = desk;

      /* drag (desk only): anywhere in the window, 8 px inside its edges, never from the buttons or the link; kept in memory only */
      if (desk) {
        var dx = 0, dy = 0, drag = false;
        var clamp = function (x, y) {
          var W = innerWidth - el.offsetWidth - 8, H = innerHeight - el.offsetHeight - 8;
          el.style.right = 'auto';
          el.style.left = Math.max(8, Math.min(W, x)) + 'px';
          el.style.top = Math.max(8, Math.min(H, y)) + 'px';
        };
        var end = function () { drag = false; el.classList.remove('dragging'); };
        el.addEventListener('pointerdown', function (e) {
          end();
          if (e.target.closest('button, a') || e.button > 0) return;
          drag = true; el.classList.add('dragging');
          try { el.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
          dx = e.clientX - el.offsetLeft; dy = e.clientY - el.offsetTop;
        });
        /* a release outside the window can go missing: no button held means the drag is over */
        el.addEventListener('pointermove', function (e) { if (!drag) return; if (e.pointerType === 'mouse' && !e.buttons) end(); else clamp(e.clientX - dx, e.clientY - dy); });
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        addEventListener('resize', function () { if (el.style.left) clamp(el.offsetLeft, el.offsetTop); });
      }
      return c;
    }
    var chips = els.map(Chip);
    function pick(desk) { return chips.filter(function (c) { return c.desk === desk; })[0]; }
    return {
      /* desk: nights opened (true) or a branch closed (false — it stays while the mix plays) */
      desk: function (on) { var c = pick(true); if (c) { if (on) c.show(); else c.hide(); } },
      /* phone: a screen settled; nights shows it, any other screen keeps it only while the mix plays */
      phone: function (nights) { var c = pick(false); if (!c) return; if (nights || want) c.show(); else c.hide(); },
      on: function () { return want; },
    };
  })();

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
    if (radio) radio.desk(false);
    if (!keepAddress) setAddress('', 'surr');
    if (was) { var c = $('.cell[data-i="' + was + '"]', band); if (c && document.activeElement && document.activeElement.closest && document.activeElement.closest('.branch')) c.focus({ preventScroll: true }); }
  }
  /* pictures fade in once loaded; the map poster is the heaviest, so it waits until the page has loaded (or the map opens) */
  function fadeIn(img) {
    if (img.classList.contains('ok')) return;
    if (img.complete && img.naturalWidth) img.classList.add('ok');
    else img.addEventListener('load', function () { img.classList.add('ok'); }, { once: true });
  }
  $$('.band img, .sec .bg > img, .look img').forEach(fadeIn);
  function loadPoster() {
    $$('img[data-src]').forEach(function (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); fadeIn(img); });
  }
  if (document.readyState === 'complete') loadPoster(); else addEventListener('load', loadPoster);
  function openDesk(id, beta) {
    if (id === 'map') loadPoster();
    closeDesk(true);
    openId = id;
    var oc = $('.cell[data-i="' + id + '"]', band); if (oc) oc.classList.add('open');
    site.classList.add('has-open');
    var br = $('.branch[data-b="' + id + '"]', site);
    br.classList.add('on');
    if (id === 'nights' && radio) radio.desk(true);
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
    if (c.dataset.i === 'drive') { location.href = BASE + 'drive/'; return; }
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
  var menu = $('#menu'), menuBtns = $$('#menu button'), downBtn = $('#down'), ticks = $$('#ticks i'), tickBox = $('#ticks');
  var secs = $$('.sec', snap);
  function vh() { document.documentElement.style.setProperty('--vh', (innerHeight / 100) + 'px'); }
  vh(); addEventListener('resize', vh);
  function sec(id) { return $('.sec[data-i="' + id + '"]', snap); }
  function goSec(id, beta, how) {
    if (id === 'map') loadPoster();
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

  /* the menu row: drops in when a screen settles, holds 1.8 s, leaves; never on the landing */
  var menuTimer = null, onLanding = true;
  function hideMenu() { clearTimeout(menuTimer); menu.classList.remove('down'); }
  function showMenu() {
    if (onLanding) return;
    menu.classList.add('down');
    clearTimeout(menuTimer);
    menuTimer = setTimeout(function () { menu.classList.remove('down'); }, 1800);
  }
  /* which screen is showing: the ticks, the menu row, the text rising in */
  var shown = null;
  function mark() {
    if (!snap.classList.contains('open')) return;
    var el = snap.children[Math.round(snap.scrollTop / (snap.clientHeight || 1))];
    if (!el || el === shown) return;
    shown = el;
    var n = secs.indexOf(el), away = n >= 0;
    if (away) el.classList.add('in');
    ticks.forEach(function (t, i) { t.classList.toggle('on', i === n); });
    tickBox.classList.toggle('on', away);
    onLanding = !away;
    menuBtns.forEach(function (b) { b.classList.toggle('on', away && b.dataset.i === el.dataset.i); });
    if (away) showMenu(); else hideMenu();
    if (radio) radio.phone(el.dataset.i === 'nights');
    document.title = away ? TITLES[el.dataset.i] : 'surr';
  }
  var ticking = false;
  snap.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; mark(); if (menu.classList.contains('down')) showMenu(); });
  }, { passive: true });
  menuBtns.forEach(function (b) { b.addEventListener('click', function () { goSec(b.dataset.i); showMenu(); }); });
  $$('.sec .word', snap).forEach(function (w) { w.addEventListener('click', showMenu); });
  downBtn.addEventListener('click', function () { goSec('surr'); });

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
  if (deskMQ.addEventListener) deskMQ.addEventListener('change', function () {
    document.body.classList.toggle('is-desk', deskMQ.matches);
    if (radio && radio.on()) { radio.desk(true); radio.phone(true); } /* turned while the mix plays: the chip is there in the new layout too */
  });
  if (document.readyState === 'complete') land(); else addEventListener('load', land);
})();
