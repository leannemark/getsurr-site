/* the back pages — getsurr.com/backpages (brief docs/briefs/back-pages-site.md in the app repo).
   three screens in one page: the entrance (type the flyer's code onto the band) → the gift → the back pages.
   talks only to Supabase's six backpages_* functions. the code lives in sessionStorage for this tab only:
   no cookies, no localStorage, no analytics beyond backpages_count (once per screen per tab). */
(function () {
  'use strict';
  var C = window.SURR || {};
  /* on getsurr.com the page talks to production (config.js); anywhere else (localhost, a LAN address) to staging */
  var LIVE = /(^|\.)getsurr\.com$/.test(location.hostname);
  var STAGING = C.BACKPAGES_STAGING || {};
  var API = LIVE ? { url: C.SUPABASE_URL, key: C.SUPABASE_ANON_KEY } : { url: STAGING.URL, key: STAGING.KEY };
  var DESK = window.matchMedia('(min-width:900px) and (min-height:560px)');
  var STILL = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* sessionStorage, with a stand-in when a browser refuses it */
  var mem = {};
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };

  function patience() {
    if (!window.AbortController) return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, 15000);
    return c.signal;
  }
  /* every function answers jsonb ({error} for a refusal) or nothing (backpages_count) */
  function rpc(name, args) {
    return fetch(API.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API.key },
      body: JSON.stringify(args),
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: patience()
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text().then(function (t) { try { return t ? JSON.parse(t) : {}; } catch (e) { return {}; } });
    });
  }
  function count(screen) {
    var seen = (store.get('bp.seen') || '').split(',');
    if (seen.indexOf(screen) !== -1) return;
    seen.push(screen);
    store.set('bp.seen', seen.join(','));
    rpc('backpages_count', { p_screen: screen }).catch(function () {});
  }

  var code = store.get('bp.code');
  var entrance = $('#entrance'), gift = $('#gift'), back = $('#back'), topband = $('#topband');
  var screen = '';

  /* ————— moving between screens ————— */
  function setTabs(id) {
    $$('.tabs button').forEach(function (b) {
      if (b.dataset.go === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (id === 'back') topband.classList.add('seen');
  }
  var moves = 0;
  function show(id, how) {
    var from = screen ? $('#' + (screen === 'back' ? 'back' : screen)) : null;
    var to = $('#' + id);
    screen = id;
    if (id !== 'entrance') { store.set('bp.screen', id); topband.hidden = false; setTabs(id); }
    to.hidden = false;
    if (id === 'gift') readyBoard();
    if (id === 'back') { openBoard(); layout(); }
    count(id === 'back' ? 'board' : id);
    var mine = ++moves;
    var done = function () {
      if (mine !== moves) return; /* a newer move took over: leave its screens alone */
      [gift, back].forEach(function (s) {
        if (s !== to) s.hidden = true;
        s.classList.remove('turning', 'fading', 'sliding');
      });
      var h = id === 'gift' ? $('#g-h') : id === 'back' ? $('#b-h') : $('#e-h');
      if (how !== 'start') h.focus({ preventScroll: true });
      if (id === 'back') layout();
    };
    if (!from || how === 'start') { done(); return; }
    var anim;
    if (how === 'turn') {
      if (STILL.matches) { from.classList.add('turning'); anim = from; }
      else if (DESK.matches) { from.classList.add('turning'); anim = from; }
      else { to.classList.add('sliding'); anim = to; }
    } else { to.classList.add('fading'); anim = to; }
    var finished = false;
    var end = function (e) { if (finished || (e && e.target !== anim)) return; finished = true; anim.removeEventListener('animationend', end); done(); };
    anim.addEventListener('animationend', end);
    setTimeout(end, 900);
  }

  /* ————— 1 · the entrance ————— */
  var eForm = $('#e-form'), eCode = $('#e-code'), eMsg = $('#e-msg'), eBand = $('.e-band');
  var WORDS_E = {
    bad_code: "that's not it. the code was on the flyer.",
    too_many: 'too many tries. wait ten minutes.',
    not_open: 'the back pages open soon.',
    other: "that didn't go through. try again."
  };
  /* the typing line is thin (28px on a phone): a tap anywhere on the band brings the keyboard up */
  eBand.addEventListener('click', function (e) {
    if (e.target !== eCode && !e.target.closest('button, a')) eCode.focus();
  });
  $('#e-hint').addEventListener('click', function () {
    var t = $('#e-hinttext');
    this.hidden = true; t.hidden = false;
    var dot = $('.e-dot'); if (dot) dot.hidden = true;
    eCode.focus();
  });
  var trying = false;
  eForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var typed = eCode.value.trim();
    if (!typed || trying) return;
    trying = true; eMsg.textContent = '';
    rpc('backpages_enter', { p_code: typed }).then(function (j) {
      trying = false;
      if (j && j.ok) return enter(typed.toUpperCase());
      no(WORDS_E[j && j.error] || WORDS_E.other);
    }).catch(function () { trying = false; no(WORDS_E.other); });
  });
  function no(words) {
    eMsg.textContent = words;
    eBand.classList.remove('no'); void eBand.offsetWidth; eBand.classList.add('no');
  }
  function enter(c) {
    code = c;
    store.set('bp.code', c);
    eCode.blur();
    var go = function () {
      entrance.classList.add('leaving');
      topband.hidden = false;
      topband.classList.add('drop');
      gift.classList.add('arriving');
      screen = '';
      show('gift', 'start');
      setTimeout(function () { entrance.hidden = true; entrance.classList.remove('leaving'); topband.classList.remove('drop'); $('#g-h').focus({ preventScroll: true }); }, 340);
      setTimeout(function () { gift.classList.remove('arriving'); }, 450);
    };
    if (STILL.matches) return go();
    eBand.classList.remove('no');
    eBand.classList.add('snap');
    setTimeout(go, 430);
  }

  /* ————— 2 · the gift ————— */
  /* the drawn phone (decoration, aria-hidden): HTML and CSS only, 16s, four scenes. the same scenes, still, for reduce motion.
     the code's letters never appear: the paste fills the field with ten dots. */
  (function drawPhone() {
    var STEPS = ['get testflight from the app store.', 'open the surr link and tap install.', 'open surr, tap create profile, paste the code.', 'you’ll get an email.'];
    var D = ['0s', '-12s', '-8s', '-4s'];
    function scene(i) {
      var d = ' style="--d:' + D[i] + '"';
      if (i === 0) return '<div class="sc light"' + d + '><div class="p-srch"><i></i><b>testflight</b></div>' +
        '<div class="p-row"><i class="p-ico tfi"></i><div class="nm"><b>TestFlight</b><small>Apple</small></div>' +
        '<span class="p-pill"><em class="before">GET</em><em class="after">OPEN</em></span></div>' +
        '<div class="p-lines"><i></i><i></i><i></i></div><div class="p-shots"><i></i><i></i><i></i></div>' +
        '<i class="ring" style="left:16.2em;top:9.3em"></i></div>';
      if (i === 1) return '<div class="sc light"' + d + '><div class="p-tfhd"><b>‹ Apps</b><span>TestFlight</span><span></span></div>' +
        '<div class="p-tfrow"><i class="p-ico surr big">surr</i><div class="nm"><b>surr</b><small>say less</small>' +
        '<span class="p-pill"><em class="before">INSTALL</em><em class="after">OPEN</em></span></div></div>' +
        '<div class="p-tfsec">what to test</div><div class="p-lines"><i></i><i></i><i></i></div>' +
        '<div class="p-shots"><i></i><i class="p"></i><i></i></div>' +
        '<i class="ring" style="left:12em;top:12.5em"></i></div>';
      if (i === 2) return '<div class="sc dark"' + d + '>' +
        '<div class="p-cover before"><span class="mk">surr</span><div class="sl">say less</div>' +
        '<div class="ld">read the room, not an essay.</div><span class="p-btn">create profile →</span>' +
        '<div class="lg">already a member? log in</div></div>' +
        '<div class="p-step after"><div class="pr"><i class="on"></i><i></i><i></i><i></i><i></i></div>' +
        '<h4>your invite code</h4><div class="sub">surr’s invite only. every member has three codes to give.</div>' +
        '<div class="p-fld"><span class="p-chip">paste</span><label>invite code</label><div class="in"><span class="dots">··········</span><span class="cur"></span></div></div></div>' +
        '<i class="ring" style="left:6.1em;top:35.3em"></i></div>';
      return '<div class="sc dark"' + d + '>' +
        '<div class="p-step"><div class="pr"><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>' +
        '<h4>where do we reach you?</h4><div class="sub">we’ll email you when you’re in.</div>' +
        '<div class="p-fld"><label>email</label><div class="in" style="letter-spacing:0"><span class="cur"></span></div></div></div></div>';
    }
    function phone(cls, only) {
      var h = '<div class="ph ' + cls + '"><span class="isl"></span>';
      if (only == null) for (var i = 0; i < 4; i++) h += scene(i); else h += scene(only);
      return h + '</div>';
    }
    $('#ph-loop').innerHTML = phone('loop');
    $('#ph-four').innerHTML = STEPS.map(function (t, i) {
      return '<div class="fr">' + phone('still', i) + '<div class="cap2"><b>0' + (i + 1) + '</b>' + t + '</div></div>';
    }).join('');
  })();

  /* the written steps are buttons: a tap makes the loop phone jump to that scene and hold it for its 4 s, and the loop carries on from
     there. every scene and step gets its delay again, with the tapped one at the start, and the animations are restarted so "now"
     is the start. with reduce motion the loop does not run: the buttons are switched off (the four still phones show every scene). */
  (function steps() {
    var list = $('.steps'), loop = $('#ph-loop'), tapT = 0;
    var btns = $$('button', list), lis = $$('li', list);
    function dis() { btns.forEach(function (b) { b.disabled = STILL.matches; }); }
    dis();
    if (STILL.addEventListener) STILL.addEventListener('change', dis);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (STILL.matches) return;
        var k = +b.dataset.step, scenes = $$('.sc', loop);
        lis.forEach(function (li, i) {
          var d = (-(16 - 4 * ((i - k + 4) % 4)) % 16) + 's';
          li.style.setProperty('--d', d);
          if (scenes[i]) scenes[i].style.setProperty('--d', d);
          li.classList.toggle('tapped', i === k);
        });
        loop.classList.add('rs'); list.classList.add('rs');
        void loop.offsetWidth;
        loop.classList.remove('rs'); list.classList.remove('rs');
        clearTimeout(tapT);
        tapT = setTimeout(function () { lis[k].classList.remove('tapped'); }, 4000);
      });
    });
  })();

  var curl = $('#curl');
  gift.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' && !e.target.closest('a,button')) curl.classList.add('open');
  });
  $('#flap').addEventListener('click', function () { show('back', 'turn'); });
  $$('[data-go]').forEach(wireGo);
  function wireGo(b) {
    b.addEventListener('click', function () {
      var id = b.dataset.go;
      if (id === screen) return;
      show(id, id === 'back' && screen === 'gift' ? 'turn' : 'fade');
    });
  }
  var copyBtn = $('#g-copy'), copyT = $('.t', copyBtn);
  copyBtn.addEventListener('click', function () {
    var c = code || '';
    var ok = function () { copyT.textContent = 'copied'; setTimeout(function () { copyT.textContent = 'copy the code'; }, 2400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(ok, function () { fallbackCopy(c) && ok(); });
    else if (fallbackCopy(c)) ok();
  });
  function fallbackCopy(text) {
    var t = el('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove(); return ok;
  }

  /* the newsprint's fonts start loading while the gift is up, so the page turn lands on finished type */
  var fontsAsked = false;
  function readyBoard() {
    if (fontsAsked || !document.fonts || !document.fonts.load) return;
    fontsAsked = true;
    ['16px bp-black', '900 16px bp-cond', '16px bp-script'].forEach(function (f) { document.fonts.load(f).catch(function () {}); });
  }

  /* ————— 3 · the back pages ————— */
  var board = $('#board'), ads = $('#ads'), endLine = $('#end'), onboard = $('#onboard'), art = $('#art'), couponPage = $('#coupon-page');
  var list = [], total = 0, loading = false, finished = false, opened = false;
  var EXAMPLES = [
    ['dance floor', '02:40', 'Found, one silver hoop', "You lost the other one. It's mine unless you come and get it."],
    ['lockers', '01:10', 'Mullet, Carhartt, silver chain', 'You laughed at the wrong moment. So did I. Come outside.'],
    ['bar', '00:20', 'Same drink, twice', 'Both times for me. The second one was yours.'],
    ['smoking area', '03:05', 'You asked for a lighter', "Keep it. I'll come and get it."]
  ].map(function (a) { return { place: a[0], at_time: a[1], headline: a[2], body: a[3], example: true }; });

  function openBoard() {
    readyBoard();
    if (opened) return;
    opened = true;
    /* the board's photos load now, not before (data-src) */
    $$('img[data-src]', back).forEach(function (img) {
      img.addEventListener('load', function () { img.classList.add('ok'); }, { once: true });
      img.src = img.getAttribute('data-src'); img.removeAttribute('data-src');
      if (img.complete && img.naturalWidth) img.classList.add('ok');
    });
    justIn();
    renderList();
    load(true);
    watchMore();
    watchJump();
  }

  /* the drawing is 680 wide; the page is narrower, so it is zoomed to fit (the ads below are at real size) */
  function layout() {
    if (back.hidden) return;
    var w = board.clientWidth;
    if (!w) return;
    var z = Math.min(1, w / 680);
    art.style.setProperty('--z', z);
    couponPage.style.setProperty('--z', z);
    $('.list', board).style.setProperty('--z', z);
    hint();
  }
  addEventListener('resize', layout);

  function adEl(a, inPoster) {
    var d = el('article', 'ad');
    var w = el('span', 'w', a.place + ' · ' + a.at_time);
    if (a.example) w.appendChild(el('span', 'ex', 'EXAMPLE'));
    d.appendChild(w);
    d.appendChild(el(inPoster ? 'span' : 'h3', 'h', a.headline));
    d.appendChild(el('p', 'b', a.body));
    var me = el('div', 'me');
    if (inPoster || a.example) {
      me.appendChild(el('span', 'u', "☎ That's me →"));
      me.appendChild(el('span', 'i', 'take this down'));
    } else {
      var u = el('button', 'u', "☎ That's me →"); u.type = 'button';
      var i = el('button', 'i', 'take this down'); i.type = 'button';
      u.addEventListener('click', function () { openMe(a); });
      i.addEventListener('click', function () { openDown(a); });
      me.appendChild(u); me.appendChild(i);
      d.dataset.id = a.id;
    }
    d.appendChild(me);
    return d;
  }
  function house() {
    var h = el('div', 'ad house');
    h.appendChild(el('span', 'wm', 'surr'));
    var p = el('p');
    p.appendChild(el('b', null, 'A word from our sponsor'));
    p.appendChild(document.createTextNode('The dating app for lesbians and sapphics in berlin. Invite-only, not in the App Store yet. Your wristband gets you in early.'));
    h.appendChild(p);
    var b = el('button', 'cta', 'the gift →'); b.type = 'button'; b.dataset.go = 'gift';
    wireGo(b);
    h.appendChild(b);
    return h;
  }
  /* the two "just in" boxes: the four newest ads, or the four examples until there is one real ad */
  function justIn() {
    var four = list.length ? list.slice(0, 4) : EXAMPLES;
    var a = $('#ja'), b = $('#jb');
    a.textContent = ''; b.textContent = '';
    four.slice(0, 2).forEach(function (x) { a.appendChild(adEl(x, true)); });
    four.slice(2, 4).forEach(function (x) { b.appendChild(adEl(x, true)); });
    /* the real ones are all in the list below at a readable size, so a screen reader hears them once */
    $$('.jb > div').forEach(function (d) { d.setAttribute('aria-hidden', list.length ? 'true' : 'false'); });
  }
  /* the list: newest first, surr's own ad third */
  function renderList() {
    ads.textContent = '';
    list.forEach(function (a, n) {
      if (n === 2) ads.appendChild(house());
      ads.appendChild(adEl(a));
    });
    if (list.length <= 2) ads.appendChild(house());
    setCount(total);
    endLine.hidden = !finished;
  }
  function appendAds(more) {
    more.forEach(function (a) { ads.appendChild(adEl(a)); });
    endLine.hidden = !finished;
  }
  var jumping = 0, asks = 0;
  function load(first) {
    if (!code) return;
    if (!first && (loading || finished || Date.now() < jumping)) { if (!first && Date.now() < jumping) setTimeout(recheck, 1600); return; }
    loading = true;
    var ask = ++asks;
    var before = first || !list.length ? null : list[list.length - 1].created_at;
    rpc('backpages_ads', { p_code: code, p_before: before }).then(function (j) {
      if (ask !== asks) return; /* a newer load (after placing an ad) replaced this one */
      loading = false;
      if (j && (j.error === 'bad_code' || j.error === 'not_open')) return backToEntrance(WORDS_E[j.error]);
      if (!j || j.error || !j.ads) return;
      total = j.total || 0;
      finished = j.ads.length < 30;
      if (first) { list = j.ads; renderList(); justIn(); }
      else {
        var known = {}; list.forEach(function (a) { known[a.id] = 1; });
        var fresh = j.ads.filter(function (a) { return !known[a.id]; });
        list = list.concat(fresh); appendAds(fresh); setCount(total);
      }
      hint();
      setTimeout(recheck, 50);
    }).catch(function () { if (ask === asks) loading = false; });
  }
  /* the observer only speaks when the end crosses into view; after a load (or a skipped one) look again */
  function recheck() {
    if (finished || loading || !opened || back.hidden) return;
    var end = $('#more-ads'), root = DESK.matches ? board : back;
    var r = end.getBoundingClientRect(), rr = root.getBoundingClientRect();
    if (r.top < rr.bottom + 700) load(false);
  }
  /* more ads as you near the end: the right-hand page scrolls on a desktop, the whole screen on a phone */
  var moreIO = null;
  function watchMore() {
    if (!('IntersectionObserver' in window)) return;
    if (moreIO) moreIO.disconnect();
    moreIO = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) load(false);
    }, { root: DESK.matches ? board : back, rootMargin: '0px 0px 700px 0px' });
    moreIO.observe($('#more-ads'));
  }
  if (DESK.addEventListener) DESK.addEventListener('change', function () { if (opened) { watchMore(); watchJump(); layout(); } });

  /* desktop: "scroll ↓" beside the board until it has been scrolled */
  var scrollhint = $('#scrollhint');
  function hint() { scrollhint.classList.toggle('away', board.scrollTop > 40 || board.scrollHeight <= board.clientHeight + 4); }
  board.addEventListener('scroll', hint, { passive: true });

  /* phone: "place an ad ↓" stays at the bottom and steps aside once the coupon is in view */
  var jump = $('#jump'), jumpIO = null;
  jump.addEventListener('click', function () {
    jumping = Date.now() + 1500;
    couponPage.scrollIntoView({ behavior: STILL.matches ? 'auto' : 'smooth', block: 'start' });
  });
  function watchJump() {
    if (!('IntersectionObserver' in window)) return;
    if (jumpIO) jumpIO.disconnect();
    jumpIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { jump.classList.toggle('away', e.isIntersecting); });
    }, { root: back, threshold: 0, rootMargin: '0px 0px -30% 0px' });
    jumpIO.observe(couponPage);
  }

  /* ————— placing an ad ————— */
  var WORDS = {
    has_contact: 'no names, numbers or @ in your ad.',
    too_long: "that's a bit long. keep it under 280.",
    bad_email: "that email doesn't look right.",
    banned: "that email can't place ads here.",
    no_more_replies: "this ad isn't taking more replies.",
    already_replied: "you've already answered this one.",
    not_found: "that ad's gone.",
    other: "that didn't go through. try again."
  };
  var TOO_MANY = {
    place: "that's a lot of ads from here. try again in an hour.",
    takedown: "one take-down an hour. if it's bad, someone else will get it.",
    thats_me: "that's a lot from here. try again in an hour."
  };
  function gone(j) {
    if (j && (j.error === 'bad_code' || j.error === 'not_open')) {
      $$('dialog').forEach(function (d) { if (d.open) close(d); });
      backToEntrance(WORDS_E[j.error]);
      return true;
    }
    return false;
  }
  function setCount(n) {
    onboard.textContent = String(n);
    $('#onboard-w').textContent = n === 1 ? 'ad' : 'ads';
  }
  function words(err, action) {
    if (err === 'too_many') return TOO_MANY[action] || WORDS.other;
    if (err === 'has_contact' && action === 'thats_me') return 'no names, numbers or @ in your note.';
    return WORDS[err] || WORDS.other;
  }
  function say(p, text) { p.textContent = text; p.hidden = !text; }

  var form = $('#placeform'), fMsg = $('#f-msg'), fGo = $('.go', form);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (fGo.disabled) return;
    say(fMsg, '');
    if (form.reportValidity && !form.reportValidity()) return;
    /* the first ad of a visit asks once: there's no moderator here */
    if (!store.get('bp.rules')) return rules(place);
    place();
  });
  function place() {
    var hp = form.website.value;
    var args = {
      p_code: code, p_place: (form.querySelector('input[name=place]:checked') || {}).value || '',
      p_time: form.time.value, p_headline: form.headline.value.trim(), p_body: form.body.value.trim(),
      p_email: form.email.value.trim().toLowerCase()
    };
    if (hp) args.p_hp = hp;
    fGo.disabled = true;
    rpc('backpages_place', args).then(function (j) {
      fGo.disabled = false;
      if (gone(j)) return;
      if (j && j.id) {
        say(fMsg, 'your ad is up.');
        var email = form.email.value;
        form.reset(); form.email.value = email;
        load(true);
        if (DESK.matches) board.scrollTo({ top: 0, behavior: STILL.matches ? 'auto' : 'smooth' });
        return;
      }
      say(fMsg, words(j && j.error, 'place'));
    }).catch(function () { fGo.disabled = false; say(fMsg, WORDS.other); });
  }
  var dRules = $('#d-rules');
  function rules(then) {
    open(dRules);
    var ok = $('[data-ok]', dRules);
    var go = function () { ok.removeEventListener('click', go); store.set('bp.rules', '1'); close(dRules); then(); };
    ok.addEventListener('click', go);
    dRules.addEventListener('close', function () { ok.removeEventListener('click', go); }, { once: true });
  }

  /* ————— the sheets ————— */
  function open(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function close(d) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  $$('dialog').forEach(function (d) {
    $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { close(d); }); });
    /* a tap on the dimmed page around the sheet closes it */
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(d);
    });
  });

  /* that's me */
  var dMe = $('#d-me'), meForm = $('#meform'), meMsg = $('.s-msg', meForm), meGo = $('.s-go', meForm), meAd = null, meBusy = false;
  function openMe(a) {
    meAd = a;
    $('#m-ad').textContent = a.headline;
    meForm.note.value = ''; say(meMsg, ''); meGo.disabled = meBusy; meGo.hidden = false;
    open(dMe);
    meForm.note.focus();
  }
  meForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (meGo.disabled || meBusy || !meAd) return;
    say(meMsg, '');
    if (meForm.reportValidity && !meForm.reportValidity()) return;
    var hp = meForm.website.value;
    var ad = meAd;
    var args = { p_code: code, p_id: ad.id, p_note: meForm.note.value.trim(), p_email: meForm.email.value.trim().toLowerCase() };
    if (hp) args.p_hp = hp;
    meGo.disabled = true; meBusy = true;
    rpc('backpages_thats_me', args).then(function (j) {
      meBusy = false;
      if (gone(j)) return;
      if (j && j.error === 'not_found') drop(ad.id);
      if (meAd !== ad) { meGo.disabled = false; return; } /* the sheet moved on to another ad */
      if (j && j.ok) { meGo.hidden = true; say(meMsg, 'sent. if they write back, it comes to your email.'); return; }
      meGo.disabled = false;
      say(meMsg, words(j && j.error, 'thats_me'));
    }).catch(function () { meBusy = false; meGo.disabled = false; if (meAd === ad) say(meMsg, WORDS.other); });
  });

  /* take this down */
  var dDown = $('#d-down'), downMsg = $('.s-msg', dDown), downYes = $('[data-yes]', dDown), downRow = $('.s-row', dDown), downAd = null, downBusy = false, downTimer = 0;
  function openDown(a) {
    clearTimeout(downTimer);
    downAd = a; say(downMsg, ''); downRow.hidden = false; downYes.disabled = downBusy;
    open(dDown);
    downYes.focus();
  }
  downYes.addEventListener('click', function () {
    if (downYes.disabled || downBusy || !downAd) return;
    downYes.disabled = true; downBusy = true;
    var ad = downAd, id = ad.id;
    rpc('backpages_takedown', { p_code: code, p_id: id }).then(function (j) {
      downBusy = false;
      if (gone(j)) return;
      if (j && (j.ok || j.error === 'not_found')) drop(id);
      if (downAd !== ad) { downYes.disabled = false; return; } /* the sheet moved on to another ad */
      if (j && j.ok) {
        downRow.hidden = true; say(downMsg, 'taken down.');
        downTimer = setTimeout(function () { close(dDown); }, 1400);
        return;
      }
      downYes.disabled = false;
      if (j && j.error === 'not_found') downRow.hidden = true;
      say(downMsg, words(j && j.error, 'takedown'));
    }).catch(function () { downBusy = false; downYes.disabled = false; if (downAd === ad) say(downMsg, WORDS.other); });
  });
  /* an ad that's gone leaves the board for this visitor straight away */
  function drop(id) {
    var before = list.length;
    list = list.filter(function (a) { return a.id !== id; });
    if (list.length < before) total = Math.max(0, total - 1);
    renderList(); justIn();
  }

  /* the code stopped working (changed, or the board switched off): back to the band, with its line */
  function backToEntrance(words) {
    code = null; store.del('bp.code'); store.del('bp.screen');
    moves++; asks++;
    /* the board starts over the next time the page turns */
    opened = false; list = []; total = 0; finished = false; loading = false;
    if (moreIO) moreIO.disconnect();
    if (jumpIO) jumpIO.disconnect();
    [gift, back].forEach(function (s) { s.hidden = true; });
    topband.hidden = true;
    entrance.hidden = false; screen = 'entrance';
    eBand.classList.remove('snap');
    eMsg.textContent = words;
    $('#e-h').focus({ preventScroll: true });
  }

  /* ————— start ————— */
  if (code) {
    show(store.get('bp.screen') === 'back' ? 'back' : 'gift', 'start');
    entrance.hidden = true;
  } else {
    screen = 'entrance';
    count('entrance');
    if (window.matchMedia('(pointer:fine)').matches) eCode.focus({ preventScroll: true });
  }
})();
