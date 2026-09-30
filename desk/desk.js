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
  };

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
        resolve(v);
      }
      y.onclick = function () { done(true); };
      n.onclick = function () { done(false); };
      sheet.onclick = function (e) { if (e.target === sheet) done(false); };
      document.onkeydown = function (e) { if (e.key === 'Escape') { document.onkeydown = null; done(false); } };
      sheet.hidden = false;
      n.focus();
    });
  }

  /* ---------- login ---------- */

  function login() {
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
      default: return who + l.action;
    }
  }

  /* ---------- home ---------- */

  function home() {
    var my = ++gen;
    desk('home').then(function (d) {
      if (my !== gen) return;
      var rep = d.reports, apps = d.applications;
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
            desk('lift', { profile: f.profile_id }).then(home).catch(function (err) {
              if (!guard(err)) failed(home);
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
        pile('the list', null, 'soon', false, null),
        pile('feedback', null, 'soon', false, null),
        frozen.length ? [h('div', { class: 'kick', text: '// frozen' }), frozen] : null,
        todayLines.length ? [h('div', { class: 'kick', text: '// handled today' }), h('div', { class: 'log' }, todayLines)] : null,
        h('div', { class: 'grow' }),
        h('div', { class: 'foot' },
          h('a', { class: 'link', href: '#history', text: 'all history →' }),
          signOutLink()));
    }).catch(function (err) { if (!guard(err)) failed(home); });
  }

  /* ---------- history ---------- */

  function historyView() {
    ++gen;
    var rows = h('div', { class: 'log' });
    var more = h('button', { class: 'link', type: 'button', text: 'more', hidden: true });
    var last = null;
    function page() {
      more.hidden = true;
      desk('history', last ? { before: last } : {}).then(function (list) {
        (list || []).forEach(function (l) {
          add(rows, h('div', { text: stamp(l.at) + ' · ' + sentence(l) }));
          last = l.at;
        });
        more.hidden = !list || list.length < 100;
        if (!rows.childNodes.length) add(rows, h('div', { text: 'nothing yet.' }));
      }).catch(function (err) { if (!guard(err)) failed(historyView); });
    }
    more.onclick = page;
    show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: 'history' })),
      rows, h('div', { class: 'acts left' }, more));
    page();
  }

  /* ---------- a pile, one at a time ---------- */

  // pile: 'applications' | 'reports'. queue: ids. pos: where we are.
  var run = null;

  function openPile(pile) {
    var my = ++gen;
    desk(pile).then(function (ids) {
      if (my !== gen) return;
      run = { pile: pile, queue: ids || [], pos: 0, single: false };
      next();
    }).catch(function (err) { if (!guard(err)) failed(function () { openPile(pile); }); });
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
      show(h('div', { class: 'bar' }, h('a', { class: 'back', href: '#', text: '‹ the desk' }), h('span', { text: run.pile })),
        h('p', { class: 'line', text: COPY.empty }),
        h('div', { class: 'acts left' }, h('a', { class: 'link', href: '#', text: '‹ the desk' })));
      return;
    }
    var id = run.queue[run.pos];
    (run.pile === 'applications' ? application : report)(id);
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
    buttons.forEach(function (b) { b.disabled = true; });
    note.hidden = true;
    call().then(advance).catch(function (err) {
      if (guard(err)) return;
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
    }).catch(function (err) { if (!guard(err)) failed(function () { application(id); }); });
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
            desk('lift', { profile: p.id, report: r.id }).then(function () { report(id); }).catch(function (err) {
              if (guard(err)) return;
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
    }).catch(function (err) { if (!guard(err)) failed(function () { report(id); }); });
  }

  /* ---------- routing ---------- */

  var DEEP = new RegExp('^#(application|report)-(' + UUID + ')$');
  function route() {
    if (!sheet.hidden) document.getElementById('sheet-no').click();
    if (!session) { login(); return; }
    var hash = location.hash;
    var m = DEEP.exec(hash);
    if (m) openOne(m[1] + 's', m[2]);
    else if (hash === '#applications' || hash === '#reports') openPile(hash.slice(1));
    else if (hash === '#history') historyView();
    else home();
  }
  window.addEventListener('hashchange', route);
  route();
})();
