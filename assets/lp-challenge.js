/**
 * LeadPages "How many arrows?" form check (Nov 2026) — client side.
 *
 * Loaded by api/render.js only when the site has config.formChallenge.on === true.
 * Adds a small picture + number buttons (1–8) to the site's forms:
 *   - the quote form (#quoteForm), content-block enquiry forms ([data-lpb-enq]),
 *     the consent form ([data-send]), and any other <form> with an email or phone field.
 * It stops the send until a number is picked, adds challengeToken / challengeAnswer to the
 * JSON sent to /api/leads and /api/consent-form, and loads a new picture after a wrong answer.
 * If the picture can't load, the form is left alone (the server then decides).
 */
(function (w, d) {
  'use strict';
  if (w.__lpChallengeBooted) return;
  w.__lpChallengeBooted = true;
  var CFG = w.__LP_FORM_CHALLENGE__ || {};
  var ENDPOINTS = /\/api\/(leads|consent-form)(\?|$)/;
  var widgets = [];
  var lastHost = null;

  var CSS = '' +
    '.lpch{margin:14px 0;padding:12px;border-radius:12px;background:var(--lpch-bg,#F3F7FD);border:1px solid rgba(10,36,99,.10);color:var(--lpch-ink,#0A2463);font:inherit;text-align:left}' +
    '.lpch-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}' +
    '.lpch-q{font-weight:700;font-size:15px;line-height:1.3;margin:0}' +
    '.lpch-new{background:none;border:0;padding:4px 2px;color:var(--lpch-accent,#1565D8);font:inherit;font-size:13px;font-weight:600;text-decoration:underline;cursor:pointer;white-space:nowrap}' +
    '.lpch-pic{display:block;width:100%;max-width:420px;height:auto;aspect-ratio:320/150;border-radius:10px;background:#fff}' +
    '.lpch-nums{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:10px 0 0;max-width:420px}' +
    '.lpch-n{min-height:42px;border-radius:9px;border:1.5px solid rgba(10,36,99,.22);background:#fff;color:inherit;font:inherit;font-weight:700;font-size:16px;cursor:pointer;padding:0}' +
    '.lpch-n:hover{border-color:var(--lpch-accent,#1565D8)}' +
    '.lpch-n[aria-pressed="true"]{background:var(--lpch-accent,#1565D8);border-color:var(--lpch-accent,#1565D8);color:#fff}' +
    '.lpch-n:focus-visible,.lpch-new:focus-visible{outline:3px solid var(--lpch-accent,#1565D8);outline-offset:2px}' +
    '.lpch-msg{margin:8px 0 0;font-size:13.5px;font-weight:600;min-height:0}' +
    '.lpch-msg.bad{color:#b42323}.lpch.need{border-color:#b42323;box-shadow:0 0 0 3px rgba(180,35,35,.12)}' +
    '.lpch-hint{margin:6px 0 0;font-size:12.5px;opacity:.75}' +
    '@media(max-width:380px){.lpch-nums{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
    '@media (prefers-color-scheme:dark){html[data-theme="dark"] .lpch{background:#14213a;color:#e8eefb}html[data-theme="dark"] .lpch-n{background:#0e1830;color:#e8eefb;border-color:rgba(255,255,255,.2)}}';

  function addCss() {
    if (d.getElementById('lpch-css')) return;
    var s = d.createElement('style'); s.id = 'lpch-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  function hex(v) { v = String(v || '').trim(); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : ''; }

  function Widget(host, before) {
    var self = this;
    this.host = host;
    this.token = null;
    this.answer = null;
    var el = d.createElement('div');
    el.className = 'lpch';
    el.setAttribute('data-lpch', '');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Quick check that you are a person');
    if (hex(CFG.accent)) el.style.setProperty('--lpch-accent', CFG.accent);
    if (hex(CFG.ink)) el.style.setProperty('--lpch-ink', CFG.ink);
    var nums = '';
    for (var i = 1; i <= 8; i++) nums += '<button type="button" class="lpch-n" data-n="' + i + '" aria-pressed="false">' + i + '</button>';
    el.innerHTML = '<div class="lpch-top"><p class="lpch-q">How many arrows can you count?</p>' +
      '<button type="button" class="lpch-new">New picture</button></div>' +
      '<img class="lpch-pic" alt="" width="320" height="150">' +
      '<div class="lpch-nums">' + nums + '</div>' +
      '<p class="lpch-msg" role="status" aria-live="polite"></p>' +
      (CFG.hint ? '<p class="lpch-hint"></p>' : '');
    if (CFG.hint) el.querySelector('.lpch-hint').textContent = CFG.hint;
    this.el = el;
    if (before && before.parentNode) before.parentNode.insertBefore(el, before); else host.appendChild(el);
    el.querySelector('.lpch-new').addEventListener('click', function () { self.load(); });
    el.querySelectorAll('.lpch-n').forEach(function (b) {
      b.addEventListener('click', function () {
        self.answer = parseInt(b.getAttribute('data-n'), 10);
        el.querySelectorAll('.lpch-n').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        el.classList.remove('need'); self.msg('');
        lastHost = host;
      });
    });
    this.load();
  }
  Widget.prototype.msg = function (t, bad) {
    var m = this.el.querySelector('.lpch-msg'); m.textContent = t || ''; m.className = 'lpch-msg' + (bad ? ' bad' : '');
  };
  Widget.prototype.load = function () {
    var self = this;
    self.answer = null; self.token = null;
    self.el.querySelectorAll('.lpch-n').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    var q = '?style=' + encodeURIComponent(CFG.style || 'arrows') +
      (hex(CFG.accent) ? '&accent=' + encodeURIComponent(CFG.accent) : '') +
      (hex(CFG.ink) ? '&ink=' + encodeURIComponent(CFG.ink) : '') + '&_=' + Date.now();
    (w.__lpchFetch || w.fetch).call(w, '/api/challenge' + q, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.token) throw new Error('no picture');
        self.token = j.token;
        self.el.querySelector('.lpch-q').textContent = j.question;
        var img = self.el.querySelector('.lpch-pic');
        img.src = j.image;
        img.alt = 'A picture of pulsing dots, some with ' + (j.noun || 'arrows') + '. ' + j.question;
        self.el.hidden = false;
      })
      .catch(function () { self.failed = true; self.el.hidden = true; });
  };
  Widget.prototype.ready = function () { return this.failed || (this.token && this.answer); };
  Widget.prototype.ask = function () {
    this.el.classList.add('need');
    this.msg('Please tap how many you can count.', true);
    try { this.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
  };

  function widgetFor(host) {
    for (var i = 0; i < widgets.length; i++) if (widgets[i].host === host) return widgets[i];
    return null;
  }

  /** Where a form's check goes: before its send button row. */
  function mountAll(root) {
    // Forget widgets whose form was redrawn (sub-page changes, block re-render).
    for (var k = widgets.length - 1; k >= 0; k--) if (!d.contains(widgets[k].host)) widgets.splice(k, 1);
    var found = [];
    (root || d).querySelectorAll('#quoteForm').forEach(function (h) {
      found.push([h, h.querySelector('button[onclick*="submitLead"]')]);
    });
    (root || d).querySelectorAll('[data-lpb-enq]').forEach(function (h) {
      found.push([h, h.querySelector('.lpb-enq-btns') || h.querySelector('[type="submit"]')]);
    });
    (root || d).querySelectorAll('[data-send]').forEach(function (b) {
      var h = b.closest('[data-step]') || b.closest('.lpc-step') || b.parentNode.parentNode;
      found.push([h, b.closest('.lpc-nav') || b]);
    });
    (root || d).querySelectorAll('form').forEach(function (f) {
      if (f.closest('[data-lpch-skip]') || f.matches('[role="search"]')) return;
      if (!f.querySelector('input[type="email"],input[type="tel"],input[name="email"],input[name="phone"]')) return;
      var btn = f.querySelector('[type="submit"]') || f.querySelector('button:not([type="button"])');
      if (!btn) return;
      found.push([f, btn.closest('.lpb-enq-btns') || btn]);
    });
    found.forEach(function (x) {
      var host = x[0];
      if (!host || host.closest('[data-lpch-host]') || host.querySelector('[data-lpch-host],[data-lpch]')) return;
      host.setAttribute('data-lpch-host', '');
      widgets.push(new Widget(host, x[1]));
    });
  }

  function hostOf(node) {
    var h = node && node.closest ? node.closest('[data-lpch-host]') : null;
    return h;
  }

  // Stop a send until a number is picked (capture phase: runs before the form's own handler).
  function guard(e) {
    var t = e.target;
    var isSend = e.type === 'submit' ||
      (t.closest && (t.closest('button[onclick*="submitLead"]') || t.closest('[data-send]')));
    if (!isSend) return;
    var host = hostOf(e.type === 'submit' ? t : (t.closest('button') || t));
    var wg = host && widgetFor(host);
    if (!wg) return;
    lastHost = host;
    if (!wg.ready()) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); wg.ask(); }
  }
  d.addEventListener('submit', guard, true);
  d.addEventListener('click', guard, true);

  // Add the answer to lead / consent posts; after a wrong answer show a new picture.
  var realFetch = w.fetch;
  w.__lpchFetch = realFetch;
  if (realFetch) {
    w.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var wg = null;
      if (ENDPOINTS.test(url) && init && String(init.method || 'GET').toUpperCase() === 'POST' && typeof init.body === 'string') {
        wg = (lastHost && widgetFor(lastHost)) || (widgets.length === 1 ? widgets[0] : null);
        if (wg && wg.token) {
          try {
            var b = JSON.parse(init.body);
            b.challengeToken = wg.token; b.challengeAnswer = wg.answer;
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          } catch (e) { /* not JSON: leave it */ }
        }
      }
      var p = realFetch.call(this, input, init);
      if (!wg) return p;
      return p.then(function (res) {
        if (res.status === 400) {
          res.clone().json().then(function (j) {
            if (j && j.error === 'challenge') {
              wg.load();
              wg.el.classList.add('need');
              wg.msg(j.reason === 'expired' ? 'That picture timed out — here’s a new one. Please count again and send.' : 'Not quite — here’s a new picture. Please count again and send.', true);
              try { wg.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
            }
          }).catch(function () {});
        } else if (res.ok) {
          // Each picture is good for one send.
          wg.load();
        }
        return res;
      });
    };
  }

  function boot() {
    addCss();
    mountAll(d);
    // Forms drawn later (content blocks, the consent form, sub-pages).
    if (w.MutationObserver) {
      var t = null;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { mountAll(d); }, 120); })
        .observe(d.body, { childList: true, subtree: true });
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
  w.LPChallenge = { mount: mountAll, widgets: widgets };
})(window, document);
