'use strict';

/**
 * Site-wide colour remap (Branding → Colour override).
 * Replaces exact hex colours after theme tokens are applied.
 */

function expandShortHex(hex) {
  var h = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return (
      '#' +
      h.charAt(1) +
      h.charAt(1) +
      h.charAt(2) +
      h.charAt(2) +
      h.charAt(3) +
      h.charAt(3)
    ).toLowerCase();
  }
  return h;
}

function normalizeHex(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (s.charAt(0) !== '#') s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = expandShortHex(s);
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return '';
  return s.toLowerCase();
}

function parseRgbToHex(str) {
  var m = String(str || '').match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i
  );
  if (!m) return '';
  function cl(n) {
    n = +n;
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
  }
  var r = cl(m[1]),
    g = cl(m[2]),
    b = cl(m[3]);
  return (
    '#' +
    [r, g, b]
      .map(function (x) {
        return ('0' + x.toString(16)).slice(-2);
      })
      .join('')
  );
}

function normalizeColorInput(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var hex = normalizeHex(s);
  if (hex) return hex;
  return normalizeHex(parseRgbToHex(s));
}

/**
 * @param {Array<{from?:string,to?:string,id?:string}>|null} overrides
 * @returns {Array<{from:string,to:string}>}
 */
function sanitizeOverrides(overrides) {
  var list = Array.isArray(overrides) ? overrides : [];
  var out = [];
  var seen = {};
  list.forEach(function (row) {
    if (!row) return;
    var from = normalizeColorInput(row.from);
    var to = normalizeColorInput(row.to);
    if (!from || !to || from === to) return;
    if (seen[from]) return;
    seen[from] = 1;
    out.push({ from: from, to: to });
  });
  return out;
}

function buildRewriteMap(overrides) {
  var map = {};
  sanitizeOverrides(overrides).forEach(function (pair) {
    map[pair.from] = pair.to;
    // also map uppercase variants via lowercase keys only
  });
  return map;
}

function rewriteHexInString(str, map) {
  if (!str || !map || !Object.keys(map).length) return str;
  return String(str).replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g, function (m) {
    var key = normalizeHex(m);
    return map[key] || m;
  });
}

/**
 * Apply overrides to a CSS text blob (theme :root block, inline styles, etc.).
 */
function applyColorOverridesToCssText(css, overrides) {
  var map = buildRewriteMap(overrides);
  if (!Object.keys(map).length) return css;
  return rewriteHexInString(css, map);
}

/**
 * Remap hex colours in an HTML document string (attributes + style blocks).
 */
function applyColorOverridesToHtml(html, overrides) {
  var map = buildRewriteMap(overrides);
  if (!Object.keys(map).length) return html;
  return rewriteHexInString(html, map);
}

/**
 * After theme CSS vars are set on :root, rewrite any var values that match `from`.
 * Also injects a style tag that reasserts remapped theme tokens.
 */
function themeVarsCssWithOverrides(themeCss, overrides) {
  return applyColorOverridesToCssText(themeCss, overrides);
}

/**
 * Deep-clone config and rewrite hex string values. Preserves colorOverrides as-is
 * so the Branding editor still shows source → target rows.
 */
function applyColorOverridesToConfig(cfg) {
  var map = buildRewriteMap(cfg && cfg.colorOverrides);
  if (!Object.keys(map).length) return cfg;
  var kept = cfg.colorOverrides;
  var clone;
  try {
    clone = JSON.parse(JSON.stringify(cfg));
  } catch (_e) {
    return cfg;
  }
  function walk(o) {
    if (typeof o === 'string') return rewriteHexInString(o, map);
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) o[i] = walk(o[i]);
      return o;
    }
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) {
        o[k] = walk(o[k]);
      });
      return o;
    }
    return o;
  }
  walk(clone);
  clone.colorOverrides = kept;
  return clone;
}

/** Browser helper source for demo-shared / trade shells. */
function clientSource() {
  return (
    'function __lpApplyColorOverrides(cfg){' +
    'function norm(v){v=String(v==null?"":v).trim();if(!v)return"";if(v.charAt(0)!=="#")v="#"+v;' +
    'if(/^#[0-9a-fA-F]{3}$/.test(v))v="#"+v.charAt(1)+v.charAt(1)+v.charAt(2)+v.charAt(2)+v.charAt(3)+v.charAt(3);' +
    'return /^#[0-9a-fA-F]{6}$/.test(v)?v.toLowerCase():"";}' +
    'function mapOf(list){var m={},arr=Array.isArray(list)?list:[];arr.forEach(function(r){if(!r)return;var f=norm(r.from),t=norm(r.to);if(f&&t&&f!==t)m[f]=t;});return m;}' +
    'function rewrite(s,m){return String(s).replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/g,function(x){var k=norm(x);return m[k]||x;});}' +
    'var m=mapOf(cfg&&cfg.colorOverrides);if(!Object.keys(m).length)return cfg;' +
    'var kept=cfg.colorOverrides;var clone;try{clone=JSON.parse(JSON.stringify(cfg));}catch(e){return cfg;}' +
    'function walk(o){if(typeof o==="string")return rewrite(o,m);if(Array.isArray(o)){for(var i=0;i<o.length;i++)o[i]=walk(o[i]);return o;}' +
    'if(o&&typeof o==="object"){Object.keys(o).forEach(function(k){o[k]=walk(o[k]);});return o;}return o;}' +
    'walk(clone);clone.colorOverrides=kept;return clone;}'
  );
}

module.exports = {
  normalizeHex,
  normalizeColorInput,
  sanitizeOverrides,
  buildRewriteMap,
  applyColorOverridesToCssText,
  applyColorOverridesToHtml,
  applyColorOverridesToConfig,
  themeVarsCssWithOverrides,
  rewriteHexInString,
  parseRgbToHex,
  clientSource
};
