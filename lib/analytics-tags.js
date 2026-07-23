'use strict';

/**
 * Parse / resolve Google Analytics + Ads tag IDs for published pages.
 */

function parseGaMeasurementId(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  // Prefer explicit measurement / property IDs from pasted snippets or bare values.
  const m =
    v.match(/\b(G-[A-Z0-9]+)\b/i) ||
    v.match(/\b(GT-[A-Z0-9]+)\b/i) ||
    v.match(/\b(UA-\d+-\d+)\b/i);
  if (!m || !m[1]) return '';
  const id = m[1];
  if (/^g-/i.test(id)) return 'G-' + id.slice(2).toUpperCase();
  if (/^gt-/i.test(id)) return 'GT-' + id.slice(3).toUpperCase();
  return id.toUpperCase().replace(/^UA-/, 'UA-');
}

function resolveGaMeasurementId(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const analytics = cfg.analytics && typeof cfg.analytics === 'object' ? cfg.analytics : {};
  return parseGaMeasurementId(
    analytics.gaId ||
      analytics.measurementId ||
      analytics.googleAnalyticsId ||
      cfg.gaId ||
      cfg.googleAnalyticsId ||
      ''
  );
}

function resolveAdsTagId(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const raw = cfg.googleAdsTagId || cfg.google_ads_tag_id || '';
  const aw = String(raw).replace(/[^\w-]/g, '');
  return aw || '';
}

/**
 * Build head snippet for one or more gtag IDs (GA4 / Ads).
 * @param {string[]} ids
 */
function buildGtagHeadSnippet(ids) {
  const list = (ids || [])
    .map(function (id) {
      return String(id || '').replace(/[^\w-]/g, '');
    })
    .filter(Boolean);
  const unique = [];
  list.forEach(function (id) {
    if (unique.indexOf(id) < 0) unique.push(id);
  });
  if (!unique.length) return '';
  const primary = unique[0];
  let out =
    '<script async src="https://www.googletagmanager.com/gtag/js?id=' +
    primary +
    '"></script>\n' +
    '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());';
  unique.forEach(function (id) {
    out += 'gtag("config",' + JSON.stringify(id) + ');';
  });
  out += '</script>\n';
  return out;
}

module.exports = {
  parseGaMeasurementId: parseGaMeasurementId,
  resolveGaMeasurementId: resolveGaMeasurementId,
  resolveAdsTagId: resolveAdsTagId,
  buildGtagHeadSnippet: buildGtagHeadSnippet
};
