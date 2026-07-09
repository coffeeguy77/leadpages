/**
 * Partner console mobile shell — drawer, bottom tabs, appearance, menu config.
 */
(function (global) {
  'use strict';

  var BP_MOBILE = 1024;
  var MENU_API = '/api/admin-command-menu';
  var TEXT_SIZES = ['standard', 'large', 'extra-large'];

  var NAV_META = {
    overview: { icon: 'overview', label: 'Dashboard' },
    messages: { icon: 'messages', label: 'Messages' },
    clients: { icon: 'clients', label: 'Clients' },
    demos: { icon: 'demos', label: 'Demos' },
    mypage: { icon: 'mypage', label: 'Partner Website' },
    listing: { icon: 'listing', label: 'Partner Directory' },
    payouts: { icon: 'payouts', label: 'Payouts & pricing' },
    quotes: { icon: 'quotes', label: 'Quotes' },
    commissions: { icon: 'commissions', label: 'Commissions' },
    training: { icon: 'training', label: 'Training' },
    resources: { icon: 'resources', label: 'Sales toolkit' },
    help: { icon: 'help', label: 'Help', external: '/help' },
    support: { icon: 'support', label: 'Support' },
    profile: { icon: 'profile', label: 'My Profile' },
    appearance: { icon: 'appearance', label: 'Appearance' },
    signout: { icon: 'signout', label: 'Sign out', danger: true }
  };

  var menuConfig = null;
  var drawerOpen = false;
  var appearOpen = false;
  var inited = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function isMobile() { return global.innerWidth < BP_MOBILE; }

  function icon(name, size) {
    return global.LPStrokeIcons ? global.LPStrokeIcons.svg(name, { size: size || 20 }) : '';
  }

  function panelTitle(name) {
    var m = NAV_META[name];
    return m ? m.label : name;
  }

  function setDrawer(open) {
    drawerOpen = !!open;
    document.body.classList.toggle('lp-p-drawer-open', drawerOpen);
    var btn = $('lp-p-menu-btn');
    if (btn) btn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  }

  function setAppear(open) {
    appearOpen = !!open;
    var el = $('lp-p-appear');
    if (el) el.classList.toggle('on', appearOpen);
  }

  function bumpTextSize(delta) {
    if (!global.LPWorkspaceAppearance) return;
    var prefs = global.LPWorkspaceAppearance.load();
    var idx = TEXT_SIZES.indexOf(prefs.textSize || 'standard');
    if (idx < 0) idx = 0;
    idx = Math.max(0, Math.min(TEXT_SIZES.length - 1, idx + delta));
    global.LPWorkspaceAppearance.set({ textSize: TEXT_SIZES[idx] });
    syncTextSizeLabel();
  }

  function syncTextSizeLabel() {
    var el = $('lp-p-text-label');
    if (!el || !global.LPWorkspaceAppearance) return;
    var sz = global.LPWorkspaceAppearance.load().textSize || 'standard';
    el.textContent = sz === 'extra-large' ? 'XL' : sz === 'large' ? 'L' : 'A';
    el.title = 'Text size: ' + sz.replace('-', ' ');
  }

  function buildShell() {
    if ($('lp-p-shell')) return;

    var oldTop = document.querySelector('.top');
    if (oldTop) oldTop.remove();

    var shell = document.createElement('header');
    shell.id = 'lp-p-shell';
    shell.className = 'lp-p-shell';
    shell.innerHTML =
      '<div class="lp-p-shell-inner">'
      + '<button type="button" class="lp-p-menu-btn" id="lp-p-menu-btn" aria-label="Open menu" aria-expanded="false">' + icon('menu', 22) + '</button>'
      + '<a href="/" class="lp-p-logo-link"><span class="leadpages-logo" data-lp-logo="auto" data-lp-logo-pulse role="img" aria-label="LeadPages"></span></a>'
      + '<span class="lp-p-shell-title" id="lp-p-shell-title">Partner</span>'
      + '<span class="lp-p-shell-spacer"></span>'
      + '<div class="lp-p-text-size" title="Text size">'
      + '<button type="button" class="lp-p-icon-btn" id="lp-p-text-minus" aria-label="Decrease text size">' + icon('minus', 18) + '</button>'
      + '<span class="lp-p-text-size-label" id="lp-p-text-label">A</span>'
      + '<button type="button" class="lp-p-icon-btn" id="lp-p-text-plus" aria-label="Increase text size">' + icon('plus', 18) + '</button>'
      + '</div>'
      + '<span class="lp-p-who" id="who"></span>'
      + '</div>';

    var scrim = document.createElement('div');
    scrim.className = 'lp-p-scrim';
    scrim.id = 'lp-p-scrim';

    var drawer = document.createElement('aside');
    drawer.className = 'lp-p-drawer';
    drawer.id = 'lp-p-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="lp-p-drawer-head">'
      + '<div><div class="pname" id="lp-p-drawer-name">Partner</div>'
      + '<div class="pstat"><span class="statusbadge s-active" id="lp-p-drawer-status">Active</span></div></div>'
      + '<button type="button" class="lp-p-icon-btn" id="lp-p-drawer-close" aria-label="Close menu">' + icon('close', 20) + '</button>'
      + '</div>'
      + '<div class="lp-p-drawer-body" id="lp-p-drawer-body"></div>';

    var bottom = document.createElement('nav');
    bottom.className = 'lp-p-bottom';
    bottom.id = 'lp-p-bottom';
    bottom.setAttribute('aria-label', 'Primary navigation');
    bottom.innerHTML = '<div class="lp-p-bottom-inner" id="lp-p-bottom-inner"></div>';

    var appear = document.createElement('div');
    appear.className = 'lp-p-appear';
    appear.id = 'lp-p-appear';
    appear.innerHTML =
      '<div class="lp-p-appear-scrim" id="lp-p-appear-scrim"></div>'
      + '<div class="lp-p-appear-sheet" role="dialog" aria-label="Appearance">'
      + '<h2 style="margin:0 0 4px;font-size:20px">Appearance</h2>'
      + '<p class="muted" style="margin:0 0 12px">Saved on this device — matches your command centre theme.</p>'
      + '<div class="lp-p-theme-grid" id="lp-p-theme-grid"></div>'
      + '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">'
      + '<button type="button" class="btn" id="lp-p-appear-close">Done</button></div></div>';

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);
    document.body.appendChild(bottom);
    document.body.appendChild(appear);

    $('lp-p-menu-btn').addEventListener('click', function () { setDrawer(!drawerOpen); });
    $('lp-p-drawer-close').addEventListener('click', function () { setDrawer(false); });
    $('lp-p-scrim').addEventListener('click', function () { setDrawer(false); });
    $('lp-p-text-minus').addEventListener('click', function () { bumpTextSize(-1); });
    $('lp-p-text-plus').addEventListener('click', function () { bumpTextSize(1); });
    $('lp-p-appear-scrim').addEventListener('click', function () { setAppear(false); });
    $('lp-p-appear-close').addEventListener('click', function () { setAppear(false); });

    global.addEventListener('resize', function () {
      if (!isMobile()) setDrawer(false);
      renderBottomTabs();
    });

    global.addEventListener('lp-workspace-appearance-change', syncTextSizeLabel);
    syncTextSizeLabel();
    renderThemeGrid();
  }

  function renderThemeGrid() {
    var grid = $('lp-p-theme-grid');
    if (!grid || !global.LPWorkspaceAppearance) return;
    var prefs = global.LPWorkspaceAppearance.load();
    var meta = global.LPWorkspaceAppearance.THEME_META || {};
    var keys = ['classic-light', 'command-dark', 'neon-pink', 'electric-blue', 'blush', 'blueprint', 'system'];
    grid.innerHTML = keys.map(function (k) {
      var m = meta[k] || { name: k, description: '' };
      var on = (prefs.theme || 'classic-light') === k;
      return '<button type="button" class="lp-p-theme-card' + (on ? ' on' : '') + '" data-theme="' + esc(k) + '">'
        + '<strong>' + esc(m.name) + '</strong><span>' + esc(m.description || '') + '</span></button>';
    }).join('');
    grid.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.LPWorkspaceAppearance.set({ theme: btn.getAttribute('data-theme') });
        renderThemeGrid();
      });
    });
  }

  function defaultMenuConfig() {
    return {
      version: 1,
      sections: [
        {
          id: 'primary',
          title: '',
          layout: 'tabs',
          slot: 'bottom',
          items: [
            { id: 'pnav-overview' },
            { id: 'pnav-clients' },
            { id: 'pnav-messages' },
            { id: 'pnav-demos' },
            { id: 'pnav-profile' }
          ]
        },
        {
          id: 'main',
          title: 'Menu',
          layout: 'stack',
          items: [
            { id: 'pnav-overview' },
            { id: 'pnav-messages' },
            { id: 'pnav-clients' },
            { id: 'pnav-demos' },
            { id: 'pnav-mypage' },
            { id: 'pnav-listing' },
            { id: 'pnav-payouts' },
            { id: 'pnav-quotes' },
            { id: 'pnav-commissions' },
            { id: 'pnav-training' },
            { id: 'pnav-resources' },
            { id: 'pnav-help' },
            { id: 'pnav-support' },
            { id: 'pnav-profile' }
          ]
        },
        {
          id: 'prefs',
          title: 'Preferences',
          layout: 'stack',
          items: [{ id: 'pnav-appearance' }]
        },
        {
          id: 'account',
          title: 'Account',
          layout: 'stack',
          items: [{ id: 'pnav-signout' }]
        }
      ]
    };
  }

  function parseNavId(itemId) {
    if (!itemId) return null;
    return itemId.replace(/^pnav-/, '');
  }

  function navAction(key) {
    if (key === 'appearance') {
      setDrawer(false);
      setAppear(true);
      return;
    }
    if (key === 'signout') {
      var so = $('signout');
      if (so) so.click();
      return;
    }
    var meta = NAV_META[key];
    if (meta && meta.external) {
      global.open(meta.external, '_blank', 'noopener');
      setDrawer(false);
      return;
    }
    if (key === 'help') {
      var hl = $('help-link');
      if (hl) hl.click();
      setDrawer(false);
      return;
    }
    if (typeof global.lpPartnerGotoPanel === 'function') {
      global.lpPartnerGotoPanel(key);
    } else if (typeof global.gotoPanel === 'function') {
      global.gotoPanel(key);
    }
    setDrawer(false);
    updateChrome(key);
  }

  function updateChrome(activePanel) {
    var title = $('lp-p-shell-title');
    if (title && activePanel) title.textContent = panelTitle(activePanel);

    document.querySelectorAll('.lp-p-tab').forEach(function (tab) {
      tab.classList.toggle('on', tab.getAttribute('data-p') === activePanel);
    });
    document.querySelectorAll('#lp-p-drawer-body [data-p]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-p') === activePanel);
    });
    document.querySelectorAll('#nav button[data-p]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-p') === activePanel);
    });
  }

  function renderNavButton(key, compact) {
    var meta = NAV_META[key];
    if (!meta) return '';
    var cls = 'lp-p-nav-item' + (meta.danger ? ' lp-p-nav-danger' : '');
    var tag = meta.external ? 'a' : 'button';
    var extra = meta.external ? ' href="' + esc(meta.external) + '" target="_blank" rel="noopener"' : ' type="button"';
    return '<' + tag + ' class="' + cls + '" data-p="' + esc(key) + '" data-icon="' + esc(meta.icon) + '" data-label="' + esc(meta.label) + '"' + extra + '>'
      + esc(meta.label) + '</' + tag + '>';
  }

  function wireNavButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-icon]').forEach(function (el) {
      if (global.LPStrokeIcons) global.LPStrokeIcons.decorate(el);
    });
    root.querySelectorAll('[data-p]').forEach(function (el) {
      if (el.__lpPwired) return;
      el.__lpPwired = true;
      el.addEventListener('click', function (e) {
        if (el.tagName === 'A' && el.getAttribute('href')) return;
        e.preventDefault();
        navAction(el.getAttribute('data-p'));
      });
    });
  }

  function renderDrawerMenu() {
    var body = $('lp-p-drawer-body');
    if (!body) return;
    var cfg = menuConfig || defaultMenuConfig();
    var html = '';
    (cfg.sections || []).forEach(function (sec) {
      if (sec.slot === 'bottom') return;
      var items = (sec.items || []).map(function (it) { return parseNavId(it.id); }).filter(Boolean);
      if (!items.length) return;
      html += '<div class="lp-p-mm-sec">';
      if (sec.title) html += '<div class="lp-p-drawer-sec-title">' + esc(sec.title) + '</div>';
      if (sec.layout === 'grid-2') html += '<div class="lp-p-mm-grid">';
      html += '<div class="lp-p-nav">';
      items.forEach(function (key) { html += renderNavButton(key); });
      html += '</div>';
      if (sec.layout === 'grid-2') html += '</div>';
      html += '</div>';
    });
    body.innerHTML = html;
    wireNavButtons(body);
  }

  function tabShortLabel(meta) {
    if (meta.tabLabel) return meta.tabLabel;
    if (/^my\s+/i.test(meta.label)) return meta.label.replace(/^my\s+/i, '');
    var parts = meta.label.split(' ');
    return parts[0];
  }

  function renderBottomTabs() {
    var inner = $('lp-p-bottom-inner');
    if (!inner) return;
    if (!isMobile()) { inner.innerHTML = ''; return; }

    var cfg = menuConfig || defaultMenuConfig();
    var primary = (cfg.sections || []).find(function (s) { return s.slot === 'bottom' || s.id === 'primary'; });
    var items = primary ? (primary.items || []).map(function (it) { return parseNavId(it.id); }).filter(Boolean) : ['overview', 'clients', 'messages', 'demos', 'profile'];

    inner.innerHTML = items.map(function (key) {
      var meta = NAV_META[key];
      if (!meta) return '';
      return '<button type="button" class="lp-p-tab" data-p="' + esc(key) + '" aria-label="' + esc(meta.label) + '">'
        + icon(meta.icon, 22)
        + '<span class="lp-tab-lbl">' + esc(tabShortLabel(meta)) + '</span></button>';
    }).join('');

    inner.querySelectorAll('.lp-p-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { navAction(tab.getAttribute('data-p')); });
    });
  }

  async function loadMenuConfig() {
    try {
      var tk = null;
      if (global.sb && global.sb.auth) {
        var sess = await global.sb.auth.getSession();
        tk = sess && sess.data && sess.data.session && sess.data.session.access_token;
      }
      var r = await fetch(MENU_API + '?surface=partner', {
        headers: tk ? { Authorization: 'Bearer ' + tk } : {}
      });
      var j = await r.json();
      if (j && j.ok && j.content) menuConfig = j.content;
    } catch (_e) { /* fallback */ }
    if (!menuConfig) menuConfig = defaultMenuConfig();
    renderDrawerMenu();
    renderBottomTabs();
  }

  function upgradeDom() {
    var dash = document.querySelector('#view-dash .dash');
    if (dash) {
      dash.classList.add('lp-p-dash');
      var wrap = dash.parentElement;
      if (wrap && wrap.classList.contains('wrap')) wrap.classList.add('lp-p-wrap');
      var side = dash.querySelector('.side');
      if (side) side.classList.add('lp-p-side');
      var main = dash.querySelector('main');
      if (main) main.classList.add('lp-p-main');
      dash.querySelectorAll('.panel').forEach(function (p) {
        p.classList.add('lp-p-panel');
      });
    }

    var nav = $('nav');
    if (nav) {
      nav.classList.add('lp-p-nav');
      nav.querySelectorAll('button[data-p]').forEach(function (btn) {
        var key = btn.getAttribute('data-p');
        var meta = NAV_META[key];
        if (meta) {
          btn.setAttribute('data-icon', meta.icon);
          btn.setAttribute('data-label', meta.label);
          btn.textContent = meta.label;
        }
      });
      nav.querySelectorAll('#appearance-link, #messages-link, #help-link').forEach(function (btn) {
        var id = btn.id === 'messages-link' ? 'messages' : btn.id === 'appearance-link' ? 'appearance' : 'help';
        var meta = NAV_META[id];
        if (meta) {
          btn.setAttribute('data-icon', meta.icon);
          btn.setAttribute('data-label', meta.label);
          btn.textContent = meta.label;
        }
      });
      var al = $('appearance-link');
      if (al && !al.__lpPwired) {
        al.__lpPwired = true;
        al.addEventListener('click', function () { navAction('appearance'); });
      }
      var so = $('signout');
      if (so) {
        so.setAttribute('data-icon', 'signout');
        so.setAttribute('data-label', 'Sign out');
        so.textContent = 'Sign out';
        so.classList.add('lp-p-nav-danger');
      }
      if (global.LPStrokeIcons) global.LPStrokeIcons.decorateAll(nav);
    }
  }

  function syncPartnerChrome() {
    var name = $('d-name');
    var status = $('d-status');
    var dn = $('lp-p-drawer-name');
    var ds = $('lp-p-drawer-status');
    if (name && dn) dn.textContent = name.textContent;
    if (status && ds) {
      ds.textContent = status.textContent;
      ds.className = status.className;
    }
  }

  function init() {
    if (!inited) {
      buildShell();
      upgradeDom();
      loadMenuConfig();
      inited = true;
    } else {
      syncPartnerChrome();
      loadMenuConfig();
    }

    global.lpPartnerGotoPanel = function (name) {
      if (typeof global.gotoPanel === 'function') global.gotoPanel(name);
      else {
        document.querySelectorAll('#nav button[data-p]').forEach(function (x) {
          x.classList.toggle('on', x.getAttribute('data-p') === name);
        });
        document.querySelectorAll('.panel').forEach(function (s) {
          s.classList.toggle('on', s.getAttribute('data-panel') === name);
        });
      }
      updateChrome(name);
      var main = document.querySelector('.lp-p-main');
      if (main) main.scrollTop = 0;
      global.scrollTo({ top: 0, behavior: 'smooth' });
    };

    global.lpPartnerShellSync = syncPartnerChrome;
    document.body.classList.add('lp-p-authed');

    if (global.LPLogo && global.LPLogo.upgradeAll) {
      global.LPLogo.upgradeAll({ pulse: true });
    }
  }

  global.LPPartnerShell = {
    init: init,
    updateChrome: updateChrome,
    loadMenuConfig: loadMenuConfig,
    NAV_META: NAV_META,
    defaultMenuConfig: defaultMenuConfig,
    parseNavId: parseNavId
  };
})(typeof window !== 'undefined' ? window : globalThis);
