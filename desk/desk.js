/* the desk. talks only to the surr project in config.js: the auth server for
   the email code, and the `desk` function for everything else. it holds the
   public key and the signed-in person's own session, nothing more — every
   power is checked on the server. all text goes in as text, never as markup. */
(function () {
  'use strict';

  var CFG = window.DESK;
  var BASE = CFG.SUPABASE_URL.replace(/\/$/, '');
  var KEY = CFG.SUPABASE_ANON_KEY;
  var STORE = 'surr.desk.session';
  var TZ = 'Europe/Berlin';
  var UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  var SIGNED = BASE + '/storage/v1/object/sign/';
  var app = document.getElementById('app');

  var COPY = {
    failed: "that didn't go through. try again.",
    empty: 'nothing waiting.',
    gone: 'someone who has left',
    emailFailed: "the email didn't go out. nothing was sent.",
  };
  var TITLES = { applications: 'applications', reports: 'reports', list: 'the list', feedback: 'feedback' };

  /* ---------- tiny dom ---------- */

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  var gen = 0; // bumped per screen load; a late answer for an older screen is dropped
  function show() {
    app.textContent = '';
    for (var i = 0; i < arguments.length; i++) add(app, arguments[i]);
    window.scrollTo(0, 0);
  }
  // Only signed links from our own project ever become an image.
  function safeImg(url) {
    return typeof url === 'string' && url.indexOf(SIGNED) === 0 ? url : null;
  }

  /* ---------- time, in berlin ---------- */

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];
  var DAYS = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' };
  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  function parts(ts) {
    var o = {};
    fmt.formatToParts(new Date(ts)).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function day(ts) {
    var p = parts(ts);
    return p.day + ' ' + MONTHS[Number(p.month) - 1];
  }
  function clock(ts) {
    var p = parts(ts);
    return (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
  }
  function stamp(ts) { return day(ts) + ' ' + clock(ts); }
  function today() {
    var p = parts(Date.now());
    return (DAYS[p.weekday] || p.weekday.toLowerCase()) + ' ' + day(Date.now());
  }
  function since(ts) {
    var m = Math.max(1, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
    if (m < 60) return m + ' min';
    var hrs = Math.round(m / 60);
    if (hrs < 48) return hrs + 'h';
    return Math.round(hrs / 24) + ' days';
  }
  function ordinal(n) {
    var t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  }
  function at(handle) { return handle ? '@' + handle : COPY.gone; }

  /* ---------- session ---------- */

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  function save(s) {
    try {
      if (s) localStorage.setItem(STORE, JSON.stringify(s));
      else localStorage.removeItem(STORE);
    } catch (e) { /* private mode: signed in for this visit only */ }
    session = s;
  }
  var session = load();
  var Expired = new Error('expired');
  var NotMine = new Error('not_member');

  function auth(path, body, token) {
    var headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(BASE + '/auth/v1/' + path, {
      method: 'POST', headers: headers, body: JSON.stringify(body || {}), credentials: 'omit',
    });
  }
  function keep(data) {
    if (!data || !data.access_token || !data.refresh_token) throw new Error('no session');
    save({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    });
  }
  // Another tab may have refreshed already: always start from what is stored.
  // Only the auth server saying no (400/401) ends the login; a network blip
  // is just a failure to try again.
  function fresh() {
    var stored = load();
    if (stored) session = stored;
    if (!session) return Promise.reject(Expired);
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(session.access_token);
    var used = session.refresh_token;
    return auth('token?grant_type=refresh_token', { refresh_token: used })
      .then(function (r) {
        if (r.status === 400 || r.status === 401) {
          var now = load();
          if (now && now.refresh_token !== used) { session = now; return null; }
          throw Expired;
        }
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then(function (d) { if (d) keep(d); return session.access_token; });
  }

  // One call to the desk function. `expired` → the login, `not_member` → "this
  // desk isn't yours."; anything else throws for the caller to say it failed.
  function desk(action, extra) {
    var body = Object.assign({ action: action }, extra || {});
    return fresh()
      .then(function (token) {
        return fetch(BASE + '/functions/v1/desk', {
          method: 'POST',
          headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'omit',
        });
      })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 || j.error === 'expired') throw Expired;
          if (r.status === 403 && j.error === 'not_member') throw NotMine;
          if (!r.ok) throw new Error(j.error || 'failed');
          return j.data;
        });
      });
  }
  // Route the two special failures; everything else is the caller's.
  function guard(err) {
    if (err === Expired) { save(null); login(); return true; }
    if (err === NotMine) { notMine(); return true; }
    return false;
  }

  /* ---------- the ask-first sheet ---------- */

  var sheet = document.getElementById('sheet');
  function ask(question, yes, no) {
    return new Promise(function (resolve) {
      document.getElementById('sheet-q').textContent = question;
      var y = document.getElementById('sheet-yes');
      var n = document.getElementById('sheet-no');
      y.textContent = yes;
      n.textContent = no;
      function done(v) {
        sheet.hidden = true;
        y.onclick = n.onclick = sheet.onclick = null;
        document.onkeydown = null;
        resolve(v);
      }
      y.onclick = function () { done(true); };
      n.onclick = function () { done(false); };
      sheet.onclick = function (e) { if (e.target === sheet) done(false); };
      document.onkeydown = function (e) { if (e.key === 'Escape') done(false); };
      sheet.hidden = false;
      n.focus();
    });
  }

  /* ---------- login ---------- */

  function login() {
    ++gen;
    var email = '';
    var msg = h('p', { class: 'line', hidden: true });
    var emailIn = h('input', { id: 'email', type: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', required: true });
    var codeIn = h('input', { id: 'code', class: 'code', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]*', maxlength: '6', required: true });
    var codeForm = h('form', { class: 'form', hidden: true },
      h('label', { for: 'code', text: 'code' }), codeIn,
      h('button', { class: 'btn go', type: 'submit', text: 'open' }));
    var emailForm = h('form', { class: 'form' },
      h('label', { for: 'email', text: 'email' }), emailIn,
      h('button', { class: 'btn go', type: 'submit', text: 'send code' }));

    emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      email = emailIn.value.trim().toLowerCase();
      if (!email) return;
      // The same line whatever happens: nobody learns whether an email is a desk's.
      auth('otp', { email: email, create_user: false }).catch(function () {}).then(function () {
        msg.textContent = "if that's a desk email, a code is on its way.";
        msg.className = 'line';
        msg.hidden = false;
        codeForm.hidden = false;
        codeIn.focus();
      });
    });
    codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var token = codeIn.value.replace(/\D/g, '');
      auth('verify', { type: 'email', email: email, token: token })
        .then(function (r) { if (!r.ok) throw new Error('bad code'); return r.json(); })
        .then(function (d) { keep(d); route(); })
        .catch(function () {
          msg.textContent = "that didn't work. try again.";
          msg.className = 'line err';
          msg.hidden = false;
        });
    });

    show(h('div', { class: 'bar' }, h('span', { class: 'name', text: 'the desk' })),
      emailForm, msg, codeForm);
    emailIn.focus();
  }

  function signOut() {
    fresh().then(function (token) { return auth('logout?scope=local', {}, token); })
      .catch(function () {})
      .then(function () {
        save(null);
        if (location.hash) history.replaceState(null, '', location.pathname);
        login();
      });
  }
  function signOutLink() {
    return h('button', { class: 'link', type: 'button', text: 'sign out', onclick: signOut });
  }

  function notMine() {
    show(h('div', { class: 'bar' }, h('span', { class: 'name', text: 'the desk' })),
      h('p', { class: 'line err', text: "this desk isn't yours." }),
      h('div', { class: 'foot' }, signOutLink()));
  }

  function failed(retry) {
    show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' })),
      h('p', { class: 'line err', text: COPY.failed }),
      retry ? h('div', { class: 'acts left' }, h('button', { class: 'btn', type: 'button', text: 'try again', onclick: retry })) : null);
  }

  /* ---------- history lines ---------- */

  function sentence(l) {
    var who = l.member + ' ';
    switch (l.action) {
      case 'approve': return who + 'approved ' + at(l.handle);
      case 'decline': return who + 'declined an application';
      case 'freeze': return who + 'froze ' + at(l.handle);
      case 'lift': return who + 'lifted the freeze on ' + at(l.handle);
      case 'dismiss': return who + 'dismissed a report about ' + at(l.handle);
      case 'remove': return who + 'removed someone from surr';
      case 'send': return who + 'sent a code to someone on the list';
      case 'pass': return who + 'passed on someone on the list';
      case 'done': return who + 'marked feedback from ' + at(l.handle) + ' done';
      case 'keep': return who + 'kept a quote from ' + at(l.handle);
      case 'takedown': return who + 'took a quote down';
      default: return who + l.action;
    }
  }

  /* ---------- home ---------- */

  function home() {
    var my = ++gen;
    desk('home').then(function (d) {
      if (my !== gen) return;
      var rep = d.reports, apps = d.applications, list = d.list, fb = d.feedback;
      function pile(title, n, lineText, hot, go) {
        var zero = !n;
        return h('button', { class: 'pile' + (zero ? ' zero' : ''), type: 'button', disabled: !go, onclick: go },
          h('div', { class: 't' }, h('strong', { text: title }), h('span', { text: lineText })),
          n == null ? null : h('div', { class: 'n' + (hot && n ? ' hot' : ''), text: String(n) }));
      }
      var frozen = (d.frozen || []).map(function (f) {
        return h('div', { class: 'row' },
          h('div', { class: 't' },
            h('strong', { text: at(f.handle) }),
            h('span', { text: 'frozen ' + (f.since ? day(f.since) + ' · ' : '') + (f.reason === 'admin' ? 'by the desk' : 'reports') })),
          h('button', { class: 'link', type: 'button', text: 'lift the freeze', onclick: function (e) {
            e.target.disabled = true;
            desk('lift', { profile: f.profile_id }).then(function () { if (my === gen) home(); }).catch(function (err) {
              if (my === gen && !guard(err)) failed(home);
            });
          } }));
      });
      var todayLines = (d.today || []).map(function (l) {
        return h('div', { text: clock(l.at) + ' · ' + sentence(l) });
      });
      show(
        h('div', { class: 'bar' }, h('span', { class: 'name', text: 'the desk' }), h('span', { text: today() })),
        pile('reports', rep.count, rep.count ? 'waiting ' + since(rep.oldest) : 'nothing waiting', true, function () { location.hash = 'reports'; }),
        pile('applications', apps.count, apps.count ? 'oldest ' + since(apps.oldest) + ' ago' : 'nothing waiting', false, function () { location.hash = 'applications'; }),
        pile('the list', list.count, list.count ? list.new + ' new since yesterday' : 'nothing waiting', false, function () { location.hash = 'list'; }),
        pile('feedback', fb.count,
          fb.takedowns ? fb.takedowns + (fb.takedowns === 1 ? ' quote' : ' quotes') + ' to take down'
            : fb.count ? 'oldest ' + since(fb.oldest) + ' ago' : 'nothing waiting',
          false, function () { location.hash = 'feedback'; }),
        h('div', { class: 'kick', text: '// quotes' }),
        h('div', { class: 'acts left' }, h('a', { class: 'link', href: '#quotes', text: d.quotes + ' kept →' })),
        frozen.length ? [h('div', { class: 'kick', text: '// frozen' }), frozen] : null,
        todayLines.length ? [h('div', { class: 'kick', text: '// handled today' }), h('div', { class: 'log' }, todayLines)] : null,
        h('div', { class: 'grow' }),
        h('div', { class: 'foot' },
          h('span', { class: 'links' },
            h('a', { class: 'link', href: '#cities', text: 'the list by city →' }),
            h('a', { class: 'link', href: '#history', text: 'all history →' })),
          signOutLink()));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(home); });
  }

  /* ---------- history ---------- */

  function historyView() {
    var my = ++gen;
    var rows = h('div', { class: 'log' });
    var more = h('button', { class: 'link', type: 'button', text: 'more', hidden: true });
    var last = null;
    function page() {
      more.hidden = true;
      desk('history', last ? { before: last } : {}).then(function (list) {
        if (my !== gen) return;
        (list || []).forEach(function (l) {
          add(rows, h('div', { text: stamp(l.at) + ' · ' + sentence(l) }));
          last = l.at;
        });
        more.hidden = !list || list.length < 100;
        if (!rows.childNodes.length) add(rows, h('div', { text: 'nothing yet.' }));
      }).catch(function (err) { if (my === gen && !guard(err)) failed(historyView); });
    }
    more.onclick = page;
    show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: 'history' })),
      rows, h('div', { class: 'acts left' }, more));
    page();
  }

  /* ---------- the list by city ---------- */

  // Counted live each time it opens; counts only, never an address.
  function citiesView() {
    var my = ++gen;
    desk('cities').then(function (list) {
      if (my !== gen) return;
      var rows = (list || []).map(function (c) {
        var bits = [c.city || 'no city'];
        if (c.on_list) bits.push(c.on_list + ' on the list');
        if (c.sent) bits.push(c.sent + ' sent a code');
        return h('div', { text: bits.join(' · ') });
      });
      show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: 'the list by city' })),
        h('div', { class: 'log' }, rows.length ? rows : h('div', { text: 'nobody on the list yet.' })));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(citiesView); });
  }

  /* ---------- a pile, one at a time ---------- */

  // pile: 'applications' | 'reports' | 'list' | 'feedback'. queue: ids (for
  // feedback, items: a take-down with its words, or a note's id). pos: where we are.
  var run = null;

  function openPile(pile) {
    var my = ++gen;
    desk(pile).then(function (ids) {
      if (my !== gen) return;
      run = { pile: pile, queue: ids || [], pos: 0, single: false };
      next();
    }).catch(function (err) { if (my === gen && !guard(err)) failed(function () { openPile(pile); }); });
  }
  function openOne(pile, id) {
    run = { pile: pile, queue: [id], pos: 0, single: true };
    next();
  }
  // After an action or `later`: the next one; after a deep-linked item, the
  // rest of its pile.
  function advance() {
    Array.prototype.forEach.call(app.querySelectorAll('button'), function (b) { b.disabled = true; });
    if (run.single) { location.hash = run.pile; return; }
    run.pos += 1;
    next();
  }
  function next() {
    if (run.pos >= run.queue.length) {
      show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: TITLES[run.pile] })),
        h('p', { class: 'line', text: COPY.empty }),
        h('div', { class: 'acts left' }, h('a', { class: 'link', href: '#', text: '‹ the desk' })));
      return;
    }
    var id = run.queue[run.pos];
    ({ applications: application, reports: report, list: person, feedback: feedbackItem })[run.pile](id);
  }
  function counter() {
    return run.single ? '' : (run.pos + 1) + ' of ' + run.queue.length;
  }
  function itemBar() {
    return h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: counter() }));
  }
  function later() {
    return run.single ? null : h('button', { class: 'link', type: 'button', text: 'later', onclick: advance });
  }
  // Run an action; buttons are disabled while it goes; a failure says so in place.
  function act(buttons, note, call) {
    var my = gen;
    buttons.forEach(function (b) { b.disabled = true; });
    note.hidden = true;
    call().then(function () { if (my === gen) advance(); }).catch(function (err) {
      if (my !== gen || guard(err)) return;
      buttons.forEach(function (b) { b.disabled = false; });
      note.textContent = COPY.failed;
      note.hidden = false;
    });
  }
  function photo(url, label, big) {
    var src = safeImg(url);
    return h(src ? 'a' : 'div', { class: 'ph' + (big ? ' big' : ''), href: src, target: src ? '_blank' : null, rel: src ? 'noopener noreferrer' : null },
      src ? h('img', { src: src, alt: label }) : null, h('span', { text: label }));
  }

  function application(id) {
    var my = ++gen;
    desk('application', { id: id }).then(function (a) {
      if (my !== gen) return;
      if (!a) { advance(); return; }
      if (a.state !== 'waiting') {
        show(itemBar(), h('p', { class: 'line', text: a.state + ' by ' + (a.decided_by || 'email-link') + ' · ' + stamp(a.decided_at) }),
          h('div', { class: 'acts left' }, run.single ? h('a', { class: 'link', href: '#applications', text: 'applications →' }) : later()));
        return;
      }
      var photos = [photo(a.selfie_url, 'selfie', true)].concat((a.photo_urls || []).map(function (u, i) {
        return photo(u, 'photo ' + (i + 1), false);
      }));
      var ident = [a.age, (a.identity || []).join(', '), a.kiez || a.city].filter(function (x) { return x !== null && x !== undefined && x !== ''; }).join(' · ');
      var codeLine = a.code
        ? ['code ', h('b', { text: a.code })].concat(a.from_handle ? [' · from ', h('b', { text: '@' + a.from_handle })] : a.from_label ? [' · from ', h('b', { text: a.from_label })] : [])
        : ['no code'];
      var note = h('p', { class: 'line err', hidden: true });
      var approve = h('button', { class: 'btn go', type: 'button', text: 'approve' });
      var decline = h('button', { class: 'btn', type: 'button', text: 'decline' });
      approve.onclick = function () {
        act([approve, decline], note, function () { return desk('decide', { id: a.id, decision: 'approved' }); });
      };
      decline.onclick = function () {
        ask('decline @' + a.handle + '? her application is erased.', 'decline', 'keep').then(function (yes) {
          if (yes) act([approve, decline], note, function () { return desk('decide', { id: a.id, decision: 'declined' }); });
        });
      };
      show(itemBar(),
        h('div', { class: 'photos' }, photos),
        h('div', { class: 'who' }, h('strong', { text: '@' + a.handle }), h('span', { text: ident })),
        h('div', { class: 'facts' }, h('div', null, codeLine), h('div', { text: 'applied ' + since(a.applied_at) + ' ago' })),
        h('div', { class: 'grow' }),
        note,
        h('div', { class: 'acts dock' }, approve, decline, later()));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(function () { application(id); }); });
  }

  var FROZEN_BY = { reports: 'reports', admin: 'by the desk', self: 'by herself' };
  var HANDLED = { freeze: 'frozen', dismiss: 'dismissed', remove: 'removed' };

  function chatText(m) {
    if (m.kind === 'text') return m.body || '';
    if (m.kind === 'link_up') return '[date]';
    if (m.kind === 'happening') return m.body && m.body.indexOf('storm:') === 0 ? '[storm]' : '[happening]';
    return '[' + m.kind + ']';
  }

  // A link that opens a section in place (collapsed until tapped).
  function fold(label, body) {
    var box = h('div', { class: 'more', hidden: true }, body);
    var btn = h('button', { class: 'link', type: 'button', 'aria-expanded': 'false', text: label });
    btn.onclick = function () {
      box.hidden = !box.hidden;
      btn.setAttribute('aria-expanded', String(!box.hidden));
    };
    return { btn: btn, box: box };
  }

  function report(id) {
    var my = ++gen;
    desk('report', { id: id }).then(function (r) {
      if (my !== gen) return;
      if (!r) { advance(); return; }
      var p = r.reported;
      var face = safeImg((p.photo_urls || [])[0]);
      var head = h('div', { class: 'row' },
        face ? h('img', { class: 'face', src: face, alt: '' }) : h('div', { class: 'face' }),
        h('div', { class: 't' }, h('strong', { text: at(p.handle) }), h('span', { text: 'reported · member since ' + day(p.since) })),
        h('span', { class: 'tag hot', text: ordinal(r.nth) + ' report' }));
      var facts = h('div', { class: 'facts' },
        h('div', null, 'reason ', h('b', { text: r.reason })),
        h('div', null, 'by ', h('b', { text: at(r.reporter) }), ' · ' + since(r.at) + ' ago'));
      var frozenLine = p.account_state === 'frozen'
        ? h('p', { class: 'line', text: 'she is frozen (' + (FROZEN_BY[p.frozen_reason] || p.frozen_reason) + ').' })
        : null;

      var folds = [];
      if ((r.messages || []).length) {
        folds.push(fold('the messages', r.messages.map(function (m) {
          return h('div', { class: 'msg' },
            h('div', null, at(m.sender) + ' · ' + stamp(m.at), m.reported ? h('em', { text: ' · reported' }) : null),
            h('div', { text: chatText(m) }));
        })));
      }
      if (p.handle) {
        folds.push(fold('her profile', [
          (p.photo_urls || []).length ? h('div', { class: 'photos small' }, p.photo_urls.map(function (u, i) { return photo(u, 'photo ' + (i + 1), false); })) : null,
          p.bio ? h('div', { class: 'quote', text: p.bio }) : null,
        ]));
      }
      if ((r.earlier || []).length) {
        folds.push(fold('earlier reports', r.earlier.map(function (e) {
          return h('div', { class: 'msg' },
            h('div', { text: day(e.at) + ' · by ' + at(e.by) + ' · ' + e.state }),
            h('div', { text: e.reason }));
        })));
      }

      var bottom;
      if (r.state !== 'open') {
        var hd = r.handled;
        bottom = [h('p', { class: 'line', text: hd ? HANDLED[hd.action] + ' by ' + hd.member + ' · ' + stamp(hd.at) : r.state }),
          h('div', { class: 'acts left' }, run.single ? h('a', { class: 'link', href: '#reports', text: 'reports →' }) : later())];
      } else if (r.own) {
        bottom = h('div', { class: 'acts dock' }, later());
      } else {
        var note = h('p', { class: 'line err', hidden: true });
        var frozenByDesk = p.account_state === 'frozen' && (p.frozen_reason === 'admin' || p.frozen_reason === 'reports');
        var main = frozenByDesk
          ? h('button', { class: 'btn', type: 'button', text: 'lift the freeze' })
          : h('button', { class: 'btn red', type: 'button', text: 'freeze her account' });
        var dismiss = h('button', { class: 'btn', type: 'button', text: 'dismiss' });
        var remove = h('button', { class: 'btn', type: 'button', text: 'remove from surr' });
        if (!p.handle) { main.hidden = true; remove.hidden = true; }
        var all = [main, dismiss, remove];
        main.onclick = function () {
          if (frozenByDesk) {
            // Lifting leaves the report open: show it again with freeze back.
            all.forEach(function (b) { b.disabled = true; });
            desk('lift', { profile: p.id, report: r.id }).then(function () { if (my === gen) report(id); }).catch(function (err) {
              if (my !== gen || guard(err)) return;
              all.forEach(function (b) { b.disabled = false; });
              note.textContent = COPY.failed;
              note.hidden = false;
            });
            return;
          }
          ask('freeze @' + p.handle + "? she can't use surr until you lift it.", 'freeze', 'cancel').then(function (yes) {
            if (yes) act(all, note, function () { return desk('freeze', { id: r.id }); });
          });
        };
        dismiss.onclick = function () { act(all, note, function () { return desk('dismiss', { id: r.id }); }); };
        remove.onclick = function () {
          ask('remove @' + p.handle + " from surr? her account is erased and her handle is gone for good. this can't be undone.", 'remove', 'cancel').then(function (yes) {
            if (yes) act(all, note, function () { return desk('remove', { id: r.id }); });
          });
        };
        bottom = [note, h('div', { class: 'acts dock' }, main, dismiss, remove, later())];
      }

      show(itemBar(), head, facts, frozenLine,
        r.detail ? h('div', { class: 'quote', text: r.detail }) : null,
        folds.length ? h('div', { class: 'acts left' }, folds.map(function (f) { return f.btn; })) : null,
        folds.map(function (f) { return f.box; }),
        h('div', { class: 'grow' }),
        bottom);
    }).catch(function (err) { if (my === gen && !guard(err)) failed(function () { report(id); }); });
  }

  /* ---------- the list: one person at a time ---------- */

  // Her link, as she typed it: a web address (with https://, www. or a path),
  // or an instagram handle (lou.berlin is a handle, not a site). Only http(s)
  // ever becomes a link; anything else is shown as plain text.
  function linkHref(v) {
    var s = String(v || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\.[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(s)) return 'https://' + s;
    var handle = s.replace(/^@/, '');
    return /^[a-z0-9._]{1,30}$/i.test(handle) ? 'https://www.instagram.com/' + handle + '/' : null;
  }

  function person(id) {
    var my = ++gen;
    desk('person', { id: id }).then(function (p) {
      if (my !== gen) return;
      if (!p) { advance(); return; }
      if (p.state !== 'waiting') {
        show(itemBar(), h('p', { class: 'line', text: 'code sent by ' + (p.sent_by || '') + ' · ' + (p.sent_at ? stamp(p.sent_at) : '') }),
          h('div', { class: 'acts left' }, later()));
        return;
      }
      var href = p.link ? linkHref(p.link) : null;
      var linkBit = !p.link ? 'no link'
        : href ? h('a', { class: 'link', href: href, target: '_blank', rel: 'noopener noreferrer', text: p.link })
        : h('b', { text: p.link });
      var note = h('p', { class: 'line err', hidden: true });
      // A returning person (sent a code before, unused, asked again) gets
      // the same code again: the button says so. A coded person already holds
      // a code: no send button at all (the server refuses her too).
      var send = h('button', { class: 'btn go', type: 'button', text: p.again ? 'send it again' : 'send a code', disabled: !p.can_send });
      var pass = h('button', { class: 'btn', type: 'button', text: 'not now' });
      send.onclick = function () {
        var mine = gen;
        send.disabled = pass.disabled = true;
        note.hidden = true;
        desk('send', { id: p.id }).then(function () {
          if (mine !== gen) return;
          note.textContent = 'code sent.';
          note.className = 'line';
          note.hidden = false;
          setTimeout(function () { if (mine === gen) advance(); }, 1200);
        }).catch(function (err) {
          if (mine !== gen || guard(err)) return;
          function again(text) {
            send.disabled = pass.disabled = false;
            note.textContent = text;
            note.className = 'line err';
            note.hidden = false;
          }
          if (err && err.message === 'email_failed') { again(COPY.emailFailed); return; }
          // The answer was lost, not necessarily the send: look again before
          // offering the button, so a code that went out is never sent twice.
          desk('person', { id: p.id }).then(function (now) {
            if (mine !== gen) return;
            if (now && now.state === 'sent') {
              note.textContent = 'code sent.';
              note.className = 'line';
              note.hidden = false;
              setTimeout(function () { if (mine === gen) advance(); }, 1200);
            } else {
              again(COPY.failed);
            }
          }).catch(function (e2) { if (mine === gen && !guard(e2)) again(COPY.failed); });
        });
      };
      pass.onclick = function () {
        act([send, pass], note, function () { return desk('pass', { id: p.id }); });
      };
      show(itemBar(),
        h('div', { class: 'who' }, h('strong', { text: p.email })),
        h('div', { class: 'facts' }, h('div', null, p.city || '', ' · ', 'joined ' + day(p.joined), ' · ', linkBit),
          p.again ? h('div', null, 'sent a code ' + day(p.sent_at) + ' · not used · asked again ' + day(p.asked_again_at)) : null,
          p.coded ? h('div', null, 'coded · already has a code') : null),
        h('div', { class: 'grow' }),
        p.coded || p.can_send ? null : h('p', { class: 'line', text: 'no link to the app yet.' }),
        note,
        h('div', { class: 'acts dock' }, p.coded ? null : send, pass));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(function () { person(id); }); });
  }

  /* ---------- feedback: one note (or take-down) at a time ---------- */

  var QUOTE_WISH = { username: 'quote me, with my name', anonymous: 'quote me, no name' };

  function feedbackItem(item) {
    if (item && item.kind === 'takedown') { takedown(item); return; }
    note(item && item.id);
  }

  function takedown(item) {
    ++gen;
    var msg = h('p', { class: 'line err', hidden: true });
    var done = h('button', { class: 'btn go', type: 'button', text: 'done' });
    done.onclick = function () {
      act([done], msg, function () { return desk('takedown', { id: item.id }); });
    };
    show(itemBar(),
      h('div', { class: 'who' }, h('strong', { text: 'take this quote down' })),
      h('p', { class: 'line', text: 'she has left surr. remove it from the website, then tap done.' }),
      h('div', { class: 'quote it', text: item.words || '' }),
      h('div', { class: 'grow' }),
      msg,
      h('div', { class: 'acts dock' }, done));
  }

  function note(id) {
    var my = ++gen;
    desk('note', { id: id }).then(function (n) {
      if (my !== gen) return;
      if (!n || n.state !== 'new') { advance(); return; }
      var compliment = n.category === 'compliment';
      var wish = compliment ? QUOTE_WISH[n.quote] : null;
      var meta = [since(n.at) + ' ago', n.app_version ? 'build ' + n.app_version : null].filter(Boolean).join(' · ');
      var shot = safeImg(n.screenshot_url);
      var msg = h('p', { class: 'line err', hidden: true });
      var keep = wish ? h('button', { class: 'btn go', type: 'button', text: 'keep as a quote' }) : null;
      var done = h('button', { class: 'btn' + (wish ? '' : ' go'), type: 'button', text: 'done' });
      var all = [keep, done].filter(Boolean);
      if (keep) keep.onclick = function () { act(all, msg, function () { return desk('keep', { id: n.id }); }); };
      done.onclick = function () { act(all, msg, function () { return desk('done', { id: n.id }); }); };
      show(itemBar(),
        h('div', { class: 'row' },
          h('div', { class: 't' }, h('strong', { text: at(n.handle) }), h('span', { text: meta })),
          h('span', { class: 'tag', text: n.category })),
        wish ? h('p', { class: 'line', text: wish }) : null,
        h('div', { class: 'quote' + (compliment ? ' it' : ''), text: n.body }),
        shot ? h('a', { class: 'ph shot', href: shot, target: '_blank', rel: 'noopener noreferrer' },
          h('img', { src: shot, alt: 'screenshot' }), h('span', { text: 'screenshot' })) : null,
        h('div', { class: 'grow' }),
        msg,
        h('div', { class: 'acts dock' }, all));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(function () { note(id); }); });
  }

  /* ---------- kept quotes ---------- */

  // The older select-and-copy first, while the tap still counts; the
  // clipboard only when that is refused.
  function copyText(text) {
    return copyOld(text).catch(function () {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
      throw new Error('copy');
    });
  }
  function copyOld(text) {
    return new Promise(function (resolve, reject) {
      var t = h('textarea', { readonly: true, class: 'offscreen' });
      t.value = text;
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(t);
      if (ok) resolve(); else reject(new Error('copy'));
    });
  }

  function quotesView() {
    var my = ++gen;
    desk('quotes').then(function (list) {
      if (my !== gen) return;
      var rows = (list || []).map(function (q) {
        var credit = q.credit ? '@' + q.credit : 'no name';
        var btn = h('button', { class: 'btn', type: 'button', text: 'copy' });
        btn.onclick = function () {
          copyText(q.credit ? q.words + '\n— @' + q.credit : q.words).then(function () {
            btn.textContent = 'copied';
            setTimeout(function () { btn.textContent = 'copy'; }, 1500);
          }).catch(function () { /* nothing copied; the button stays `copy` */ });
        };
        return h('div', { class: 'kept' },
          h('div', { class: 'quote it', text: q.words }),
          h('div', { class: 'acts left' }, h('span', { class: 'credit', text: credit }), btn));
      });
      show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: 'quotes' })),
        rows.length ? rows : h('p', { class: 'line', text: 'nothing yet.' }));
    }).catch(function (err) { if (my === gen && !guard(err)) failed(quotesView); });
  }

  /* ---------- routing ---------- */

  var DEEP = new RegExp('^#(application|report)-(' + UUID + ')$');
  function route() {
    if (!sheet.hidden) document.getElementById('sheet-no').click();
    if (!session) { login(); return; }
    var hash = location.hash;
    var m = DEEP.exec(hash);
    if (m) openOne(m[1] + 's', m[2]);
    else if (/^#(applications|reports|list|feedback)$/.test(hash)) openPile(hash.slice(1));
    else if (hash === '#quotes') quotesView();
    else if (hash === '#history') historyView();
    else if (hash === '#cities') citiesView();
    else home();
  }
  window.addEventListener('hashchange', route);
  route();
})();
