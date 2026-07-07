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

/** Public URLs for one live tenant (homepage, suburbs, published landing pages). */
export function buildSiteSitemapUrls({ slug, config, origin, customDomain }) {
  const base = String(origin || '').replace(/\/$/, '');
  const isCustom = !!(customDomain && String(customDomain).trim());
  const urls = [];

  if (isCustom) {
    urls.push(base + '/');
  } else if (slug) {
    urls.push(base + '/' + encodeURIComponent(slug));
  }

  if (slug) {
    for (const area of serviceAreas(config)) {
      urls.push(base + '/' + slug + '/' + slugify(area));
    }
  }

  const pages = Array.isArray(config && config.pages) ? config.pages : [];
  for (const pg of pages) {
    if (!pg || pg.status !== 'published' || !pg.slug) continue;
    const seg = String(pg.slug).trim();
    if (!seg) continue;
    if (isCustom) urls.push(base + '/' + encodeURIComponent(seg));
    else if (slug) urls.push(base + '/' + slug + '/' + encodeURIComponent(seg));
  }

  return [...new Set(urls)];
}

export function buildSitemapXml(urls) {
  const esc = (u) =>
    String(u).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => '  <url><loc>' + esc(u) + '</loc><changefreq>weekly</changefreq></url>')
      .join('\n') +
    '\n</urlset>'
  );
}
