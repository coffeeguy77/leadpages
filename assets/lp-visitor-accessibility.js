/**
 * LeadPages visitor viewing preferences widget (Phase 2).
 * Config via window.__LP_VISITOR_A11Y__ before load.
 *
 * Marketing homepage boots with hideOnMobile + theme/scheme controls off.
 * Widget chrome targets WCAG 2.2 AA patterns (dialog, focus trap, Escape,
 * focus-visible, 44×44px targets). Preference features set data attributes
 * consumed by lp-visitor-themes.css.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leadpages_visitor_accessibility';
  var DEFAULTS = {
    textSize: 'standard',
    contrast: 'standard',
    theme: 'light',
    motion: 'standard',
    links: 'standard',
    spacing: 'standard',
    colorScheme: 'brand'
  };

  var cfg = global.__LP_VISITOR_A11Y__ || {};
  var uiCleanup = null;
  var mobileMqBound = false;

  function read() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function save(prefs) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) { /* ignore */ }
  }

  function mapTextSize(v) {
    if (v === 'large') return 'large';
    if (v === 'larger') return 'larger';
    return 'standard';
  }

  function allowThemeToggle() {
    return !(cfg.defaults && cfg.defaults.allowThemeToggle === false);
  }

  function allowColorSchemes() {
    return !(cfg.defaults && cfg.defaults.allowColorSchemes === false);
  }

  function hideOnMobile() {
    return cfg.hideOnMobile === true;
  }

  function mobileMaxWidth() {
    var n = Number(cfg.mobileMaxWidth);
    return !isNaN(n) && n > 0 ? n : 960;
  }

  function isMobileViewport() {
    try {
      return !!(global.matchMedia && global.matchMedia('(max-width: ' + mobileMaxWidth() + 'px)').matches);
    } catch (e) {
      return false;
    }
  }

  function isPartnerTemplatePage() {
    var body = global.document && global.document.body;
    return !!(body && body.getAttribute('data-pt-template'));
  }

  function apply(prefs) {
    if (isPartnerTemplatePage()) return;
    var root = global.document && global.document.documentElement;
    if (!root) return;
    var p = prefs || {};
    var text = mapTextSize(p.textSize);
    root.dataset.lpVisitorText = text;
    root.dataset.lpVisitorContrast = p.contrast === 'high' ? 'high' : 'standard';
    if (allowThemeToggle()) {
      root.dataset.lpVisitorTheme = p.theme === 'dark' ? 'dark' : 'light';
      if (p.theme === 'dark') root.setAttribute('data-lp-visitor-theme-active', 'dark');
      else root.removeAttribute('data-lp-visitor-theme-active');
    } else {
      root.dataset.lpVisitorTheme = 'light';
      root.removeAttribute('data-lp-visitor-theme-active');
    }
    root.dataset.lpVisitorMotion = p.motion === 'reduced' ? 'reduced' : 'standard';
    root.dataset.lpVisitorLinks = p.links === 'highlight' ? 'highlight' : 'standard';
    root.dataset.lpVisitorSpacing = p.spacing === 'comfortable' ? 'comfortable' : 'standard';
    if (global.document.body) {
      global.document.body.style.fontSize = text === 'larger' ? '1.3125rem' : text === 'large' ? '1.1875rem' : '';
    }
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.apply) {
      var scheme = allowColorSchemes()
        ? (p.colorScheme || (cfg.defaults && cfg.defaults.colorScheme) || 'brand')
        : 'brand';
      global.LPVisitorSchemes.apply(scheme);
    }
  }

  function defaultsFromSite() {
    var va = cfg.defaults || {};
    return {
      textSize: va.defaultTextSize === 'large' ? 'large' : 'standard',
      contrast: va.defaultContrast === 'high' ? 'high' : 'standard',
      theme: 'light',
      motion: va.reducedMotionSupport === false ? 'standard' : 'standard',
      links: 'standard',
      spacing: 'standard',
      colorScheme: va.colorScheme || va.defaultColorScheme || 'brand'
    };
  }

  function loadPrefs() {
    var p = Object.assign({}, defaultsFromSite(), DEFAULTS, read() || {});
    if (!allowThemeToggle()) p.theme = 'light';
    if (!allowColorSchemes()) p.colorScheme = 'brand';
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.readStorage) {
      var sc = global.LPVisitorSchemes.readStorage();
      if (sc && allowColorSchemes()) p.colorScheme = sc;
    }
    return p;
  }

  function _schemeButtons() {
    var schemes = (global.LPVisitorSchemes && global.LPVisitorSchemes.SCHEMES) || {
      brand: { name: 'Brand', emoji: '✦' },
      rose: { name: 'Rose', emoji: '🌸' },
      steel: { name: 'Steel', emoji: '🔩' },
      seasonal: { name: 'Seasonal', emoji: '📅' }
    };
    return Object.keys(schemes).map(function (key) {
      var s = schemes[key];
      return '<button type="button" class="lpa-scheme" data-val="' + key + '" aria-pressed="false" title="' + (s.description || s.name) + '">' +
        '<span class="lpa-scheme-emoji" aria-hidden="true">' + (s.emoji || '') + '</span>' +
        '<span class="lpa-scheme-name">' + s.name + '</span></button>';
    }).join('');
  }

  function syncButtons(root, prefs) {
    root.querySelectorAll('[data-group]').forEach(function (row) {
      var group = row.getAttribute('data-group');
      var val = prefs[group];
      row.querySelectorAll('.lpa-opt, .lpa-scheme').forEach(function (btn) {
        var on = btn.getAttribute('data-val') === val;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  function removeUI() {
    if (typeof uiCleanup === 'function') {
      try { uiCleanup(); } catch (e) { /* ignore */ }
      uiCleanup = null;
    }
    var existing = global.document && global.document.getElementById('lpa-root');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function bindMobileHide() {
    if (mobileMqBound || !hideOnMobile() || !global.matchMedia) return;
    mobileMqBound = true;
    var mq = global.matchMedia('(max-width: ' + mobileMaxWidth() + 'px)');
    var onMq = function () {
      if (!cfg.enabled) {
        removeUI();
        return;
      }
      if (mq.matches) removeUI();
      else buildUI();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  function buildUI() {
    if (!cfg.enabled) {
      removeUI();
      return;
    }
    bindMobileHide();
    if (hideOnMobile() && isMobileViewport()) {
      removeUI();
      return;
    }
    if (global.document.getElementById('lpa-root')) return;

    var pos = cfg.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
    var root = global.document.createElement('div');
    root.id = 'lpa-root';
    root.setAttribute('data-pos', pos);
    root.setAttribute('data-open', 'false');
    if (hideOnMobile()) root.setAttribute('data-hide-mobile', 'true');

    var themeBlock = allowThemeToggle()
      ? ('<fieldset><legend>Theme</legend><div class="lpa-row" data-group="theme" role="group" aria-label="Theme">' +
        '<button type="button" class="lpa-opt" data-val="light" aria-pressed="false">Light</button>' +
        '<button type="button" class="lpa-opt" data-val="dark" aria-pressed="false">Dark</button>' +
        '</div></fieldset>')
      : '';
    var schemeBlock = allowColorSchemes()
      ? ('<fieldset><legend>Colour scheme</legend><div class="lpa-scheme-grid" data-group="colorScheme" role="group" aria-label="Colour scheme">' +
        _schemeButtons() +
        '</div></fieldset>')
      : '';

    root.innerHTML =
      '<button type="button" id="lpa-trigger" aria-expanded="false" aria-controls="lpa-panel" aria-haspopup="dialog" aria-label="Open accessibility viewing preferences">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' +
      '</svg><span>Accessibility</span></button>' +
      '<div id="lpa-panel" role="dialog" aria-labelledby="lpa-panel-title" aria-modal="true" hidden>' +
      '<div class="lpa-panel-head">' +
      '<h2 id="lpa-panel-title">Viewing Preferences</h2>' +
      '<button type="button" id="lpa-close" aria-label="Close viewing preferences">Close</button>' +
      '</div>' +
      '<fieldset><legend>Text size</legend><div class="lpa-row" data-group="textSize" role="group" aria-label="Text size">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false" title="Standard text size" aria-label="Standard text size">A</button>' +
      '<button type="button" class="lpa-opt" data-val="large" aria-pressed="false" title="Large text size" aria-label="Large text size">A+</button>' +
      '<button type="button" class="lpa-opt" data-val="larger" aria-pressed="false" title="Larger text size" aria-label="Larger text size">A++</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Contrast</legend><div class="lpa-row" data-group="contrast" role="group" aria-label="Contrast">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="high" aria-pressed="false">High</button>' +
      '</div></fieldset>' +
      themeBlock +
      '<fieldset><legend>Motion</legend><div class="lpa-row" data-group="motion" role="group" aria-label="Motion">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="reduced" aria-pressed="false">Reduced</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Links</legend><div class="lpa-row" data-group="links" role="group" aria-label="Links">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="highlight" aria-pressed="false">Highlight</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Spacing</legend><div class="lpa-row" data-group="spacing" role="group" aria-label="Spacing">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="comfortable" aria-pressed="false">Comfortable</button>' +
      '</div></fieldset>' +
      schemeBlock +
      '<button type="button" id="lpa-reset">Reset preferences</button>' +
      '</div>';

    global.document.body.appendChild(root);

    var prefs = loadPrefs();
    apply(prefs);
    syncButtons(root, prefs);

    var trigger = root.querySelector('#lpa-trigger');
    var panel = root.querySelector('#lpa-panel');
    var closeBtn = root.querySelector('#lpa-close');
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var signal = ac ? { signal: ac.signal } : undefined;
    uiCleanup = function () {
      if (ac) ac.abort();
    };

    function focusables() {
      return panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }

    function setOpen(open) {
      root.setAttribute('data-open', open ? 'true' : 'false');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        panel.hidden = false;
        panel.removeAttribute('hidden');
        var first = panel.querySelector('#lpa-close') ||
          panel.querySelector('.lpa-opt[aria-pressed="true"]') ||
          panel.querySelector('.lpa-opt');
        if (first && first.focus) first.focus();
      } else {
        panel.hidden = true;
        panel.setAttribute('hidden', '');
        if (trigger && trigger.focus) trigger.focus();
      }
    }

    trigger.addEventListener('click', function () {
      setOpen(root.getAttribute('data-open') !== 'true');
    }, signal);

    closeBtn.addEventListener('click', function () {
      setOpen(false);
    }, signal);

    global.document.addEventListener('keydown', function (ev) {
      if (!root.isConnected && root.parentNode == null) return;
      if (root.getAttribute('data-open') !== 'true') return;
      if (ev.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (ev.key !== 'Tab') return;
      var list = Array.prototype.slice.call(focusables());
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (ev.shiftKey && global.document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && global.document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }, signal);

    global.document.addEventListener('click', function (ev) {
      if (root.getAttribute('data-open') !== 'true') return;
      if (!root.contains(ev.target)) setOpen(false);
    }, signal);

    root.querySelectorAll('.lpa-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.parentElement && btn.parentElement.getAttribute('data-group');
        var val = btn.getAttribute('data-val');
        if (!group) return;
        if (group === 'theme' && !allowThemeToggle()) return;
        prefs[group] = val;
        save(prefs);
        apply(prefs);
        syncButtons(root, prefs);
      }, signal);
    });

    root.querySelectorAll('.lpa-scheme').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!allowColorSchemes()) return;
        var val = btn.getAttribute('data-val');
        prefs.colorScheme = val;
        save(prefs);
        if (global.LPVisitorSchemes && global.LPVisitorSchemes.setScheme) {
          global.LPVisitorSchemes.setScheme(val, true);
        }
        apply(prefs);
        syncButtons(root, prefs);
      }, signal);
    });

    root.querySelector('#lpa-reset').addEventListener('click', function () {
      try {
        global.localStorage.removeItem(STORAGE_KEY);
        if (global.LPVisitorSchemes && global.LPVisitorSchemes.STORAGE_KEY) {
          global.localStorage.removeItem(global.LPVisitorSchemes.STORAGE_KEY);
        }
      } catch (e) { /* ignore */ }
      prefs = defaultsFromSite();
      if (!allowThemeToggle()) prefs.theme = 'light';
      if (!allowColorSchemes()) prefs.colorScheme = 'brand';
      apply(prefs);
      syncButtons(root, prefs);
    }, signal);
  }

  function boot() {
    if (typeof global.applyVisitorAppearance === 'function' && cfg.defaults) {
      try {
        global.applyVisitorAppearance({ visitorAppearance: cfg.defaults });
      } catch (e) { /* ignore */ }
    }
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.boot) {
      global.LPVisitorSchemes.boot(cfg);
    }
    var prefs = loadPrefs();
    apply(prefs);
    bindMobileHide();
    buildUI();
  }

  function sync(nextCfg) {
    cfg = Object.assign({}, cfg, nextCfg || {});
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.boot) {
      global.LPVisitorSchemes.boot(cfg);
    }
    var prefs = loadPrefs();
    apply(prefs);
    if (!cfg.enabled) {
      removeUI();
      return;
    }
    removeUI();
    bindMobileHide();
    buildUI();
  }

  function ensureAssets(cb) {
    loadStylesheet('/assets/lp-visitor-themes.css');
    loadStylesheet('/assets/lp-visitor-schemes.css');
    loadStylesheet('/assets/lp-visitor-accessibility.css');
    if (global.LPVisitorSchemes && global.LPVisitorAccessibility) {
      cb();
      return;
    }
    loadScript('/assets/lp-visitor-schemes.js').then(function () {
      return loadScript('/assets/lp-visitor-accessibility.js');
    }).then(cb).catch(function () { /* ignore */ });
  }

  function loadStylesheet(href) {
    if (!global.document || global.document.querySelector('link[href="' + href + '"]')) return;
    var link = global.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    global.document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!global.document) return resolve();
      if (global.document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = global.document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script ' + src)); };
      global.document.body.appendChild(s);
    });
  }

  function visitorWidgetOnFromConfig(C) {
    C = C || {};
    var va = C.visitorAppearance || {};
    var sec = C.sections && C.sections.lpAccessibility;
    if (va.showAccessibilityButton === false) return false;
    if (sec && sec.on === false) return false;
    if (va.allowVisitorControls === true) return true;
    if (sec && sec.on === true) return true;
    return false;
  }

  function syncFromSiteConfig(C) {
    var va = (C && C.visitorAppearance) || {};
    var enabled = visitorWidgetOnFromConfig(C);
    var next = {
      enabled: enabled,
      position: va.accessibilityButtonPosition || 'bottom-right',
      defaults: va
    };
    if (global.LPVisitorAccessibility && global.LPVisitorAccessibility.sync) {
      global.LPVisitorAccessibility.sync(next);
      return;
    }
    global.__LP_VISITOR_A11Y__ = next;
    if (!enabled) return;
    ensureAssets(function () {
      if (global.LPVisitorAccessibility && global.LPVisitorAccessibility.sync) {
        global.LPVisitorAccessibility.sync(next);
      }
    });
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else if (global.document) {
    boot();
  }

  global.LPVisitorAccessibility = {
    STORAGE_KEY: STORAGE_KEY,
    load: loadPrefs,
    apply: apply,
    save: save,
    sync: sync,
    syncFromSiteConfig: syncFromSiteConfig,
    visitorWidgetOnFromConfig: visitorWidgetOnFromConfig,
    ensureAssets: ensureAssets,
    mapTextSize: mapTextSize,
    allowThemeToggle: allowThemeToggle,
    allowColorSchemes: allowColorSchemes,
    hideOnMobile: hideOnMobile,
    isMobileViewport: isMobileViewport,
    removeUI: removeUI,
    buildUI: buildUI,
    bindMobileHide: bindMobileHide
  };
})(typeof window !== 'undefined' ? window : globalThis);
