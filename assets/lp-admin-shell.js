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

    var shell = document.createElement('header');
    shell.id = 'lp-admin-shell';
    shell.className = 'lp-admin-shell';
    shell.innerHTML =
      '<div class="lp-admin-shell-inner">'
      + '<button type="button" class="lp-shell-menu" id="lp-shell-menu" aria-label="Open menu" aria-expanded="false">&#9776;</button>'
      + '<a href="/manage" class="lp-shell-logo-link"><img class="leadpages-logo lp-shell-logo" data-lp-logo="auto" src="https://res.cloudinary.com/dzx6x1hou/image/upload/v1782665886/leadpages-logo-white.png" alt="LeadPages"></a>'
      + '<span class="lp-shell-spacer"></span>'
      + '<div class="lp-shell-tools">'
      + '<div class="lp-ratio-ctrl" id="lp-shell-ratio" title="Editor / preview split">'
      + '<button type="button" class="lp-ratio-btn" id="lp-ratio-minus" aria-label="More preview space">&#8722;</button>'
      + '<span class="lp-ratio-val" data-lp-ratio-val>70/30</span>'
      + '<button type="button" class="lp-ratio-btn" id="lp-ratio-plus" aria-label="More editor space">&#43;</button>'
      + '</div>'
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
      '<div class="lp-drawer-head"><span>Menu</span>'
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

    function setDrawer(open) {
      document.body.classList.toggle('lp-drawer-open', !!open);
      var btn = document.getElementById('lp-shell-menu');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function moveChrome() {
      var mobile = isMobileLayout();
      var inner = drawerInner;
      if (!inner) return;
      if (mobile) {
        document.body.classList.add('lp-compact-chrome');
        while (inner.firstChild) inner.removeChild(inner.firstChild);
        appendDrawerPiece(inner, document.getElementById('lpc-drawer-top'), 'lp-drawer-section-label', 'Quick actions');
        appendDrawerPiece(inner, document.getElementById('lpc-context'), 'lp-drawer-section-label lp-drawer-site-label', 'Site');
        appendDrawerPiece(inner, adminnav, 'lp-drawer-section-label', 'Pages');
        appendDrawerPiece(inner, document.getElementById('lpc-tools'), 'lp-drawer-section-label lp-drawer-tools-label', 'Site tools');
        appendDrawerPiece(inner, document.getElementById('lpc-drawer-footer'), 'lp-drawer-section-label lp-drawer-footer-label', 'Account');
        var prim = document.getElementById('lpc-primary');
        if (prim) prim.style.display = 'none';
      } else {
        document.body.classList.remove('lp-compact-chrome');
        setDrawer(false);
        if (adminnav && navHome && adminnav.parentNode !== navHome) navHome.appendChild(adminnav);
        if (cmd && cmdHome && cmd.parentNode !== cmdHome) cmdHome.appendChild(cmd);
        while (inner.firstChild) inner.removeChild(inner.firstChild);
        var prim2 = document.getElementById('lpc-primary');
        if (prim2) prim2.style.display = '';
      }
      syncRatioVisibility();
    }

    function syncRatioVisibility() {
      var layout = global.lpGetPreviewLayout ? global.lpGetPreviewLayout() : 'off';
      var show = layout === 'split' || layout === 'side';
      var ctrl = document.getElementById('lp-shell-ratio');
      var prevCtrl = document.getElementById('lp-prev-ratio');
      if (ctrl) ctrl.hidden = !show;
      if (prevCtrl) prevCtrl.hidden = !show;
    }

    function syncLayoutSelect() {
      var sel = document.getElementById('lp-prev-layout-sel');
      var val = global.lpGetPreviewLayout ? global.lpGetPreviewLayout() : loadPref(PREVIEW_KEY, 'off');
      if (val === 'fullscreen') val = 'split';
      if (sel) sel.value = val;
      syncRatioVisibility();
    }

    document.getElementById('lp-shell-menu').addEventListener('click', function () {
      setDrawer(!document.body.classList.contains('lp-drawer-open'));
    });
    document.getElementById('lp-drawer-close').addEventListener('click', function () {
      setDrawer(false);
    });
    scrim.addEventListener('click', function () {
      setDrawer(false);
    });

    document.getElementById('lp-ratio-minus').addEventListener('click', function () {
      adjustEditorRatio(-RATIO_STEP);
    });
    document.getElementById('lp-ratio-plus').addEventListener('click', function () {
      adjustEditorRatio(RATIO_STEP);
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
      if (ratioMinus) adjustEditorRatio(-RATIO_STEP);
      if (ratioPlus) adjustEditorRatio(RATIO_STEP);
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
