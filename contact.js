/* the contact form on /support (brief imprint-personal-number-out in the app repo). One call: send_contact_note (email,
   message, and the bot trap only when a robot filled it). The server sends the note to hello@getsurr.com with Reply-To
   the sender and deletes it; nothing is kept here. Every case ends in a visible line, never "sending…" forever; on a
   failure the words stay in the box. On getsurr.com it talks to production (config.js); anywhere else, only with
   ?staging in the address, to the test server (config.js BACKPAGES_STAGING), so it can be tried without touching
   production. */
(function () {
  'use strict';
  var C = window.SURR || {};
  var form = document.getElementById('contact');
  if (!form) return;
  var LIVE = /(^|\.)getsurr\.com$/.test(location.hostname);
  var S = C.BACKPAGES_STAGING || {};
  var URL_ = !LIVE && /[?&]staging\b/.test(location.search) && S.URL ? S.URL : C.SUPABASE_URL;
  var KEY = URL_ === S.URL ? S.KEY : C.SUPABASE_ANON_KEY;
  var btn = form.querySelector('button.go'), err = form.querySelector('.err');
  var FAIL = "That didn't go through. Try again in a moment.";

  function patience() {
    if (!window.AbortController) return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, 15000);
    return c.signal;
  }
  function fail(msg) {
    btn.disabled = false; btn.textContent = 'Send';
    err.textContent = msg; err.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    var email = form.email.value.trim(), message = form.message.value, hp = form.website.value;
    btn.disabled = true; btn.textContent = 'Sending…'; err.hidden = true;
    fetch(URL_ + '/rest/v1/rpc/send_contact_note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify(Object.assign({ p_email: email, p_message: message }, hp ? { p_hp: hp } : {})),
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: patience()
    }).then(function (r) {
      if (r.ok) return null;
      return r.json().catch(function () { return {}; }).then(function (j) { return j || {}; });
    }).then(function (j) {
      if (!j) {
        var ok = document.createElement('p');
        ok.className = 'done'; ok.setAttribute('role', 'status'); ok.id = 'contact';
        ok.textContent = 'Sent. We answer within one working day.';
        form.replaceWith(ok);
        return;
      }
      /* the function's own refusals ("that's not an email", "your message is empty", "that's too long. …") come back
         as they are, with a capital; anything else is the failure line */
      var m = j.code === '22023' && j.message ? j.message : '';
      fail(m ? m.charAt(0).toUpperCase() + m.slice(1) : FAIL);
    }).catch(function () { fail(FAIL); });
  });
})();
