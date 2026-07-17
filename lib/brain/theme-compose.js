'use strict';

/**
 * Theme Studio — structured trade theme tokens (compatible with manage.html).
 * Keys: pipe, hivis, steel, safety, lightBg (+ optional presetName).
 */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const THEME_TOKEN_SCHEMA = {
  type: 'object',
  required: ['pipe', 'hivis', 'steel', 'safety', 'lightBg'],
  properties: {
    presetName: { type: 'string' },
    pipe: { type: 'string' },
    hivis: { type: 'string' },
    steel: { type: 'string' },
    safety: { type: 'string' },
    lightBg: { type: 'string' },
    rationale: { type: 'string' }
  }
};

const THEME_REFINE_SCHEMA = {
  type: 'object',
  required: ['pipe', 'hivis', 'steel', 'safety', 'lightBg'],
  properties: {
    presetName: { type: 'string' },
    pipe: { type: 'string' },
    hivis: { type: 'string' },
    steel: { type: 'string' },
    safety: { type: 'string' },
    lightBg: { type: 'string' },
    changeNotes: { type: 'string' }
  }
};

function expandHex(h) {
  const s = String(h || '').trim();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return (
      '#' +
      s[1] +
      s[1] +
      s[2] +
      s[2] +
      s[3] +
      s[3]
    ).toLowerCase();
  }
  return s.toLowerCase();
}

function normalizeHex(value, fallback) {
  const raw = String(value || '').trim();
  if (HEX_RE.test(raw)) return expandHex(raw);
  return expandHex(fallback);
}

const DEFAULT_TRADE_THEME = {
  pipe: '#1f7bb8',
  hivis: '#ff6a1f',
  steel: '#1a2230',
  safety: '#ffc400',
  lightBg: '#eef2f6'
};

/**
 * @param {unknown} raw
 * @param {{ presetName?: string }} [opts]
 */
function normalizeThemeTokens(raw, opts) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const base = DEFAULT_TRADE_THEME;
  const theme = {
    pipe: normalizeHex(o.pipe, base.pipe),
    hivis: normalizeHex(o.hivis, base.hivis),
    steel: normalizeHex(o.steel, base.steel),
    safety: normalizeHex(o.safety, base.safety),
    lightBg: normalizeHex(o.lightBg, base.lightBg)
  };
  const name = String(o.presetName || (opts && opts.presetName) || '').trim();
  if (name) theme.presetName = name.slice(0, 80);
  const rationale = String(o.rationale || o.changeNotes || '').trim();
  return {
    theme,
    rationale: rationale.slice(0, 500)
  };
}

/**
 * Merge current site theme into trade token shape.
 * @param {object} site
 */
function currentThemeFromSite(site) {
  const cfg = (site && site.config) || {};
  const t = (cfg.theme && typeof cfg.theme === 'object' ? cfg.theme : {}) || {};
  return normalizeThemeTokens(
    {
      pipe: t.pipe || t.brand || t.primary,
      hivis: t.hivis || t.cta || t.accent,
      steel: t.steel || t.dark || t.header,
      safety: t.safety || t.highlight || t.accent2,
      lightBg: t.lightBg || t.background || t.bg,
      presetName: t.presetName || t.name || ''
    },
    {}
  ).theme;
}

module.exports = {
  THEME_TOKEN_SCHEMA,
  THEME_REFINE_SCHEMA,
  DEFAULT_TRADE_THEME,
  normalizeThemeTokens,
  currentThemeFromSite,
  normalizeHex
};
