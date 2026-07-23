'use strict';

/**
 * Modelled internal-link suggestions for Page Optimiser briefs.
 * Uses site config pages / services / nav — never invents URLs.
 */

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * @param {object} site
 * @param {{ primaryKeyword?: string, secondaryKeywords?: string[], location?: string }} cluster
 */
function suggestInternalLinks(site, cluster) {
  const cfg = (site && site.config) || {};
  const primary = String((cluster && cluster.primaryKeyword) || '').toLowerCase();
  const secondary = ((cluster && cluster.secondaryKeywords) || []).map(function (k) {
    return String(k).toLowerCase();
  });
  const needles = [primary].concat(secondary).filter(Boolean);

  const candidates = [];

  // Homepage always
  candidates.push({
    url: '/',
    label: (site && site.business_name) || 'Home',
    reason: 'Brand home — anchor from new page and back.'
  });

  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  pages.forEach(function (p) {
    if (!p || !p.slug) return;
    const blob = [p.title, p.h1, p.slug, p.meta].join(' ').toLowerCase();
    const hit = needles.some(function (n) {
      return n && blob.indexOf(n.split(' ')[0]) >= 0;
    });
    candidates.push({
      url: '/' + String(p.slug).replace(/^\//, ''),
      label: p.title || p.h1 || p.slug,
      reason: hit
        ? 'Existing page overlaps this cluster — differentiate or link as supporting content.'
        : 'Related site page — consider a contextual internal link.',
      overlap: hit
    });
  });

  const services = Array.isArray(cfg.services) ? cfg.services : [];
  services.slice(0, 8).forEach(function (s) {
    const title = (s && (s.title || s.name)) || '';
    if (!title) return;
    const slug = s.slug || slugify(title);
    candidates.push({
      url: '/#services',
      label: title,
      reason: 'Homepage service — link to proof on the main site.',
      serviceSlug: slug
    });
  });

  const nav =
    (cfg.sections && cfg.sections.navMenu && Array.isArray(cfg.sections.navMenu.items)
      ? cfg.sections.navMenu.items
      : []) || [];
  nav.slice(0, 12).forEach(function (item) {
    const href = (item && (item.href || item.url || item.slug)) || '';
    if (!href || href === '/') return;
    const path = String(href).startsWith('http') ? href : '/' + String(href).replace(/^\//, '');
    if (candidates.some(function (c) { return c.url === path; })) return;
    candidates.push({
      url: path,
      label: (item && (item.label || item.title)) || path,
      reason: 'In site navigation — good crawl path.'
    });
  });

  // Prefer overlap hits, then home, then others — max 6
  candidates.sort(function (a, b) {
    return (b.overlap ? 1 : 0) - (a.overlap ? 1 : 0);
  });
  const seen = new Set();
  const out = [];
  candidates.forEach(function (c) {
    if (seen.has(c.url)) return;
    seen.add(c.url);
    out.push({
      url: c.url,
      label: c.label,
      reason: c.reason,
      labelClass: 'modelled'
    });
  });
  return out.slice(0, 6);
}

module.exports = {
  suggestInternalLinks: suggestInternalLinks,
  slugify: slugify
};
