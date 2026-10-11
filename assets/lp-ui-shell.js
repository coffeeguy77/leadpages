/**
 * LeadPages "New look" app shell for manage.html — sidebar (icons + text) or top menu.
 *
 * Only shows when the new look is on (html[data-lp-ui="v2"], from Appearance). It does not
 * replace any editor code: every menu item is a proxy that clicks the original control
 * (the .adminnav tiles, the #lp-cmd "Site tools" / "Publishing & preview" buttons and the
 * account row), so all existing handlers, roles and permissions keep working. The original
 * chrome stays in the page, hidden by assets/lp-ui.css.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.LPUiShell) return;

  var EXTRA_ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
    'chevrons-left': '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    'chevrons-right': '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
    'chevrons-up-down': '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    dot: '<circle cx="12" cy="12" r="3"/>'
  };
  function svg(name) {
    var p = (global.LP_ICONS && global.LP_ICONS[name]) || EXTRA_ICONS[name] || EXTRA_ICONS.dot;
    return '<svg class="lpui-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clean(t) { return String(t || '').replace(/[←-⇿↗]/g, '').replace(/\s+/g, ' ').trim(); }

  /* Editor sections (the .adminnav tiles) → icon */
  var NAV_ICONS = {
    dashboard: 'gauge', advertising: 'megaphone', seo: 'scan-search', details: 'pencil-ruler', rates: 'percent',
    landing: 'file-text', 'ai-team': 'sparkles', apps: 'grid', onlinequotes: 'calculator', orders: 'shopping-bag',
    bookings: 'calendar-days', mailer: 'mail', messages: 'life-buoy', appearance: 'palette', themes: 'swatch-book',
    contact: 'contact', logo: 'image', users: 'users', demothemes: 'layers'
  };
  /* Site tools / account buttons → icon, by their label */
  var TOOL_ICONS = [
    [/^settings/i, 'settings'], [/^account/i, 'user'], [/appearance/i, 'sun'], [/billing/i, 'credit-card'],
    [/domain finder/i, 'search'], [/domains?/i, 'globe'], [/scope/i, 'clipboard-list'], [/backup/i, 'archive'],
    [/new site/i, 'plus'], [/orders/i, 'shopping-bag'], [/bookings/i, 'calendar-days'], [/ops command/i, 'command'],
    [/partner admin/i, 'building-2'], [/partner/i, 'arrow-left'], [/marketplace admin/i, 'store'], [/site switcher/i, 'repeat'],
    [/sign ?out/i, 'log-out'], [/classic|standard/i, 'toggle-left'], [/publish/i, 'rocket'], [/view live/i, 'external-link'],
    [/preview/i, 'monitor'], [/^[☆★]$|favourite|favorite/i, 'star']
  ];
  function toolIcon(label) {
    for (var i = 0; i < TOOL_ICONS.length; i++) if (TOOL_ICONS[i][0].test(label)) return TOOL_ICONS[i][1];
    return 'dot';
  }

  /** Hidden on purpose (role / entitlement / not set up) — the editor uses inline display:none
   *  or [hidden]. Layout CSS that hides whole rows on phones is ignored: the menu shows them all. */
  function hiddenEl(el) {
    if (!el) return true;
    return !!(el.hidden || el.style.display === 'none' || el.getAttribute('aria-hidden') === 'true');
  }
  function labelOf(el) {
    var t = clean(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '');
    if (!t && el.querySelector('svg,img')) t = clean(el.getAttribute('title') || '');
    return t;
  }

  /* ───────── Model: read the original chrome ───────── */
  function readNav() {
    var out = [];
    var btns = doc.querySelectorAll('.adminnav .anav-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (hiddenEl(b)) continue;
      var id = (b.id || '').replace(/^nav-/, '');
      out.push({ el: b, key: 'nav:' + id, label: labelOf(b), icon: NAV_ICONS[id] || 'dot', on: b.getAttribute('aria-selected') === 'true' });
    }
    return out;
  }
  /* The editor moves these buttons between rows (desktop card, phone drawer), so they are read by id. */
  var PRIMARY_IDS = ['btn-publish', 'btn-viewlive', 'lpc-preview'];
  var TOOL_IDS = ['btn-settings', 'btn-account', 'btn-appearance-aa', 'btn-billing', 'btn-domains', 'btn-domain-finder', 'lpc-scope',
    'lpc-backups', 'btn-fav', 'btn-newsite', 'lpc-order-desk', 'lpc-bookings-desk', 'lpc-ops-command', 'lpc-partner-admin',
    'lpc-marketplace-admin', 'lpc-partner-console'];
  function readIds(ids, tag) {
    var out = [];
    ids.forEach(function (id) {
      var el = doc.getElementById(id);
      if (!el || hiddenEl(el)) return;
      var l = labelOf(el);
      if (!l && el.querySelector('svg')) l = 'Favourite';
      if (!l) return;
      out.push({ el: el, key: tag + ':' + id, label: l, icon: toolIcon(l) });
    });
    // Anything else added to the tools row later still shows (after the known ones).
    return out;
  }
  function readControls(sel) {
    var host = doc.querySelector(sel); if (!host) return [];
    var out = [];
    var els = host.querySelectorAll('button, a.btn, a[href].lpc-link, a[role="button"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (hiddenEl(el) || el.closest('.lpui-side,.lpui-topnav,.lpui-topbar')) continue;
      var l = labelOf(el);
      if (!l && el.querySelector('svg')) l = 'Favourite';
      if (!l) continue;
      out.push({ el: el, key: sel + ':' + l, label: l, icon: toolIcon(l) });
    }
    return out;
  }
  function siteSelect() { return doc.querySelector('#site-label select') || doc.querySelector('select.lp-sitepick-sel'); }

  /* ───────── Render ───────── */
  var side, topnav, topbar, scrim, state = { menu: false, more: false, over: false };

  function itemHtml(it, i, group) {
    return '<button type="button" class="lpui-item' + (it.on ? ' on' : '') + '" data-g="' + group + '" data-i="' + i + '" title="' + esc(it.label) + '"' +
      (it.on ? ' aria-current="page"' : '') + '>' + svg(it.icon) + '<span class="lpui-item-l">' + esc(it.label) + '</span></button>';
  }
  function siteHtml() {
    var s = siteSelect();
    var name = '', slug = '';
    if (s && s.selectedIndex >= 0 && s.options[s.selectedIndex]) {
      name = clean(s.options[s.selectedIndex].text);
      slug = s.value || '';
    }
    if (!name) { var lab = doc.getElementById('site-label'); name = lab ? clean(lab.textContent) : ''; }
    var m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name); if (m) { name = m[1]; slug = m[2]; }
    if (!name) return '';
    var av = name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '•';
    return '<div class="lpui-site"><div class="lpui-site-wrap"><div class="lpui-site-btn" title="Switch site"><span class="lpui-site-av">' + esc(av) + '</span>' +
      '<span class="lpui-site-txt"><b>' + esc(name) + '</b><small>' + esc(slug) + '</small></span>' + svg('chevrons-up-down') + '</div>' +
      (s ? '<select class="lpui-site-sel lpui-bare" aria-label="Switch site"></select>' : '') + '</div></div>';
  }
  var M = { nav: [], tools: [], primary: [], acct: [] };

  function render() {
    if (!side) return;
    M.nav = readNav();
    var navLabels = {}; M.nav.forEach(function (n) { navLabels[n.label.toLowerCase()] = 1; });
    var known = {}; TOOL_IDS.concat(PRIMARY_IDS).forEach(function (id) { known[id] = 1; });
    M.tools = readIds(TOOL_IDS, 'tool').concat(readControls('#lpc-tools').filter(function (t) { return !known[t.el.id]; }))
      .filter(function (t) { return !navLabels[t.label.toLowerCase()]; });
    M.primary = readIds(PRIMARY_IDS, 'primary');
    M.acct = readControls('#lpc-acct').concat(readControls('#lpc-context')).filter(function (t, i, a) {
      return a.findIndex(function (x) { return x.label === t.label; }) === i;
    });
    var active = M.nav.filter(function (n) { return n.on; })[0];
    var collapsed = doc.documentElement.getAttribute('data-lp-side-collapsed') === 'true';

    var navList = M.nav.map(function (n, i) { return itemHtml(n, i, 'nav'); }).join('');
    var toolList = M.tools.map(function (n, i) { return itemHtml(n, i, 'tools'); }).join('');
    var acctList = M.acct.map(function (n, i) { return itemHtml(n, i, 'acct'); }).join('');
    var logo = '<a class="lpui-logo" href="/manage" title="LeadPages"><span class="leadpages-logo" data-lp-logo="auto" role="img" aria-label="leadpages"></span></a>';

    side.innerHTML =
      '<div class="lpui-side-head">' + logo +
        '<button type="button" class="lpui-iconbtn" data-act="collapse" title="' + (collapsed ? 'Expand menu' : 'Collapse menu') + '">' + svg(collapsed ? 'chevrons-right' : 'chevrons-left') + '</button></div>' +
      siteHtml() +
      '<div class="lpui-scroll">' +
        (navList ? '<div class="lpui-group"><div class="lpui-group-h">Website</div>' + navList + '</div>' : '') +
        (toolList ? '<div class="lpui-group"><div class="lpui-group-h">Site tools</div>' + toolList + '</div>' : '') +
      '</div>' +
      (acctList ? '<div class="lpui-foot"><div class="lpui-me"><div class="lpui-menu' + (state.menu ? ' open' : '') + '">' + acctList + '</div>' +
        '<button type="button" class="lpui-item" data-act="me" title="Account">' + svg('user-circle') + '<span class="lpui-item-l">Account &amp; workspace</span>' + svg('chevrons-up-down') + '</button></div></div>' : '');

    topnav.innerHTML =
      '<button type="button" class="lpui-iconbtn lpui-burger" data-act="drawer" title="Menu">' + svg('menu') + '</button>' + logo +
      siteHtml() +
      '<nav class="lpui-tabs">' + navList + '</nav>' +
      '<div class="lpui-over" hidden><div class="lpui-menu' + (state.over ? ' open' : '') + '"></div><button type="button" class="lpui-item" data-act="over" title="More">' + svg('more') + '<span class="lpui-item-l">More</span></button></div>' +
      (toolList ? '<div class="lpui-more"><div class="lpui-menu' + (state.more ? ' open' : '') + '">' + toolList + '</div><button type="button" class="lpui-iconbtn" data-act="more" title="Site tools">' + svg('settings') + '</button></div>' : '') +
      (acctList ? '<div class="lpui-me"><div class="lpui-menu' + (state.menu ? ' open' : '') + '">' + acctList + '</div><button type="button" class="lpui-iconbtn" data-act="me" title="Account">' + svg('user-circle') + '</button></div>' : '');

    var site = siteHtml().match(/<b>(.*?)<\/b>/);
    topbar.innerHTML = '<div class="lpui-title"><small>' + (site ? site[1] : '') + '</small><b>' + esc(active ? active.label : 'Command Centre') + '</b></div>' +
      '<div class="lpui-actions">' + M.primary.map(function (p, i) {
        return '<button type="button" class="btn' + (i === 0 ? '' : ' ghost') + '" data-g="primary" data-i="' + i + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>';

    fillSelects();
    fitTabs();
    try {
      if (global.LPLogo && global.LPLogo.upgradeAll) {
        var pr = global.LPLogo.upgradeAll({ pulse: false });
        if (pr && pr.then) pr.then(fitTabs); // the logo changes width once it mounts
      }
    } catch (e) {}
  }

  /** Top menu: items that don't fit move into a "More" menu instead of being clipped. */
  function fitTabs() {
    if (!topnav || doc.documentElement.getAttribute('data-lp-nav') !== 'top') return;
    var tabs = topnav.querySelector('.lpui-tabs'), over = topnav.querySelector('.lpui-over');
    if (!tabs || !over || !tabs.clientWidth) return;
    var items = Array.prototype.slice.call(tabs.querySelectorAll('.lpui-item'));
    var moved = [];
    items.forEach(function (b) { b.style.display = ''; });
    over.hidden = true;
    for (var i = items.length - 1; i >= 0 && tabs.scrollWidth > tabs.clientWidth + 1; i--) {
      if (items[i].classList.contains('on')) continue;
      items[i].style.display = 'none';
      moved.unshift(items[i]);
      over.hidden = false;
    }
    var menu = over.querySelector('.lpui-menu');
    menu.innerHTML = '';
    moved.forEach(function (b) { var c = b.cloneNode(true); c.style.display = ''; menu.appendChild(c); });
    if (moved.some(function (b) { return b.classList.contains('on'); })) over.querySelector('[data-act="over"]').classList.add('on');
  }

  function fillSelects() {
    var s = siteSelect(); if (!s) return;
    var proxies = doc.querySelectorAll('.lpui-site-sel');
    for (var i = 0; i < proxies.length; i++) {
      var p = proxies[i];
      p.innerHTML = s.innerHTML;
      p.value = s.value;
    }
  }

  /* ───────── Events ───────── */
  function onClick(e) {
    var t = e.target.closest('[data-act],[data-g]'); if (!t) {
      if (state.menu || state.more || state.over) { state.menu = state.more = state.over = false; render(); }
      return;
    }
    var act = t.getAttribute('data-act');
    if (act === 'collapse') {
      var c = doc.documentElement.getAttribute('data-lp-side-collapsed') === 'true';
      if (global.LPWorkspaceAppearance) global.LPWorkspaceAppearance.set({ sideCollapsed: !c });
      else doc.documentElement.setAttribute('data-lp-side-collapsed', c ? 'false' : 'true');
      relayout(); render(); return;
    }
    if (act === 'me') { state.menu = !state.menu; state.more = false; render(); return; }
    if (act === 'more') { state.more = !state.more; state.menu = state.over = false; render(); return; }
    if (act === 'over') { state.over = !state.over; state.menu = state.more = false; render(); return; }
    if (act === 'drawer') { doc.body.classList.toggle('lpui-drawer-open'); return; }
    var g = t.getAttribute('data-g'), i = Number(t.getAttribute('data-i'));
    var it = M[g] && M[g][i];
    if (!it || !it.el) return;
    state.menu = state.more = state.over = false;
    doc.body.classList.remove('lpui-drawer-open');
    it.el.click();
    schedule();
  }
  function onChange(e) {
    if (!e.target.classList || !e.target.classList.contains('lpui-site-sel')) return;
    var s = siteSelect(); if (!s) return;
    s.value = e.target.value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    schedule();
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 60); }

  /** Width the sidebar takes from the page (used by the preview dock maths in manage.html). */
  function inset() {
    var r = doc.documentElement;
    if (r.getAttribute('data-lp-ui') !== 'v2' || !doc.body.classList.contains('lpui-shell')) return 0;
    if (global.innerWidth < 1024 || r.getAttribute('data-lp-nav') === 'top') return 0;
    return r.getAttribute('data-lp-side-collapsed') === 'true' ? 68 : 248;
  }
  function relayout() {
    try { if (typeof global.previewLayout === 'function') global.previewLayout(); } catch (e) {}
    try { global.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  function mount() {
    if (side) return;
    doc.body.classList.add('lpui-shell');
    side = doc.createElement('aside'); side.className = 'lpui-side'; side.setAttribute('aria-label', 'Main menu');
    topnav = doc.createElement('header'); topnav.className = 'lpui-topnav';
    topbar = doc.createElement('div'); topbar.className = 'lpui-topbar';
    scrim = doc.createElement('div'); scrim.className = 'lpui-scrim'; scrim.setAttribute('data-act', 'drawer');
    doc.body.insertBefore(scrim, doc.body.firstChild);
    doc.body.insertBefore(topnav, doc.body.firstChild);
    doc.body.insertBefore(side, doc.body.firstChild);
    var wrap = doc.querySelector('body > .wrap');
    if (wrap) wrap.insertBefore(topbar, wrap.firstChild); else doc.body.appendChild(topbar);
    [side, topnav, topbar, scrim].forEach(function (n) { n.addEventListener('click', onClick); n.addEventListener('change', onChange); });
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitTabs); } catch (e) {}
    var rz = null;
    global.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(render, 120); });
    doc.addEventListener('click', function (e) {
      if ((state.menu || state.more || state.over) && !e.target.closest('.lpui-me,.lpui-more,.lpui-over')) { state.menu = state.more = state.over = false; render(); }
    });
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t.closest && t.closest('.lpui-side,.lpui-topnav,.lpui-topbar')) continue;
        schedule(); return;
      }
    });
    ['.adminnav', '#lp-cmd', '#site-label'].forEach(function (sel) {
      var n = doc.querySelector(sel);
      if (n) mo.observe(n, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'style', 'hidden', 'class', 'value'], characterData: true });
    });
    // #lp-cmd / #site-label are filled after sign-in; watch the body until they exist.
    var late = new MutationObserver(function () {
      ['#lp-cmd', '#site-label'].forEach(function (sel) {
        var n = doc.querySelector(sel);
        if (n && !n.__lpuiObs) { n.__lpuiObs = 1; mo.observe(n, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'style', 'hidden', 'class', 'value'], characterData: true }); schedule(); }
      });
    });
    late.observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener('change', function (e) { if (e.target === siteSelect()) schedule(); }, true);
    global.addEventListener('lp-workspace-appearance-change', function () { relayout(); schedule(); });
    render();
    setTimeout(render, 600);
    setTimeout(render, 2000);
  }

  global.LPUiShell = { mount: mount, render: render, inset: inset };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
})(typeof window !== 'undefined' ? window : this);
