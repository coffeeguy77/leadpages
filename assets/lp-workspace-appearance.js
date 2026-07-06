/**
 * LeadPages workspace appearance preferences (Phase 1).
 * Stored in localStorage only — no Supabase schema.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leadpages_workspace_appearance';

  var LOGO = {
    light: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782665886/leadpages-logo-white.png',
    dark: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782665885/leadpages-logo-black.png'
  };

  var DEFAULTS = {
    theme: 'classic-light',
    density: 'comfortable',
    textSize: 'standard',
    reducedMotion: false,
    highContrast: false,
    strongFocus: true
  };

  var THEME_META = {
    'classic-light': {
      name: 'Classic Light',
      description: 'Clean, warm, and familiar.',
      mode: 'light',
      logo: LOGO.light
    },
    'command-dark': {
      name: 'Command Dark',
      description: 'Premium dark workspace for long sessions.',
      mode: 'dark',
      logo: LOGO.dark
    },
    blush: {
      name: 'Blush',
      description: 'Soft rose theme for boutique and lifestyle brands.',
      mode: 'light',
      logo: LOGO.light
    },
    blueprint: {
      name: 'Blueprint',
      description: 'Professional blue theme for service and trade businesses.',
      mode: 'light',
      logo: LOGO.light
    },
    system: {
      name: 'System Default',
      description: 'Follows your device light or dark preference.',
      mode: 'auto',
      logo: LOGO.light
    }
  };

  function readStorage() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    var stored = readStorage();
    return Object.assign({}, DEFAULTS, stored || {});
  }

  function save(prefs) {
    var merged = Object.assign({}, DEFAULTS, prefs || {});
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) { /* ignore quota errors */ }
    return merged;
  }

  function resolveTheme(theme) {
    if (theme === 'system') {
      try {
        return global.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'command-dark'
          : 'classic-light';
      } catch (e) {
        return 'classic-light';
      }
    }
    var allowed = ['classic-light', 'command-dark', 'blush', 'blueprint'];
    return allowed.indexOf(theme) >= 0 ? theme : 'classic-light';
  }

  function logoForResolved(resolved) {
    var meta = THEME_META[resolved];
    if (meta && meta.logo) return meta.logo;
    if (meta && meta.mode === 'dark') return LOGO.dark;
    return LOGO.light;
  }

  function applyLogos(resolved) {
    if (!global.document) return;
    var url = logoForResolved(resolved);
    global.document.querySelectorAll('.leadpages-logo, [data-lp-logo="auto"]').forEach(function (el) {
      if (el && el.tagName === 'IMG') el.src = url;
    });
  }

  function apply(prefs) {
    var p = Object.assign({}, DEFAULTS, prefs || {});
    var root = global.document && global.document.documentElement;
    if (!root) return p;

    var resolved = resolveTheme(p.theme);
    root.dataset.theme = resolved;
    root.dataset.lpThemeChoice = p.theme;
    root.dataset.lpDensity = p.density === 'compact' ? 'compact' : 'comfortable';
    root.dataset.lpTextSize =
      p.textSize === 'extra-large' ? 'extra-large' : p.textSize === 'large' ? 'large' : 'standard';
    root.dataset.lpReducedMotion = p.reducedMotion ? 'true' : 'false';
    root.dataset.lpHighContrast = p.highContrast ? 'true' : 'false';
    root.dataset.lpStrongFocus = p.strongFocus !== false ? 'true' : 'false';

    applyLogos(resolved);

    try {
      global.dispatchEvent(new CustomEvent('lp-workspace-appearance-change', { detail: p }));
    } catch (e) { /* ignore */ }

    return p;
  }

  function set(partial) {
    var next = save(Object.assign({}, load(), partial || {}));
    apply(next);
    return next;
  }

  var systemMq = null;

  function onSystemThemeChange() {
    var p = load();
    if (p.theme === 'system') apply(p);
  }

  function bindSystemListener() {
    try {
      if (!global.matchMedia) return;
      systemMq = global.matchMedia('(prefers-color-scheme: dark)');
      if (systemMq.addEventListener) {
        systemMq.addEventListener('change', onSystemThemeChange);
      } else if (systemMq.addListener) {
        systemMq.addListener(onSystemThemeChange);
      }
    } catch (e) { /* ignore */ }
  }

  function init() {
    apply(load());
    bindSystemListener();
  }

  global.LPWorkspaceAppearance = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULTS: DEFAULTS,
    THEME_META: THEME_META,
    LOGO: LOGO,
    load: load,
    save: save,
    set: set,
    apply: apply,
    resolveTheme: resolveTheme,
    logoForResolved: logoForResolved,
    applyLogos: applyLogos,
    init: init
  };

  if (global.document && global.document.documentElement) {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
