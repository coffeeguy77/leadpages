/**
 * Marketplace access types and public-facing labels.
 * Do not expose entitlement keys on public pages.
 */

var ACCESS_TYPES = [
  'included',
  'free',
  'free_limited',
  'premium_subscription',
  'usage_based',
  'premium_plus_usage',
  'requires_connection',
  'third_party_subscription',
  'superuser_only',
  'coming_soon'
];

var PUBLIC_LABELS = {
  included: {
    short: 'Included',
    long: 'Included with your LeadPages website'
  },
  free: {
    short: 'Free',
    long: 'No extra charge'
  },
  free_limited: {
    short: 'Free with limits',
    long: 'Free plan available · Usage limits apply'
  },
  premium_subscription: {
    short: 'Premium',
    long: 'Subscription required'
  },
  usage_based: {
    short: 'Usage-based',
    long: 'Charges depend on use'
  },
  premium_plus_usage: {
    short: 'Premium + usage',
    long: 'Subscription required · Extra usage may apply'
  },
  requires_connection: {
    short: 'Connection required',
    long: 'Connect your existing account'
  },
  third_party_subscription: {
    short: 'External account',
    long: 'External account required · The provider may charge separately'
  },
  superuser_only: {
    short: 'LeadPages only',
    long: 'Available to LeadPages operators'
  },
  coming_soon: {
    short: 'Coming soon',
    long: 'Not yet available'
  }
};

/** Default access by section_key — public labels only; not billing truth. */
var DEFAULT_ACCESS_BY_SECTION = {
  trustBar: 'included',
  hero: 'included',
  services: 'included',
  reviews: 'included',
  featuredProjects: 'included',
  instaGallery: 'requires_connection',
  igProjectFeed: 'requires_connection',
  serviceAreaMap: 'requires_connection',
  premiumSeo: 'premium_plus_usage',
  'premium-seo': 'premium_plus_usage',
  onlineQuote: 'premium_subscription',
  'quote-lead-capture': 'premium_subscription'
};

function normalizeAccessType(type) {
  var t = String(type || '').trim();
  if (ACCESS_TYPES.indexOf(t) >= 0) return t;
  return 'included';
}

function publicLabel(type, style) {
  var key = normalizeAccessType(type);
  var row = PUBLIC_LABELS[key] || PUBLIC_LABELS.included;
  return style === 'long' ? row.long : row.short;
}

function accessForSection(sectionKey, override) {
  if (override) return normalizeAccessType(override);
  var sk = String(sectionKey || '');
  return normalizeAccessType(DEFAULT_ACCESS_BY_SECTION[sk] || 'included');
}

function formatAudCents(cents) {
  var n = Number(cents);
  if (!isFinite(n)) return '';
  var dollars = n / 100;
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: dollars % 1 === 0 ? 0 : 2
    }).format(dollars);
  } catch (_e) {
    return '$' + dollars.toFixed(dollars % 1 === 0 ? 0 : 2);
  }
}

var api = {
  ACCESS_TYPES: ACCESS_TYPES,
  PUBLIC_LABELS: PUBLIC_LABELS,
  DEFAULT_ACCESS_BY_SECTION: DEFAULT_ACCESS_BY_SECTION,
  normalizeAccessType: normalizeAccessType,
  publicLabel: publicLabel,
  accessForSection: accessForSection,
  formatAudCents: formatAudCents
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.LPMarketplaceAccess = api;
}
