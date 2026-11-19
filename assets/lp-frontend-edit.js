/* LeadPages on-site editor: edit a landing page's text on the real page (?edit).
 * Loaded by api/render.js only for /<site>/<page>?edit on leadpages.com.au (a custom
 * domain redirects here, where the LeadPages sign-in lives). Uses the visual editor
 * engine (assets/lp-visual-editor.js) with the live page as its frame.
 * Saves through /api/site/page-content: only this page's text, owner or super admin,
 * refused if the page changed elsewhere since it was opened. Unpublished changes are
 * kept on this device until Publish or Discard. Never shows browser pop-up dialogs.
 */
(function () {
  'use strict';
  var B = window.__LPE; if (!B || !B.site) return;
  // Public Supabase values (same as manage.html window.__LP) — never the service key.
  var SB_URL = 'https://fgzkuwhulgnewcazirvy.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnemt1d2h1bGduZXdjYXppcnZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDU5MDMsImV4cCI6MjEwNzc4MTkwM30._4cATBGiAbB9L4RMUBsvaXgaep74fmN8HKAWgWv0Cpg';
  var API = '/api/site/page-content';

  var S = { sb: null, page: null, original: '', base: '', level: 'advanced', isSuper: false, dirty: false, backup: null, cfg: null, cfgPage: null, busy: false };
  var KEY = function () { return 'lpe:' + B.site + ':' + (S.page && S.page.id); };

  /* ------------------------------------------------------------------ bar */
  var CSS = '#lpe-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483600;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;' +
    'padding:10px max(12px,env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-right));background:#0f172a;color:#f8fafc;' +
    'box-shadow:0 -8px 24px rgba(15,23,42,.28);font:500 14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#lpe-bar *{box-sizing:border-box}' +
    '#lpe-bar .t{display:flex;flex-direction:column;min-width:0;flex:1 1 220px}' +
    '#lpe-bar .t b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#lpe-bar .st{font-size:12.5px;color:#cbd5e1}#lpe-bar .st.ok{color:#86efac}#lpe-bar .st.warn{color:#fcd34d}#lpe-bar .st.err{color:#fca5a5}' +
    '#lpe-bar .acts{display:flex;flex-wrap:wrap;gap:8px}' +
    '#lpe-bar button,#lpe-bar a.b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:9px;' +
    'font:600 14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border:1px solid rgba(255,255,255,.22);color:#f8fafc}' +
    '#lpe-bar button:hover,#lpe-bar a.b:hover{background:rgba(255,255,255,.1)}' +
    '#lpe-bar button:focus-visible,#lpe-bar a.b:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}' +
    '#lpe-bar button.pri{background:#2563eb;border-color:#2563eb}#lpe-bar button.pri:hover{background:#1d4ed8}' +
    '#lpe-bar button[disabled]{opacity:.45;cursor:default;background:none}' +
    '#lpe-bar [hidden]{display:none!important}' +
    'body.lpe-on{padding-bottom:84px!important}' +
    'body.lpe-on .mobile-call,body.lpe-on .lptc,body.lpe-on .promo-fixed,body.lpe-on .promo-pop{display:none!important}' +
    '@media(max-width:560px){#lpe-bar .acts{width:100%}#lpe-bar .acts button,#lpe-bar .acts a.b{flex:1 1 auto}body.lpe-on{padding-bottom:132px!important}}';
  var bar = null;
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mountBar() {
    if (bar) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    bar = document.createElement('div'); bar.id = 'lpe-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Page editor');
    bar.innerHTML = '<div class="t"><b id="lpe-title">Page editor</b><span class="st" id="lpe-st" role="status" aria-live="polite">Loading…</span></div>' +
      '<div class="acts" id="lpe-acts">' +
        '<button type="button" class="pri" id="lpe-pub" hidden>Publish</button>' +
        '<button type="button" id="lpe-undo" hidden>Undo</button>' +
        '<button type="button" id="lpe-discard" hidden>Discard changes</button>' +
        '<button type="button" id="lpe-exit">Exit</button>' +
        '<a class="b" id="lpe-signin" href="/manage" hidden>Sign in</a>' +
      '</div>' +
      '<div class="acts" id="lpe-ask" hidden><span class="st" id="lpe-ask-t" style="flex:1 1 100%"></span>' +
        '<button type="button" class="pri" id="lpe-yes">Leave</button><button type="button" id="lpe-no">Stay</button></div>';
    document.body.appendChild(bar);
    document.body.classList.add('lpe-on');
    el('lpe-pub').addEventListener('click', publish);
    el('lpe-undo').addEventListener('click', undo);
    el('lpe-discard').addEventListener('click', discard);
    el('lpe-exit').addEventListener('click', exitAsk);
    el('lpe-yes').addEventListener('click', exitNow);
    el('lpe-no').addEventListener('click', function () { el('lpe-ask').hidden = true; el('lpe-acts').hidden = false; });
  }
  function status(msg, kind) { var s = el('lpe-st'); if (!s) return; s.textContent = msg; s.className = 'st' + (kind ? ' ' + kind : ''); }
  function ui() {
    if (!bar) return;
    var ready = !!S.page;
    el('lpe-pub').hidden = !ready; el('lpe-pub').disabled = !S.dirty || S.busy;
    el('lpe-discard').hidden = !(ready && S.dirty); el('lpe-discard').disabled = S.busy;
    el('lpe-undo').hidden = !(ready && S.backup && !S.dirty); el('lpe-undo').disabled = S.busy;
  }

  /* ------------------------------------------------------------------ helpers */
  async function token() {
    try { var r = await S.sb.auth.getSession(); return r && r.data && r.data.session ? r.data.session.access_token : null; } catch (e) { return null; }
  }
  async function call(method, body, qs) {
    var t = await token(); if (!t) return { ok: false, error: 'auth' };
    try {
      var r = await fetch(API + (qs || ''), { method: method, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
      var j = await r.json().catch(function () { return { ok: false, error: 'bad_reply' }; });
      j.status = r.status; return j;
    } catch (e) { return { ok: false, error: 'network' }; }
  }
  function saveLocal() { try { if (S.dirty) localStorage.setItem(KEY(), JSON.stringify({ base: S.base, body: S.page.body, at: Date.now() })); else localStorage.removeItem(KEY()); } catch (e) {} }
  function liveCfg() {
    try { if (window.__lpLiveCfg) return window.__lpLiveCfg; } catch (e) {}
    try { return (0, eval)('typeof SITE_CONFIG!=="undefined"?SITE_CONFIG:null'); } catch (e) { return null; }
  }
  function apply() {
    if (!S.cfgPage || typeof window.__applyTradeConfig !== 'function') return;
    S.cfgPage.body = S.page.body;
    try { window.__lpbEdit = true; window.__applyTradeConfig(S.cfg); } catch (e) { console.error('[lpe] redraw', e && e.message); }
  }
  function ready(fn) {
    var n = 0;
    (function wait() {
      if (window.supabase && window.LPVisual && typeof window.__applyTradeConfig === 'function' && document.body) return fn();
      if (++n > 200) { mountBar(); status('The editor couldn’t load. Refresh the page to try again.', 'err'); return; }
      setTimeout(wait, 50);
    })();
  }

  /** Links to the site's own pages keep edit mode on, so you can browse to the page to edit. */
  function carryEdit() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a || a.closest('#lpe-bar')) return;
      if (a.closest('.lp-body') && window.__lpbEdit) return;              // page text: the editor handles it
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (_u) { return; }
      if (u.origin !== location.origin || u.pathname.indexOf('/' + B.site) !== 0) return;
      if (u.pathname === location.pathname && u.hash) return;              // a jump within this page
      if (!u.searchParams.has('edit')) { u.searchParams.set('edit', '1'); a.setAttribute('href', u.pathname + u.search + u.hash); }
    }, true);
  }

  /* ------------------------------------------------------------------ start */
  async function start() {
    mountBar();
    S.sb = window.supabase.createClient(SB_URL, SB_ANON);
    if (!(await token())) {
      el('lpe-title').textContent = 'Sign in to edit this page';
      status('Sign in to LeadPages in this browser, then open this page again.', 'warn');
      el('lpe-signin').hidden = false; el('lpe-pub').hidden = true; return;
    }
    carryEdit();
    if (!B.page) {
      el('lpe-title').textContent = 'Edit Live Site';
      status('Choose a page from the site\u2019s menu to edit it. (The homepage is edited in LeadPages.)', '');
      return;
    }
    var j = await call('GET', null, '?site=' + encodeURIComponent(B.site) + '&page=' + encodeURIComponent(B.page || ''));
    if (!j.ok) {
      el('lpe-title').textContent = 'Page editor';
      if (j.status === 401) { status('Your sign-in has expired. Sign in to LeadPages again, then reopen this page.', 'warn'); el('lpe-signin').hidden = false; }
      else if (j.status === 403) status('Your account can’t edit this website.', 'err');
      else if (j.error === 'page_not_found') status(B.page ? 'This page can’t be edited here.' : 'The homepage is edited in LeadPages — open a landing page to edit it here.', 'warn');
      else status('Couldn’t open the editor (' + (j.error || 'error') + '). Refresh to try again.', 'err');
      return;
    }
    S.page = j.page; S.original = j.page.body; S.base = j.hash; S.level = j.level; S.isSuper = !!j.isSuper;
    if (!S.page.blocks && !S.page.rich) { status('This page is plain text — edit it in LeadPages.', 'warn'); return; }
    S.cfg = liveCfg();
    var pages = (S.cfg && S.cfg.pages) || [];
    for (var i = 0; i < pages.length; i++) if (pages[i] && pages[i].id === S.page.id) S.cfgPage = pages[i];
    if (!S.cfgPage) { status('This page isn’t published yet — edit it in LeadPages.', 'warn'); return; }
    el('lpe-title').textContent = 'Editing: ' + (S.page.title || S.page.slug).replace(/\s+[-–|]\s+.*$/, '');
    // Changes not yet published from an earlier visit on this device.
    var note = '';
    try {
      var saved = JSON.parse(localStorage.getItem(KEY()) || 'null');
      if (saved && saved.base === S.base && typeof saved.body === 'string' && saved.body !== S.page.body) { S.page.body = saved.body; S.dirty = true; note = 'Your unpublished changes from last time are back. '; }
      else if (saved && saved.base !== S.base) { localStorage.removeItem(KEY()); note = 'This page was updated since your last visit, so older unpublished changes were cleared. '; }
    } catch (e) {}
    window.LPVisualHost = {
      page: function () { return S.page; },
      frame: function () { return { contentWindow: window }; },
      level: function () { return S.level; },
      isSuper: function () { return S.isSuper; },
      siteLevel: function () { return S.level; },
      setSiteLevel: function () {},
      forceVisual: true,
      setBody: function (v, o) { S.page.body = v; S.dirty = v !== S.original; S.backup = S.dirty ? S.backup : S.backup; saveLocal(); ui(); status(S.dirty ? 'Unpublished changes — tap Publish to put them live.' : 'No changes.', S.dirty ? 'warn' : ''); if (o && o.redraw) apply(); },
      redraw: apply,
      openPreview: apply,
      toast: function (m, k) { status(m, k === 'warn' ? 'warn' : ''); }
    };
    // Keep the text being edited clear of the bar (and the phone keyboard).
    document.addEventListener('focusin', function (e) {
      var t = e.target && e.target.closest && e.target.closest('.lpb-ed[contenteditable="true"]'); if (!t) return;
      setTimeout(function () {
        var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        var r = t.getBoundingClientRect(), barH = bar ? bar.offsetHeight : 0;
        if (r.bottom > vh - barH - 24 || r.top < 90) window.scrollBy(0, r.top - Math.max(110, vh * 0.3));
      }, 60);
    });
    window.LPVisual.frameReady();
    window.LPVisual.pageOpened();
    apply();
    ui();
    status(note + (S.dirty ? 'Unpublished changes — tap Publish to put them live.' : 'Click any text on the page to change it.'), note ? 'warn' : '');
  }

  /* ------------------------------------------------------------------ actions */
  async function publish() {
    if (!S.dirty || S.busy) return;
    S.busy = true; ui(); status('Publishing…');
    var j = await call('POST', { site: B.site, pageId: S.page.id, action: 'publish', body: S.page.body, baseHash: S.base });
    S.busy = false;
    if (j.ok) {
      S.base = j.hash; S.original = S.page.body; S.dirty = false; S.backup = j.backupId || null; saveLocal();
      status(j.unchanged ? 'Nothing to publish — the page already says this.' : 'Published ✓ Your changes are live.', 'ok');
    } else if (j.error === 'changed_elsewhere') {
      status('This page was changed in LeadPages since you opened it. Refresh to get the latest version (your changes stay on this device until then).', 'err');
    } else if (j.status === 401 || j.error === 'auth') {
      status('Your sign-in has expired. Sign in to LeadPages again, then come back — your changes are kept.', 'err'); el('lpe-signin').hidden = false;
    } else status('Couldn’t publish (' + (j.error || 'error') + '). Your changes are kept — try again.', 'err');
    ui();
  }
  async function undo() {
    if (!S.backup || S.busy || S.dirty) return;
    S.busy = true; ui(); status('Putting back the previous version…');
    var j = await call('POST', { site: B.site, pageId: S.page.id, action: 'undo', backupId: S.backup, baseHash: S.base });
    S.busy = false;
    if (j.ok) { S.page.body = j.body; S.original = j.body; S.base = j.hash; S.backup = null; S.dirty = false; saveLocal(); apply(); status('Undone — the previous version is live again.', 'ok'); }
    else if (j.error === 'changed_elsewhere') status('The page was changed again since, so it can’t be undone here. Use Backups in LeadPages.', 'err');
    else status('Couldn’t undo (' + (j.error || 'error') + ').', 'err');
    ui();
  }
  function discard() {
    if (S.busy) return;
    S.page.body = S.original; S.dirty = false; saveLocal(); apply(); ui();
    status('Changes discarded — the page is as it was.', '');
  }
  function exitAsk() {
    if (!S.dirty) return exitNow();
    el('lpe-ask-t').textContent = 'Leave without publishing? Your changes stay saved on this device for next time.';
    el('lpe-acts').hidden = true; el('lpe-ask').hidden = false;
  }
  function exitNow() {
    var u = new URL(location.href); u.searchParams.delete('edit'); location.href = u.pathname + (u.search || '') + u.hash;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { ready(start); });
  else ready(start);
})();
