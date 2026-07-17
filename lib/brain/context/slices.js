'use strict';

const V1_SLICES = Object.freeze([
  'site.identity',
  'site.brand',
  'site.services',
  'site.areas',
  'site.seo',
  'site.pages.summary',
  'partner.identity'
]);

const SECRET_KEY_RE =
  /^(password|preview_password|secret|token|access_token|refresh_token|api_?key|encryption_?key|private_?key|client_secret)$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSecretKey(value) {
  return typeof value === 'string' && SECRET_KEY_RE.test(value);
}

/**
 * Deep-clone JSON-ish data while dropping secret-looking keys.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function redactSecrets(value, depth) {
  const d = depth == null ? 0 : depth;
  if (d > 8) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, d + 1));
  }
  if (!value || typeof value !== 'object') return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSecretKey(k)) continue;
    out[k] = redactSecrets(v, d + 1);
  }
  return out;
}

/**
 * @param {object} site — sites row shape (id, slug, business_name, config, …)
 * @param {string} slice
 * @param {{ partner?: object }} [extras]
 */
function extractSlice(site, slice, extras) {
  const cfg = (site && site.config && typeof site.config === 'object') ? site.config : {};
  const sections = (cfg.sections && typeof cfg.sections === 'object') ? cfg.sections : {};
  const theme = (cfg.theme && typeof cfg.theme === 'object') ? cfg.theme : {};
  const contact = (cfg.contact && typeof cfg.contact === 'object') ? cfg.contact : {};
  const services = Array.isArray(cfg.services) ? cfg.services : [];
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  const areasSrc =
    (sections.serviceAreas && sections.serviceAreas.areas) ||
    (cfg.serviceAreas && cfg.serviceAreas.areas) ||
    cfg.serviceAreas ||
    [];

  switch (slice) {
    case 'site.identity':
      return {
        siteId: site.id || null,
        slug: site.slug || null,
        businessName: site.business_name || cfg.businessName || null,
        trade: cfg.trade || sections.trade || null,
        phone: contact.phone || cfg.phone || null,
        email: contact.email || cfg.email || null,
        domain: site.custom_domain || cfg.domain || null
      };
    case 'site.brand':
      return {
        logoUrl: cfg.logo || (theme && theme.logo) || null,
        colours: theme.colours || theme.colors || null,
        font: theme.font || theme.fonts || null,
        voiceHints: cfg.brandVoice || sections.brandVoice || null
      };
    case 'site.services':
      return {
        services: services.slice(0, 40).map((s) => ({
          title: s && (s.title || s.name) || null,
          summary: s && (s.summary || s.description) || null
        }))
      };
    case 'site.areas': {
      const areas = Array.isArray(areasSrc)
        ? areasSrc.map((a) => (typeof a === 'string' ? a : (a && (a.label || a.name)) || null)).filter(Boolean)
        : [];
      return { areas: areas.slice(0, 80) };
    }
    case 'site.seo':
      return {
        seoTokens: sections.seoTokens || cfg.seoTokens || null,
        seoTitle: cfg.seoTitle || sections.seoTitle || null,
        seoDescription: cfg.seoDescription || sections.seoDescription || null
      };
    case 'site.pages.summary':
      return {
        pages: pages.slice(0, 50).map((p) => ({
          title: p && p.title || null,
          slug: p && p.slug || null,
          published: !!(p && (p.published || p.status === 'published'))
        }))
      };
    case 'partner.identity': {
      const partner = extras && extras.partner;
      if (!partner) return { partnerId: null, name: null, tier: null };
      return {
        partnerId: partner.id || partner.partner_id || null,
        name: partner.display_name || partner.name || null,
        tier: partner.tier || partner.plan || null
      };
    }
    default:
      return null;
  }
}

module.exports = {
  V1_SLICES,
  extractSlice,
  redactSecrets,
  isSecretKey
};
