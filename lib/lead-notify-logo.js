'use strict';

/**
 * Dual-tint LeadPages brand lockup for enquiry emails.
 * Tint1 / accent → circles + "more leads"
 * Tint2 / ink    → "leadpages" + "smart sites" + cursor arrow
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (_e) {
  sharp = null;
}

const SVG_PATH = path.join(__dirname, '..', 'assets', 'leadpages-logo.svg');

let cachedSvg = null;

function loadSvgTemplate() {
  if (cachedSvg) return cachedSvg;
  cachedSvg = fs
    .readFileSync(SVG_PATH, 'utf8')
    .replace(/<\?xml[^>]*>\s*/i, '')
    .trim();
  return cachedSvg;
}

function hexOr(v, fallback) {
  v = String(v == null ? '' : v).trim();
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
    v = v.charAt(0) === '#' ? v : '#' + v;
    return (
      '#' +
      v.charAt(1) +
      v.charAt(1) +
      v.charAt(2) +
      v.charAt(2) +
      v.charAt(3) +
      v.charAt(3)
    ).toLowerCase();
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    return (v.charAt(0) === '#' ? v : '#' + v).toLowerCase();
  }
  return fallback;
}

/**
 * Build SVG markup with concrete fills (email / sharp cannot use CSS variables).
 */
function buildDualTintSvg(accent, ink) {
  const a = hexOr(accent, '#2ecc8f');
  const i = hexOr(ink, '#ffffff');
  let svg = loadSvgTemplate();
  svg = svg.replace(
    /\.st0\s*\{\s*fill:\s*var\(--lp-logo-accent,\s*#[0-9a-fA-F]+\);\s*\}/i,
    '.st0 { fill: ' + a + '; }'
  );
  svg = svg.replace(
    /\.st1\s*\{\s*fill:\s*var\(--lp-logo-ink,\s*#[0-9a-fA-F]+\);\s*\}/i,
    '.st1 { fill: ' + i + '; }'
  );
  // Belt-and-braces if style block format drifts
  svg = svg.replace(/var\(--lp-logo-accent,\s*#[0-9a-fA-F]+\)/gi, a);
  svg = svg.replace(/var\(--lp-logo-ink,\s*#[0-9a-fA-F]+\)/gi, i);
  if (!/\sxmlns=/.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

/**
 * Render dual-tint lockup to PNG buffer. Height defaults to 84 (email wordmark size).
 */
async function renderDualTintPng(opts) {
  opts = opts || {};
  if (!sharp) {
    const err = new Error('sharp_unavailable');
    err.code = 'sharp_unavailable';
    throw err;
  }
  const height = Math.max(24, Math.min(240, Math.round(Number(opts.height) || 84)));
  // Brand SVG viewBox 1000×320 → width from height
  const width = Math.round((height * 1000) / 320);
  const svg = buildDualTintSvg(opts.accent, opts.ink);
  return sharp(Buffer.from(svg, 'utf8'))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Public URL for the dual-tint lockup (fetched by email clients).
 */
function dualTintLogoUrl(baseUrl, style) {
  const st = style || {};
  const accent = hexOr(st.logoTint || st.logoTintAccent, '#ffffff');
  const ink = hexOr(st.logoTint2 || st.logoTintInk, '#ffffff');
  const height = Math.max(24, Math.min(240, Math.round(Number(st.logoWordmarkHeight) || 84)));
  const base = String(baseUrl || 'https://www.leadpages.com.au').replace(/\/+$/, '');
  return (
    base +
    '/api/lead-notify-logo?accent=' +
    encodeURIComponent(accent) +
    '&ink=' +
    encodeURIComponent(ink) +
    '&h=' +
    height
  );
}

module.exports = {
  loadSvgTemplate,
  buildDualTintSvg,
  renderDualTintPng,
  dualTintLogoUrl,
  hexOr
};
