/**
 * LeadPages visitor viewing preferences widget (Phase 2).
 * Config via window.__LP_VISITOR_A11Y__ before load.
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
    if (v === 'small') return 'standard';
    if (v === 'large') return 'large';
    if (v === 'larger') return 'larger';
    return 'standard';
  }

  function apply(prefs) {
    var root = global.document && global.document.documentElement;
    if (!root) return;
    var p = prefs || {};
    var text = mapTextSize(p.textSize);
    root.dataset.lpVisitorText = text;
    root.dataset.lpVisitorContrast = p.contrast === 'high' ? 'high' : 'standard';
    root.dataset.lpVisitorTheme = p.theme === 'dark' ? 'dark' : 'light';
    root.dataset.lpVisitorMotion = p.motion === 'reduced' ? 'reduced' : 'standard';
    root.dataset.lpVisitorLinks = p.links === 'highlight' ? 'highlight' : 'standard';
    root.dataset.lpVisitorSpacing = p.spacing === 'comfortable' ? 'comfortable' : 'standard';
    if (global.document.body) {
      global.document.body.style.fontSize = text === 'larger' ? '1.3125rem' : text === 'large' ? '1.1875rem' : '';
    }
    if (p.theme === 'dark') root.setAttribute('data-lp-visitor-theme-active', 'dark');
    else root.removeAttribute('data-lp-visitor-theme-active');
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.apply) {
      var scheme = p.colorScheme || (cfg.defaults && cfg.defaults.colorScheme) || 'brand';
      if (cfg.defaults && cfg.defaults.allowColorSchemes === false) scheme = 'brand';
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
    if (global.LPVisitorSchemes && global.LPVisitorSchemes.readStorage) {
      var sc = global.LPVisitorSchemes.readStorage();
      if (sc) p.colorScheme = sc;
    }
    return p;
  }

  function textBtnLabel(size) {
    if (size === 'small') return 'A-';
    if (size === 'large') return 'A+';
    return 'A';
  }

  function cycleTextSize(cur) {
    if (cur === 'standard') return 'large';
    if (cur === 'large') return 'larger';
    return 'standard';
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

  function buildUI() {
    if (!cfg.enabled) return;
    if (global.document.getElementById('lpa-root')) return;

    var pos = cfg.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
    var root = global.document.createElement('div');
    root.id = 'lpa-root';
    root.setAttribute('data-pos', pos);
    root.setAttribute('data-open', 'false');

    root.innerHTML =
      '<button type="button" id="lpa-trigger" aria-expanded="false" aria-controls="lpa-panel">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' +
      '</svg><span>Accessibility</span></button>' +
      '<div id="lpa-panel" role="dialog" aria-label="Viewing Preferences" aria-modal="false">' +
      '<h2>Viewing Preferences</h2>' +
      '<fieldset><legend>Text size</legend><div class="lpa-row" data-group="textSize">' +
      '<button type="button" class="lpa-opt" data-val="small" aria-pressed="false">A-</button>' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">A</button>' +
      '<button type="button" class="lpa-opt" data-val="large" aria-pressed="false">A+</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Contrast</legend><div class="lpa-row" data-group="contrast">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="high" aria-pressed="false">High</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Theme</legend><div class="lpa-row" data-group="theme">' +
      '<button type="button" class="lpa-opt" data-val="light" aria-pressed="false">Light</button>' +
      '<button type="button" class="lpa-opt" data-val="dark" aria-pressed="false">Dark</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Motion</legend><div class="lpa-row" data-group="motion">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="reduced" aria-pressed="false">Reduced</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Links</legend><div class="lpa-row" data-group="links">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="highlight" aria-pressed="false">Highlight</button>' +
      '</div></fieldset>' +
      '<fieldset><legend>Spacing</legend><div class="lpa-row" data-group="spacing">' +
      '<button type="button" class="lpa-opt" data-val="standard" aria-pressed="false">Standard</button>' +
      '<button type="button" class="lpa-opt" data-val="comfortable" aria-pressed="false">Comfortable</button>' +
      '</div></fieldset>' +
      (cfg.defaults && cfg.defaults.allowColorSchemes === false ? '' :
        '<fieldset><legend>Colour scheme</legend><div class="lpa-scheme-grid" data-group="colorScheme">' +
        _schemeButtons() +
        '</div></fieldset>') +
      '<button type="button" id="lpa-reset">Reset preferences</button>' +
      '</div>';

    global.document.body.appendChild(root);

    var prefs = loadPrefs();
    apply(prefs);
    syncButtons(root, prefs);

    var trigger = root.querySelector('#lpa-trigger');
    var panel = root.querySelector('#lpa-panel');

    function setOpen(open) {
      root.setAttribute('data-open', open ? 'true' : 'false');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var first = panel.querySelector('.lpa-opt[aria-pressed="true"]') || panel.querySelector('.lpa-opt');
        if (first) first.focus();
      }
    }

    trigger.addEventListener('click', function () {
      setOpen(root.getAttribute('data-open') !== 'true');
    });

    global.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && root.getAttribute('data-open') === 'true') {
        setOpen(false);
        trigger.focus();
      }
    });

    root.querySelectorAll('.lpa-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.parentElement && btn.parentElement.getAttribute('data-group');
        var val = btn.getAttribute('data-val');
        if (!group) return;
        prefs[group] = val;
        save(prefs);
        apply(prefs);
        syncButtons(root, prefs);
      });
    });

    root.querySelectorAll('.lpa-scheme').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-val');
        prefs.colorScheme = val;
        save(prefs);
        if (global.LPVisitorSchemes && global.LPVisitorSchemes.setScheme) {
          global.LPVisitorSchemes.setScheme(val, true);
        }
        apply(prefs);
        syncButtons(root, prefs);
      });
    });

    root.querySelector('#lpa-reset').addEventListener('click', function () {
      try {
        global.localStorage.removeItem(STORAGE_KEY);
        if (global.LPVisitorSchemes && global.LPVisitorSchemes.STORAGE_KEY) {
          global.localStorage.removeItem(global.LPVisitorSchemes.STORAGE_KEY);
        }
      } catch (e) { /* ignore */ }
      prefs = defaultsFromSite();
      apply(prefs);
      syncButtons(root, prefs);
    });
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
      var existing = global.document && global.document.getElementById('lpa-root');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
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

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
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
    ensureAssets: ensureAssets
  };
})(typeof window !== 'undefined' ? window : globalThis);
