/**
 * LeadPages visitor colour scheme picker (frontend look & feel).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leadpages_visitor_colour_scheme';

  var SCHEMES = {
    brand: { name: 'Brand', description: 'Your site colours', emoji: '✦' },
    rose: { name: 'Rose', description: 'Soft blush — salons & lifestyle', emoji: '🌸' },
    steel: { name: 'Steel', description: 'Navy & steel — tradies & pros', emoji: '🔩' },
    autumn: { name: 'Autumn', description: 'Warm amber tones', emoji: '🍂' },
    winter: { name: 'Winter', description: 'Cool frost & ice', emoji: '❄️' },
    spring: { name: 'Spring', description: 'Fresh greens', emoji: '🌿' },
    summer: { name: 'Summer', description: 'Bright & sunny', emoji: '☀️' },
    festive: { name: 'Festive', description: 'Holiday season', emoji: '🎄' },
    seasonal: { name: 'Seasonal', description: 'Changes with the season', emoji: '📅' }
  };

  var SEASONAL_MAP = {
    0: 'summer',
    1: 'summer',
    2: 'autumn',
    3: 'autumn',
    4: 'autumn',
    5: 'winter',
    6: 'winter',
    7: 'winter',
    8: 'spring',
    9: 'spring',
    10: 'spring',
    11: 'festive'
  };

  function readStorage() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw || null;
    } catch (e) {
      return null;
    }
  }

  function saveStorage(scheme) {
    try {
      if (!scheme || scheme === 'brand') global.localStorage.removeItem(STORAGE_KEY);
      else global.localStorage.setItem(STORAGE_KEY, scheme);
    } catch (e) { /* ignore */ }
  }

  function resolveSeasonal() {
    try {
      return SEASONAL_MAP[new Date().getMonth()] || 'spring';
    } catch (e) {
      return 'spring';
    }
  }

  function resolveScheme(key) {
    if (!key || key === 'brand') return 'brand';
    if (key === 'seasonal') return resolveSeasonal();
    return SCHEMES[key] ? key : 'brand';
  }

  function effectiveScheme(key) {
    return resolveScheme(key);
  }

  function apply(schemeKey) {
    var root = global.document && global.document.documentElement;
    if (!root) return;
    var resolved = effectiveScheme(schemeKey);
    if (!schemeKey || schemeKey === 'brand' || resolved === 'brand') {
      root.removeAttribute('data-lp-visitor-scheme');
      root.removeAttribute('data-lp-visitor-scheme-choice');
    } else {
      root.setAttribute('data-lp-visitor-scheme', resolved);
      root.setAttribute('data-lp-visitor-scheme-choice', schemeKey);
    }
    if (global.LPLogo && global.LPLogo.upgradeAll) {
      global.LPLogo.upgradeAll({ pulse: true });
    }
  }

  function loadFromConfig(cfg) {
    cfg = cfg || {};
    var va = cfg.visitorAppearance || cfg.defaults || cfg || {};
    var stored = readStorage();
    if (stored && va.allowColorSchemes !== false) return stored;
    return va.colorScheme || va.defaultColorScheme || 'brand';
  }

  function boot(cfg) {
    apply(loadFromConfig(cfg || (global.__LP_VISITOR_A11Y__ && global.__LP_VISITOR_A11Y__.defaults) || {}));
  }

  function setScheme(key, persist) {
    if (persist !== false) saveStorage(key);
    apply(key);
    try {
      global.dispatchEvent(new CustomEvent('lp-visitor-scheme-change', { detail: { scheme: key } }));
    } catch (e) { /* ignore */ }
  }

  global.LPVisitorSchemes = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMES: SCHEMES,
    readStorage: readStorage,
    resolveScheme: resolveScheme,
    effectiveScheme: effectiveScheme,
    apply: apply,
    boot: boot,
    setScheme: setScheme,
    loadFromConfig: loadFromConfig
  };

  global.applyVisitorColourScheme = function (key) {
    setScheme(key, true);
  };
})(typeof window !== 'undefined' ? window : globalThis);
