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
    spacing: 'standard'
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
    if (p.theme === 'dark') root.setAttribute('data-lp-visitor-theme-active', 'dark');
    else root.removeAttribute('data-lp-visitor-theme-active');
  }

  function defaultsFromSite() {
    var va = cfg.defaults || {};
    return {
      textSize: va.defaultTextSize === 'large' ? 'large' : 'standard',
      contrast: va.defaultContrast === 'high' ? 'high' : 'standard',
      theme: 'light',
      motion: va.reducedMotionSupport === false ? 'standard' : 'standard',
      links: 'standard',
      spacing: 'standard'
    };
  }

  function loadPrefs() {
    return Object.assign({}, defaultsFromSite(), DEFAULTS, read() || {});
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
      '</svg><span>Viewing Preferences</span></button>' +
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

    root.querySelector('#lpa-reset').addEventListener('click', function () {
      try {
        global.localStorage.removeItem(STORAGE_KEY);
      } catch (e) { /* ignore */ }
      prefs = defaultsFromSite();
      apply(prefs);
      syncButtons(root, prefs);
    });
  }

  function syncButtons(root, prefs) {
    root.querySelectorAll('[data-group]').forEach(function (row) {
      var group = row.getAttribute('data-group');
      var val = prefs[group];
      row.querySelectorAll('.lpa-opt').forEach(function (btn) {
        var on = btn.getAttribute('data-val') === val;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  function boot() {
    if (typeof global.applyVisitorAppearance === 'function' && cfg.defaults) {
      try {
        global.applyVisitorAppearance({ visitorAppearance: cfg.defaults });
      } catch (e) { /* ignore */ }
    }
    var prefs = loadPrefs();
    apply(prefs);
    buildUI();
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
    save: save
  };
})(typeof window !== 'undefined' ? window : globalThis);
