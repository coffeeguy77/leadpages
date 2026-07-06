/**
 * LeadPages admin shell — compact header, drawer nav, preview layout prefs.
 */
(function (global) {
  'use strict';

  var PREVIEW_KEY = 'leadpages_preview_layout';
  var RATIO_KEY = 'leadpages_preview_ratio';
  var BP_TABLET = 1024;
  var RATIO_STEP = 10;
  var RATIO_MIN = 20;
  var RATIO_MAX = 80;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function loadPref(key, fallback) {
    try {
      var v = global.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function savePref(key, val) {
    try {
      global.localStorage.setItem(key, val);
    } catch (e) { /* ignore */ }
  }

  function isMobileLayout() {
    return global.innerWidth < BP_TABLET;
  }

  function isPhoneLayout() {
    return global.innerWidth < 768;
  }

  function isTabletLandscape() {
    var w = global.innerWidth;
    var h = global.innerHeight;
    return w >= 768 && w < 1200 && w > h;
  }

  function defaultEditorRatio() {
    if (isTabletLandscape()) return 60;
    return 70;
  }

  function getEditorRatio() {
    var stored = parseInt(loadPref(RATIO_KEY, ''), 10);
    if (!isNaN(stored) && stored >= RATIO_MIN && stored <= RATIO_MAX) return stored;
    return defaultEditorRatio();
  }

  function setEditorRatio(pct) {
    pct = Math.max(RATIO_MIN, Math.min(RATIO_MAX, Math.round(pct)));
    savePref(RATIO_KEY, String(pct));
    applyRatioVars(pct);
    syncRatioUI(pct);
    if (global.lpPreviewLayoutSync) global.lpPreviewLayoutSync();
    return pct;
  }

  function adjustEditorRatio(delta) {
    return setEditorRatio(getEditorRatio() + delta);
  }

  function applyRatioVars(pct) {
    pct = pct == null ? getEditorRatio() : pct;
    document.body.style.setProperty('--lp-editor-ratio', String(pct));
    document.body.style.setProperty('--lp-preview-ratio', String(100 - pct));
  }

  function syncRatioUI(pct) {
    pct = pct == null ? getEditorRatio() : pct;
    document.querySelectorAll('[data-lp-ratio-val]').forEach(function (el) {
      el.textContent = pct + '/' + (100 - pct);
    });
  }

  function recommendedPreviewLayout() {
    if (isTabletLandscape()) return 'side';
    if (global.innerWidth >= 1200) return 'side';
    return 'split';
  }

  function initManageShell() {
    if (!qs('.wrap') || document.getElementById('lp-admin-shell')) return;

    /* Remove legacy shell-only header controls (never touch live-preview ratio ids) */
    ['lp-chrome-hide-btn', 'lp-shell-ratio'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    var shell = document.createElement('header');
    shell.id = 'lp-admin-shell';
    shell.className = 'lp-admin-shell';
    shell.innerHTML =
      '<div class="lp-admin-shell-inner">'
      + '<button type="button" class="lp-shell-menu" id="lp-shell-menu" aria-label="Open menu" aria-expanded="false">&#9776;</button>'
      + '<a href="/manage" class="lp-shell-logo-link"><span class="leadpages-logo lp-shell-logo" data-lp-logo="auto" data-lp-logo-pulse role="img" aria-label="LeadPages"></span></a>'
      + '<span class="lp-shell-spacer"></span>'
      + '<div class="lp-shell-tools">'
      + '<select class="lp-shell-select" id="lp-prev-layout-sel" title="Preview layout" aria-label="Preview layout">'
      + '<option value="off">Preview: Off</option>'
      + '<option value="split">Preview: Split</option>'
      + '<option value="side">Preview: Side panel</option>'
      + '</select>'
      + '</div></div>';

    var scrim = document.createElement('div');
    scrim.id = 'lp-admin-scrim';
    scrim.className = 'lp-admin-scrim';

    var drawer = document.createElement('aside');
    drawer.id = 'lp-admin-drawer';
    drawer.className = 'lp-admin-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="lp-drawer-head">'
      + '<div class="lp-drawer-brand"><img class="leadpages-logo lp-drawer-logo" data-lp-logo="auto" src="https://res.cloudinary.com/dzx6x1hou/image/upload/v1782665886/leadpages-logo-white.png" alt="LeadPages"><span class="lp-drawer-title">Command Centre</span></div>'
      + '<button type="button" class="lp-drawer-close" id="lp-drawer-close" aria-label="Close menu">&#10005;</button></div>'
      + '<div class="lp-drawer-body" id="lp-admin-drawer-inner"></div>';

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.insertBefore(scrim, shell.nextSibling);
    document.body.insertBefore(drawer, scrim.nextSibling);

    var navSlot = document.createElement('div');
    navSlot.id = 'lp-nav-slot';
    var cmdSlot = document.createElement('div');
    cmdSlot.id = 'lp-cmd-slot';

    var adminnav = qs('.adminnav');
    var cmd = document.getElementById('lp-cmd');
    if (adminnav && adminnav.parentNode) {
      adminnav.parentNode.insertBefore(navSlot, adminnav);
      navSlot.appendChild(adminnav);
    }
    if (cmd && cmd.parentNode) {
      cmd.parentNode.insertBefore(cmdSlot, cmd);
      cmdSlot.appendChild(cmd);
    }

    var drawerInner = document.getElementById('lp-admin-drawer-inner');
    var navHome = navSlot;
    var cmdHome = cmdSlot;

    function ensureDrawerLabel(inner, cls, text) {
      var lbl = inner.querySelector('.' + cls);
      if (!lbl) {
        lbl = document.createElement('div');
        lbl.className = cls;
        lbl.textContent = text;
        inner.appendChild(lbl);
      }
      return lbl;
    }

    function appendDrawerPiece(inner, el, labelCls, labelText) {
      if (!el || el.parentNode === inner) return;
      if (labelText) ensureDrawerLabel(inner, labelCls || 'lp-drawer-section-label', labelText);
      inner.appendChild(el);
    }

    function restoreCmdPiece(cmd, el, before) {
      if (!cmd || !el || cmd.contains(el)) return;
      if (before && before.parentNode === cmd) cmd.insertBefore(el, before);
      else cmd.appendChild(el);
    }

    function restoreCmdLayout() {
      var cmdEl = document.getElementById('lp-cmd');
      if (!cmdEl) return;
      var top = document.getElementById('lpc-drawer-top');
      var ctx = document.getElementById('lpc-context');
      var prim = document.getElementById('lpc-primary');
      var tools = document.getElementById('lpc-tools');
      var footer = document.getElementById('lpc-drawer-footer');
      restoreCmdPiece(cmdEl, top, cmdEl.firstChild);
      restoreCmdPiece(cmdEl, ctx, top ? top.nextSibling : cmdEl.firstChild);
      if (prim) {
        var primWrap = cmdEl.querySelector('[data-lpc-wrap="primary"]');
        if (primWrap && prim.parentNode !== primWrap) primWrap.appendChild(prim);
      }
      if (tools) {
        var toolsWrap = cmdEl.querySelector('[data-lpc-wrap="tools"]');
        if (toolsWrap && tools.parentNode !== toolsWrap) toolsWrap.appendChild(tools);
      }
      restoreCmdPiece(cmdEl, footer, null);
      if (prim) prim.style.display = '';
    }

    var _drawerLayoutBusy = false;

    function refreshCmdDrawer() {
      if (_drawerLayoutBusy) return;
      if (global.lpRefreshCmdDrawer) global.lpRefreshCmdDrawer();
    }

    function moveElById(id, row) {
      if (!row) return;
      var el = document.getElementById(id);
      if (el && el.parentNode !== row) row.appendChild(el);
    }

    function prepareDrawerButtons() {
      var top = document.getElementById('lpc-drawer-top');
      var tools = document.getElementById('lpc-tools');
      var footer = document.getElementById('lpc-drawer-footer');
      var prim = document.getElementById('lpc-primary');
      moveElById('btn-publish', top);
      moveElById('btn-viewlive', top);
      var toolIds = [
        'btn-settings', 'btn-appearance-aa', 'btn-billing', 'btn-domains',
        'lpc-partner-admin', 'lpc-marketplace-admin', 'lpc-partner-console',
        'btn-newsite', 'lpc-scope', 'lpc-backups', 'btn-fav', 'lpc-preview'
      ];
      if (tools) toolIds.forEach(function (id) { moveElById(id, tools); });
      var footerIds = ['btn-switch', 'lp-mode-toggle', 'lpc-drawer-signout'];
      if (footer) footerIds.forEach(function (id) { moveElById(id, footer); });
      if (prim) {
        var preview = document.getElementById('lpc-preview');
        if (preview && preview.parentNode === prim && tools) tools.appendChild(preview);
      }
      var pub = document.getElementById('btn-publish');
      var view = document.getElementById('btn-viewlive');
      if (pub && !pub.dataset.lpFullText) pub.dataset.lpFullText = pub.textContent;
      if (view && !view.dataset.lpFullText) view.dataset.lpFullText = view.textContent;
      if (pub) pub.textContent = 'Publish Live Site';
      if (view) view.textContent = 'View Live Site';
    }

    function ensureDrawerActions() {
      if (!_drawerLayoutBusy && global.lpRefreshCmdDrawer) {
        try { global.lpRefreshCmdDrawer(); } catch (e) { /* ignore */ }
      }
      prepareDrawerButtons();
    }

    function drawerSectionHasItems(el) {
      if (!el) return false;
      return Array.prototype.some.call(el.children, function (node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.style && node.style.display === 'none') return false;
        var cs = global.getComputedStyle ? global.getComputedStyle(node) : null;
        return !cs || cs.display !== 'none';
      });
    }

    function setDrawer(open) {
      document.body.classList.toggle('lp-drawer-open', !!open);
      var btn = document.getElementById('lp-shell-menu');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function showSiteSwitcherInDrawer() {
      if (typeof global.lpDrawerShowSiteSwitcher === 'function') {
        try { return !!global.lpDrawerShowSiteSwitcher(); } catch (e) { /* ignore */ }
      }
      return false;
    }

    function moveChrome() {
      var mobile = isMobileLayout();
      var phone = isPhoneLayout();
      var inner = drawerInner;
      if (!inner || _drawerLayoutBusy) return;
      _drawerLayoutBusy = true;
      try {
        if (global.lpRefreshCmdDrawer) {
          try { global.lpRefreshCmdDrawer(); } catch (e) { /* ignore */ }
        }
        prepareDrawerButtons();
      } finally {
        _drawerLayoutBusy = false;
      }
      document.body.classList.toggle('lp-phone-chrome', mobile && phone);
      if (mobile) {
        document.body.classList.add('lp-compact-chrome');
        while (inner.firstChild) inner.removeChild(inner.firstChild);
        var usedConfig = false;
        if (global.LPMobileMenu && global.LPMobileMenu.applyDrawer) {
          try {
            usedConfig = !!global.LPMobileMenu.applyDrawer(inner, { phone: phone, mobile: mobile });
          } catch (e) { usedConfig = false; }
        }
        if (!usedConfig) {
          var publishTop = document.getElementById('lpc-drawer-top');
          var tools = document.getElementById('lpc-tools');
          var footer = document.getElementById('lpc-drawer-footer');
          if (drawerSectionHasItems(publishTop) || phone) {
            appendDrawerPiece(inner, publishTop, 'lp-drawer-section-label lp-drawer-publish-label', 'Publish');
          }
          if (!phone || showSiteSwitcherInDrawer()) {
            appendDrawerPiece(inner, document.getElementById('lpc-context'), 'lp-drawer-section-label lp-drawer-site-label', 'Site');
          }
          appendDrawerPiece(inner, adminnav, 'lp-drawer-section-label lp-drawer-builder-label', 'Builder Menu');
          if (!phone) {
            appendDrawerPiece(inner, document.getElementById('lpc-primary'), 'lp-drawer-section-label', 'Publishing & preview');
          }
          appendDrawerPiece(inner, tools, 'lp-drawer-section-label lp-drawer-tools-label', 'Site Tools');
          if (drawerSectionHasItems(footer)) {
            appendDrawerPiece(inner, footer, 'lp-drawer-section-label lp-drawer-footer-label', 'Account');
          }
        }
        var prim = document.getElementById('lpc-primary');
        if (prim) prim.style.display = phone ? 'none' : '';
      } else {
        document.body.classList.remove('lp-compact-chrome', 'lp-phone-chrome');
        setDrawer(false);
        if (adminnav && navHome && adminnav.parentNode !== navHome) navHome.appendChild(adminnav);
        restoreCmdLayout();
        if (cmd && cmdHome && cmd.parentNode !== cmdHome) cmdHome.appendChild(cmd);
        while (inner.firstChild) inner.removeChild(inner.firstChild);
      }
      syncRatioVisibility();
    }

    function syncRatioVisibility() {
      var layout = global.lpGetPreviewLayout ? global.lpGetPreviewLayout() : 'off';
      var show = layout === 'split' || layout === 'side';
      var prevCtrl = document.getElementById('lp-prev-ratio');
      if (prevCtrl) prevCtrl.hidden = !show;
      var shellRatio = document.getElementById('lp-shell-ratio');
      if (shellRatio) shellRatio.hidden = true;
    }

    function syncLayoutSelect() {
      var sel = document.getElementById('lp-prev-layout-sel');
      var val = global.lpGetPreviewLayout ? global.lpGetPreviewLayout() : loadPref(PREVIEW_KEY, 'off');
      if (val === 'fullscreen') val = 'split';
      if (sel) sel.value = val;
      syncRatioVisibility();
    }

    document.getElementById('lp-shell-menu').addEventListener('click', function () {
      var opening = !document.body.classList.contains('lp-drawer-open');
      if (opening) {
        ensureDrawerActions();
        moveChrome();
      }
      setDrawer(opening);
    });
    document.getElementById('lp-drawer-close').addEventListener('click', function () {
      setDrawer(false);
    });
    scrim.addEventListener('click', function () {
      setDrawer(false);
    });

    function onLayoutPick(val) {
      if (global.lpSetPreviewLayout) global.lpSetPreviewLayout(val);
      syncLayoutSelect();
      if (val !== 'off') setDrawer(false);
    }

    var layoutSel = document.getElementById('lp-prev-layout-sel');
    if (layoutSel) {
      layoutSel.addEventListener('change', function () {
        onLayoutPick(layoutSel.value);
      });
    }

    document.addEventListener('click', function (ev) {
      var navBtn = ev.target.closest('.anav-btn');
      if (navBtn && document.body.classList.contains('lp-drawer-open')) {
        setDrawer(false);
      }
      var ratioMinus = ev.target.closest('#lp-prev-ratio-minus');
      var ratioPlus = ev.target.closest('#lp-prev-ratio-plus');
      var ratioVal = ev.target.closest('[data-lp-ratio-val]');
      if (ratioMinus) adjustEditorRatio(-RATIO_STEP);
      if (ratioPlus) adjustEditorRatio(RATIO_STEP);
      if (ratioVal) setEditorRatio(50);
    });

    applyRatioVars();
    syncRatioUI();

    moveChrome();
    syncLayoutSelect();

    global.addEventListener('resize', function () {
      moveChrome();
      applyRatioVars();
      syncRatioUI();
      if (global.lpPreviewLayoutSync) global.lpPreviewLayoutSync();
    });

    global.addEventListener('lp-workspace-appearance-change', function () {
      if (global.LPWorkspaceAppearance) {
        global.LPWorkspaceAppearance.applyLogos(
          global.LPWorkspaceAppearance.resolveTheme(global.LPWorkspaceAppearance.load().theme)
        );
      }
    });

    global.LPAdminShell = {
      setDrawer: setDrawer,
      syncLayoutSelect: syncLayoutSelect,
      moveChrome: moveChrome,
      ensureDrawerActions: ensureDrawerActions,
      getEditorRatio: getEditorRatio,
      setEditorRatio: setEditorRatio,
      adjustEditorRatio: adjustEditorRatio,
      syncRatioVisibility: syncRatioVisibility,
      isTabletLandscape: isTabletLandscape
    };
  }

  function initPartnerTopbar(opts) {
    opts = opts || {};
    var topbar = opts.topbarSelector ? qs(opts.topbarSelector) : qs('.topbar, .top');
    if (!topbar || topbar.dataset.lpShell) return;
    topbar.dataset.lpShell = '1';
    topbar.classList.add('lp-admin-topbar');

    var inner = topbar.querySelector('.wrap, .inner');
    if (!inner) {
      var kids = Array.prototype.slice.call(topbar.childNodes);
      inner = document.createElement('div');
      inner.className = 'wrap lp-admin-topbar-inner';
      kids.forEach(function (n) {
        if (n.nodeType === 1) inner.appendChild(n);
      });
      topbar.appendChild(inner);
    } else {
      inner.classList.add('lp-admin-topbar-inner');
    }

    var logoImg = inner.querySelector('img');
    if (logoImg && !logoImg.closest('.lp-admin-topbar-logo')) {
      var logoWrap = document.createElement('div');
      logoWrap.className = 'lp-admin-topbar-logo';
      logoImg.parentNode.insertBefore(logoWrap, logoImg);
      logoWrap.appendChild(logoImg);
      if (logoImg.classList.contains('leadpages-logo') || logoImg.hasAttribute('data-lp-logo')) {
        logoImg.classList.add('leadpages-logo');
        logoImg.setAttribute('data-lp-logo', 'auto');
      }
    }

    var nav = inner.querySelector('.links, .lp-admin-topbar-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'lp-admin-topbar-nav';
      var extras = inner.querySelectorAll('a, button, span[id]');
      extras.forEach(function (el) {
        if (el.closest('.lp-admin-topbar-logo')) return;
        if (el.classList.contains('lp-admin-topbar-menu')) return;
        nav.appendChild(el);
      });
      inner.appendChild(nav);
    }
    nav.classList.add('lp-admin-topbar-nav');

    if (inner.querySelector('.lp-admin-topbar-menu')) return;

    var menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'lp-admin-topbar-menu';
    menuBtn.setAttribute('aria-label', 'Open navigation');
    menuBtn.innerHTML = '&#9776;';
    inner.appendChild(menuBtn);

    var scrim = document.createElement('div');
    scrim.className = 'lp-admin-topbar-scrim';
    var drawer = document.createElement('aside');
    drawer.className = 'lp-admin-topbar-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    Array.prototype.slice.call(nav.children).forEach(function (el) {
      var clone = el.cloneNode(true);
      clone.addEventListener('click', function (ev) {
        if (el.tagName === 'A' && el.getAttribute('href') === '#') {
          ev.preventDefault();
          el.click();
        } else if (el.tagName === 'BUTTON') {
          ev.preventDefault();
          el.click();
        }
        document.body.classList.remove('lp-admin-nav-open');
      });
      drawer.appendChild(clone);
    });

    document.body.appendChild(scrim);
    document.body.appendChild(drawer);

    function toggleNav(open) {
      document.body.classList.toggle('lp-admin-nav-open', !!open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    menuBtn.addEventListener('click', function () {
      toggleNav(!document.body.classList.contains('lp-admin-nav-open'));
    });
    scrim.addEventListener('click', function () {
      toggleNav(false);
    });
  }

  function boot() {
    var page = (document.body && document.body.getAttribute('data-lp-admin-page')) || '';
    if (page === 'manage' || document.querySelector('.wrap .adminnav')) {
      initManageShell();
    }
    if (page === 'partners-admin' || document.body.classList.contains('partners-admin-page')) {
      initPartnerTopbar({ topbarSelector: '.top' });
    }
    if (page === 'partner-dashboard' || document.body.classList.contains('partner-dash-page')) {
      initPartnerTopbar({ topbarSelector: '.topbar' });
    }
    if (page === 'apps-admin' || document.body.classList.contains('apps-admin-page')) {
      initPartnerTopbar({ topbarSelector: '.topbar' });
    }
    if (page === 'marketplace-admin' || document.body.classList.contains('marketplace-admin-page')) {
      initPartnerTopbar({ topbarSelector: '.topbar' });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.LPAdminShellBoot = boot;
  global.lpPreviewStorageKey = PREVIEW_KEY;
  global.lpPreviewRatioKey = RATIO_KEY;
  global.lpRecommendedPreviewLayout = recommendedPreviewLayout;
})(typeof window !== 'undefined' ? window : globalThis);
