/**
 * LeadPages workspace appearance preferences (Phase 1).
 * Stored in localStorage only — no Supabase schema.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leadpages_workspace_appearance';

  var LOGO_SVG = '/assets/leadpages-logo.svg';

  var LOGO_THEME = {
    'classic-light': { accent: '#1f7a63', ink: '#13161b' },
    'command-dark': { accent: '#2ecc8f', ink: '#eef2f7' },
    'neon-pink': { accent: '#ff4da6', ink: '#fce8f3' },
    'electric-blue': { accent: '#3b9eff', ink: '#e8f2ff' },
    blush: { accent: '#c45c7a', ink: '#2a1f2e' },
    blueprint: { accent: '#2563eb', ink: '#1a2a3a' },
    'studio-light': { accent: '#127a5a', ink: '#0f1115' },
    'studio-dark': { accent: '#3ddc97', ink: '#f1f2f4' }
  };

  var DEFAULTS = {
    theme: 'classic-light',
    density: 'comfortable',
    textSize: 'standard',
    reducedMotion: false,
    highContrast: false,
    strongFocus: true,
    // Interface: 'classic' (current look) or 'v2' (new look, opt-in) — assets/lp-ui.css.
    ui: 'classic',
    // New look menu: 'side' (sidebar, icons + text) or 'top' (top menu).
    nav: 'side',
    sideCollapsed: false
  };

  var THEME_META = {
    'classic-light': {
      name: 'Classic Light',
      description: 'Clean, warm, and familiar.',
      mode: 'light'
    },
    'command-dark': {
      name: 'Command Dark',
      description: 'Premium dark workspace for long sessions.',
      mode: 'dark'
    },
    'neon-pink': {
      name: 'Neon Pink',
      description: 'Bold dark workspace with vivid pink accents.',
      mode: 'dark'
    },
    'electric-blue': {
      name: 'Electric Blue',
      description: 'Sleek dark workspace with electric blue highlights.',
      mode: 'dark'
    },
    blush: {
      name: 'Blush',
      description: 'Soft rose theme for boutique and lifestyle brands.',
      mode: 'light'
    },
    blueprint: {
      name: 'Blueprint',
      description: 'Professional blue theme for service and trade businesses.',
      mode: 'light'
    },
    'studio-light': {
      name: 'Studio Light',
      description: 'Crisp neutral workspace — made for the new look.',
      mode: 'light'
    },
    'studio-dark': {
      name: 'Studio Dark',
      description: 'Deep, quiet dark workspace — made for the new look.',
      mode: 'dark'
    },
    system: {
      name: 'System Default',
      description: 'Follows your device light or dark preference.',
      mode: 'auto'
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
    var allowed = ['classic-light', 'command-dark', 'neon-pink', 'electric-blue', 'blush', 'blueprint', 'studio-light', 'studio-dark'];
    return allowed.indexOf(theme) >= 0 ? theme : 'classic-light';
  }

  function logoTokensForResolved(resolved) {
    var tokens = LOGO_THEME[resolved];
    if (tokens) return tokens;
    return LOGO_THEME['classic-light'];
  }

  function logoForResolved(resolved) {
    return LOGO_SVG;
  }

  function applyLogos(resolved) {
    if (!global.document) return;
    var tokens = logoTokensForResolved(resolved);
    var root = global.document.documentElement;
    root.style.setProperty('--lp-logo-accent', tokens.accent);
    root.style.setProperty('--lp-logo-ink', tokens.ink);
    if (global.LPLogo) {
      if (global.LPLogo.refreshWorkspaceLogos) {
        global.LPLogo.refreshWorkspaceLogos({ theme: resolved });
      } else {
        if (global.LPLogo.upgradeAll) global.LPLogo.upgradeAll({ pulse: true, theme: resolved });
        if (global.LPLogo.applyWorkspaceTheme) global.LPLogo.applyWorkspaceTheme();
      }
    }
  }

  /** The new look stylesheet — pages may link it themselves; this loads it on any page that doesn't. */
  var UI_CSS = '/assets/lp-ui.css?v=1';
  function ensureUiCss() {
    var d = global.document;
    if (!d || !d.head) return;
    if (!d.getElementById('lp-ui-font')) {
      var f = d.createElement('link'); f.rel = 'stylesheet'; f.id = 'lp-ui-font';
      f.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      d.head.appendChild(f);
    }
    if (d.querySelector('link[href^="/assets/lp-ui.css"]')) return;
    var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = UI_CSS; l.id = 'lp-ui-css';
    d.head.appendChild(l);
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
    root.dataset.lpUi = p.ui === 'v2' ? 'v2' : 'classic';
    root.dataset.lpNav = p.nav === 'top' ? 'top' : 'side';
    root.dataset.lpSideCollapsed = p.sideCollapsed ? 'true' : 'false';
    if (p.ui === 'v2') ensureUiCss();

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
    LOGO_SVG: LOGO_SVG,
    LOGO_THEME: LOGO_THEME,
    load: load,
    save: save,
    set: set,
    apply: apply,
    resolveTheme: resolveTheme,
    logoForResolved: logoForResolved,
    logoTokensForResolved: logoTokensForResolved,
    applyLogos: applyLogos,
    init: init
  };

  if (global.document && global.document.documentElement) {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
