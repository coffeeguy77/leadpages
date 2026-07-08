// lib/seo/tokens.js
// Server-side mirror of the Local SEO token vocabulary used by the page builder.

export function slugify(s) {
  return String(s || '')
    .toLowerCase().trim()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function serviceAreas(config) {
  const a = config && config.sections && config.sections.serviceAreas && config.sections.serviceAreas.areas;
  return Array.isArray(a)
    ? a.filter((x) => x && x.on !== false && x.name).map((x) => String(x.name).trim())
    : [];
}

// Resolve the requested suburb slug to a REAL service-area name (or null -> 404).
export function findSuburb(config, slug) {
  const want = slugify(slug);
  return serviceAreas(config).find((n) => slugify(n) === want) || null;
}

// Build the token map. Business name / phone live in your tenant config — adapt the
// fallback chain below to wherever yours are stored.
export function buildTokens(config, suburb) {
  const id = (config && config.sections && config.sections.identity) || {};
  const brand = (config && config.brand) || {};
  const business = (config.name || config.business || brand.name || id.name || '').toString();
  const phone = (config.phone || brand.phone || id.phone || '').toString();
  const se = (config.sections && config.sections.seoTokens) || {};
  return {
    business,
    trade: se.trade || '',
    city: se.city || '',
    location: se.city || '',
    region: se.region || '',
    suburb: suburb || se.suburb || se.city || '',
    suburbs: serviceAreas(config).join(', '),
    phone,
    year: String(new Date().getFullYear()),
  };
}

export function mergeStr(str, tok) {
  return String(str == null ? '' : str).replace(/\{(\w+)\}/g, (m, k) => (k in tok ? tok[k] : m));
}

// Deep-clone the config with {token}s resolved in every string value.
export function deepMergeConfig(config, tok) {
  function walk(v) {
    if (typeof v === 'string') return mergeStr(v, tok);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k in v) o[k] = walk(v[k]);
      return o;
    }
    return v;
  }
  return walk(config);
}
