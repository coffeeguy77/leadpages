'use strict';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function parseHex(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16)
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
  return null;
}

function toHex(r, g, b) {
  function p(n) {
    const s = clamp(Math.round(n), 0, 255).toString(16);
    return s.length === 1 ? '0' + s : s;
  }
  return '#' + p(r) + p(g) + p(b);
}

function relativeLuminance(rgb) {
  function f(c) {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

/**
 * Derive accent token set from a master hex (or null → empty so theme CSS vars win).
 */
function deriveAccentTokens(masterHex) {
  const rgb = parseHex(masterHex);
  if (!rgb) {
    return {
      accent: null,
      accentSoft: null,
      accentHover: null,
      accentContrast: null,
      accentBorder: null
    };
  }
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const soft = mix(rgb, white, 0.88);
  const hover = mix(rgb, black, 0.12);
  const border = mix(rgb, white, 0.45);
  const lum = relativeLuminance(rgb);
  const contrast = lum > 0.55 ? '#0b1220' : '#ffffff';
  return {
    accent: toHex(rgb.r, rgb.g, rgb.b),
    accentSoft: toHex(soft.r, soft.g, soft.b),
    accentHover: toHex(hover.r, hover.g, hover.b),
    accentContrast: contrast,
    accentBorder: toHex(border.r, border.g, border.b)
  };
}

module.exports = { deriveAccentTokens, parseHex, toHex };
