// lib/seo/sitemap.js
// Per-tenant sitemap URL list + XML builder.

import { serviceAreas, slugify } from './tokens.js';

export function primaryHosts() {
  return (process.env.PRIMARY_HOSTS || 'leadpages.webculture.au,leadpages.com.au')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPrimaryHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return !h || primaryHosts().includes(h);
}

function isoDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Public sitemap entries for one live tenant (homepage, suburbs, published landing pages). */
export function buildSiteSitemapEntries({ slug, config, origin, customDomain }) {
  const base = String(origin || '').replace(/\/$/, '');
  const isCustom = !!(customDomain && String(customDomain).trim());
  const cfg = config || {};
  const generated = cfg.sitemapGeneratedAt || '';
  const entries = [];

  if (isCustom) {
    entries.push({ loc: base + '/', lastmod: isoDate(generated), kind: 'home' });
  } else if (slug) {
    entries.push({ loc: base + '/' + encodeURIComponent(slug), lastmod: isoDate(generated), kind: 'home' });
  }

  if (slug) {
    for (const area of serviceAreas(cfg)) {
      entries.push({
        loc: base + '/' + slug + '/' + slugify(area),
        lastmod: isoDate(generated),
        kind: 'suburb',
      });
    }
  }

  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  for (const pg of pages) {
    if (!pg || pg.status !== 'published' || !pg.slug) continue;
    const seg = String(pg.slug).trim();
    if (!seg) continue;
    const loc = isCustom
      ? base + '/' + encodeURIComponent(seg)
      : slug
        ? base + '/' + slug + '/' + encodeURIComponent(seg)
        : '';
    if (!loc) continue;
    entries.push({
      loc,
      lastmod: isoDate(pg.updated_at || pg.updatedAt || generated),
      kind: 'landing',
      slug: seg,
      title: pg.title || seg,
    });
  }

  const seen = new Set();
  return entries.filter((e) => {
    if (seen.has(e.loc)) return false;
    seen.add(e.loc);
    return true;
  });
}

/** @deprecated use buildSiteSitemapEntries */
export function buildSiteSitemapUrls(opts) {
  return buildSiteSitemapEntries(opts).map((e) => e.loc);
}

export function sitemapCounts(entries) {
  const list = entries || [];
  return {
    total: list.length,
    home: list.filter((e) => e.kind === 'home').length,
    suburbs: list.filter((e) => e.kind === 'suburb').length,
    landingPages: list.filter((e) => e.kind === 'landing').length,
  };
}

export function buildSitemapXml(entries) {
  const esc = (u) =>
    String(u).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = (Array.isArray(entries) ? entries : []).map((e) => {
    const loc = typeof e === 'string' ? e : e.loc;
    const lastmod = typeof e === 'string' ? '' : e.lastmod;
    let row = '  <url><loc>' + esc(loc) + '</loc>';
    if (lastmod) row += '<lastmod>' + esc(lastmod) + '</lastmod>';
    row += '<changefreq>weekly</changefreq></url>';
    return row;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join('\n') +
    '\n</urlset>'
  );
}

export function siteSitemapOrigin(site, requestOrigin) {
  const dom = String((site && site.customDomain) || (site && site.custom_domain) || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  if (dom) return 'https://' + dom;
  if (requestOrigin) return String(requestOrigin).replace(/\/$/, '');
  const slug = site && site.slug;
  if (slug) return 'https://leadpages.com.au';
  return '';
}
