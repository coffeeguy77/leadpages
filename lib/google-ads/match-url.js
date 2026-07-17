/**
 * Match Google Ads final_url values to LeadPages page_id using
 * current slug + previousUrls history on sites.config.pages[].
 */

function normalizePath(url) {
  if (!url) return '';
  try {
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://x' + (u.startsWith('/') ? '' : '/') + u;
    const parsed = new URL(u);
    let path = parsed.pathname || '/';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path.toLowerCase();
  } catch (e) {
    return String(url).split('?')[0].split('#')[0].toLowerCase();
  }
}

function pathSegments(path) {
  return normalizePath(path).split('/').filter(Boolean);
}

/**
 * Build lookup: path segment or full path → page_id
 * Supports:
 *   /{pageSlug}
 *   /{siteSlug}/{pageSlug}
 *   historical previousUrls entries
 */
function buildPageLookup(site) {
  const map = new Map();
  const cfg = (site && site.config) || {};
  const siteSlug = (site && site.slug) || '';
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];

  // Homepage / main
  map.set('/', { pageId: null, pageType: 'main', title: site && site.business_name });
  if (siteSlug) {
    map.set('/' + siteSlug.toLowerCase(), { pageId: null, pageType: 'main', title: site && site.business_name });
  }

  pages.forEach((p) => {
    if (!p || !p.id) return;
    const meta = { pageId: p.id, pageType: 'landing_page', title: p.title || p.slug || p.id, status: p.status };
    const slugs = [];
    if (p.slug) slugs.push(String(p.slug));
    const prev = Array.isArray(p.previousUrls) ? p.previousUrls : (Array.isArray(p.previous_urls) ? p.previous_urls : []);
    prev.forEach((u) => {
      const segs = pathSegments(u);
      if (segs.length) slugs.push(segs[segs.length - 1]);
      const np = normalizePath(u);
      if (np) map.set(np, meta);
    });
    slugs.forEach((slug) => {
      const s = String(slug).toLowerCase().replace(/^\/+|\/+$/g, '');
      if (!s) return;
      map.set('/' + s, meta);
      if (siteSlug) map.set('/' + siteSlug.toLowerCase() + '/' + s, meta);
    });
  });

  return map;
}

function matchFinalUrl(site, finalUrl) {
  const lookup = buildPageLookup(site);
  const path = normalizePath(finalUrl);
  if (lookup.has(path)) return lookup.get(path);

  // Try last segment only
  const segs = pathSegments(path);
  if (segs.length) {
    const last = '/' + segs[segs.length - 1];
    if (lookup.has(last)) return lookup.get(last);
    if (segs.length >= 2) {
      const two = '/' + segs[segs.length - 2] + '/' + segs[segs.length - 1];
      if (lookup.has(two)) return lookup.get(two);
    }
  }
  return null;
}

module.exports = {
  normalizePath,
  pathSegments,
  buildPageLookup,
  matchFinalUrl
};
