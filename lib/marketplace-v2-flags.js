/**
 * Public marketplace V2 feature flags.
 * Server: read from process.env.
 * Browser: window.__LP_MARKETPLACE_FLAGS__ (injected) + ?v2=1 / localStorage overrides.
 */

var FLAG_KEYS = [
  'APP_MARKETPLACE_V2',
  'APP_DEMO_PAGES',
  'APP_DEMO_PRESETS',
  'APP_DEMO_BUILDER',
  'APP_MARKETPLACE_PLAYGROUND',
  'APP_MARKETPLACE_ACCESS_LABELS',
  'APP_MARKETPLACE_PREMIUM',
  'APP_MARKETPLACE_THEME_INHERITANCE'
];

function envOn(name, fallback) {
  var raw = typeof process !== 'undefined' && process.env ? process.env[name] : '';
  if (raw === undefined || raw === null || raw === '') return !!fallback;
  var s = String(raw).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false;
  return true;
}

function readBrowserOverrides() {
  var out = {};
  if (typeof window === 'undefined') return out;
  try {
    var params = new URLSearchParams(window.location.search || '');
    if (params.has('v2')) {
      var v = params.get('v2');
      var on = !(v === '0' || v === 'false' || v === 'off');
      FLAG_KEYS.forEach(function (k) { out[k] = on; });
      try {
        window.localStorage.setItem('lp_marketplace_v2', on ? '1' : '0');
      } catch (_e) {}
    } else {
      var stored = window.localStorage.getItem('lp_marketplace_v2');
      if (stored === '1' || stored === '0') {
        var storedOn = stored === '1';
        FLAG_KEYS.forEach(function (k) { out[k] = storedOn; });
      }
    }
  } catch (_e2) {}
  return out;
}

function getFlags(injected) {
  var base = {};
  FLAG_KEYS.forEach(function (k) {
    base[k] = envOn(k, false);
  });
  if (injected && typeof injected === 'object') {
    FLAG_KEYS.forEach(function (k) {
      if (typeof injected[k] === 'boolean') base[k] = injected[k];
    });
  }
  if (typeof window !== 'undefined') {
    var winFlags = window.__LP_MARKETPLACE_FLAGS__;
    if (winFlags && typeof winFlags === 'object') {
      FLAG_KEYS.forEach(function (k) {
        if (typeof winFlags[k] === 'boolean') base[k] = winFlags[k];
      });
    }
    var overrides = readBrowserOverrides();
    FLAG_KEYS.forEach(function (k) {
      if (typeof overrides[k] === 'boolean') base[k] = overrides[k];
    });
  }
  return base;
}

function isV2(flags) {
  var f = flags || getFlags();
  return !!f.APP_MARKETPLACE_V2;
}

function flagsScriptTag(flags) {
  var f = flags || getFlags();
  var payload = {};
  FLAG_KEYS.forEach(function (k) { payload[k] = !!f[k]; });
  return '<script>window.__LP_MARKETPLACE_FLAGS__=' + JSON.stringify(payload) + ';</script>';
}

var api = {
  FLAG_KEYS: FLAG_KEYS,
  envOn: envOn,
  getFlags: getFlags,
  isV2: isV2,
  flagsScriptTag: flagsScriptTag
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.LPMarketplaceFlags = api;
}
