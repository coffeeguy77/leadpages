'use strict';

/**
 * Layout Composer — stock preview imagery + proportional heights.
 *
 * One stock example image per app/section (not client content).
 * Upload to Cloudinary folder: leadpages/layout-composer/stock/
 * Then set the URL in STOCK_IMAGE_URLS below (key = section key, or
 * trustBar__images / trustBar__text for Trust Bar variants).
 *
 * Height model: hero / heroSlider = 15 units (full preview width).
 * Trust Bar with images ≈ 1/3 hero → 5 units.
 * Trust Bar text-only ≈ 1/5 hero → 3 units.
 * Upload sizes assume a 1200px-wide mock (height = units × 40px).
 */

const HERO_UNITS = 15;
const UPLOAD_WIDTH = 1200;
const PX_PER_UNIT = 40; // 15 × 40 = 600px hero height at 1200 wide

/** @type {Record<string, { units: number, tier: string, kind: string }>} */
const PREVIEW_DEFAULTS = {
  emerg: { units: 2, tier: 'chrome', kind: 'bar' },
  navMenu: { units: 2, tier: 'chrome', kind: 'bar' },
  hero: { units: 15, tier: 'hero', kind: 'hero' },
  heroSlider: { units: 15, tier: 'hero', kind: 'hero' },
  heroBeforeAfter: { units: 15, tier: 'hero', kind: 'hero' },
  splitHero: { units: 15, tier: 'hero', kind: 'hero' },
  trustBar: { units: 5, tier: 'supporting', kind: 'trust' },
  services: { units: 10, tier: 'primary', kind: 'grid' },
  serviceProcess: { units: 9, tier: 'primary', kind: 'steps' },
  featureStrip: { units: 4, tier: 'supporting', kind: 'strip' },
  why: { units: 9, tier: 'primary', kind: 'content' },
  crew: { units: 8, tier: 'primary', kind: 'grid' },
  area: { units: 7, tier: 'supporting', kind: 'map' },
  serviceAreas: { units: 7, tier: 'supporting', kind: 'map' },
  reviews: { units: 8, tier: 'primary', kind: 'cards' },
  reviewHighlights: { units: 6, tier: 'supporting', kind: 'cards' },
  quote: { units: 12, tier: 'primary', kind: 'form' },
  onlineQuote: { units: 12, tier: 'primary', kind: 'form' },
  faq: { units: 8, tier: 'supporting', kind: 'list' },
  footer: { units: 5, tier: 'chrome', kind: 'footer' },
  textBox: { units: 6, tier: 'supporting', kind: 'content' },
  seoText: { units: 5, tier: 'supporting', kind: 'content' },
  searchCanvas: { units: 10, tier: 'primary', kind: 'canvas' },
  instaGallery: { units: 9, tier: 'primary', kind: 'gallery' },
  igProjectFeed: { units: 9, tier: 'primary', kind: 'feed' },
  beforeAfter: { units: 10, tier: 'primary', kind: 'gallery' },
  responseCards: { units: 7, tier: 'supporting', kind: 'cards' },
  projectStats: { units: 4, tier: 'supporting', kind: 'strip' },
  featuredProjects: { units: 10, tier: 'primary', kind: 'gallery' },
  premiumGallery: { units: 11, tier: 'primary', kind: 'gallery' },
  specialOffer: { units: 6, tier: 'supporting', kind: 'promo' },
  scrollingSponsorBanner: { units: 3, tier: 'chrome', kind: 'bar' },
  activityCounter: { units: 3, tier: 'supporting', kind: 'strip' },
  proofStream: { units: 7, tier: 'supporting', kind: 'feed' },
  projectFeed: { units: 9, tier: 'primary', kind: 'feed' },
  jobsFeed: { units: 8, tier: 'primary', kind: 'feed' },
  beforeAfterFeed: { units: 9, tier: 'primary', kind: 'feed' },
  videoReels: { units: 10, tier: 'primary', kind: 'gallery' },
  activityTimeline: { units: 8, tier: 'supporting', kind: 'list' },
  customerReactions: { units: 6, tier: 'supporting', kind: 'cards' },
  orderStorefront: { units: 12, tier: 'primary', kind: 'store' },
  bookingStorefront: { units: 12, tier: 'primary', kind: 'store' },
  customHtml: { units: 6, tier: 'supporting', kind: 'content' },
  estimateBuilder: { units: 11, tier: 'primary', kind: 'form' },
  finance: { units: 7, tier: 'supporting', kind: 'content' },
  serviceAreaMap: { units: 8, tier: 'supporting', kind: 'map' },
  emergencyAvailability: { units: 3, tier: 'chrome', kind: 'bar' },
  certifications: { units: 4, tier: 'supporting', kind: 'strip' },
  promotions: { units: 7, tier: 'supporting', kind: 'promo' },
};

const TRUST_VARIANTS = {
  images: { units: 5, tier: 'supporting', kind: 'trust', variant: 'images' },
  text: { units: 3, tier: 'supporting', kind: 'trust', variant: 'text' },
};

/**
 * Plug Cloudinary (or other) URLs here after upload.
 * Keys: section key, or "trustBar__images" / "trustBar__text".
 */
const STOCK_IMAGE_URLS = {
  // hero: 'https://res.cloudinary.com/…/leadpages/layout-composer/stock/hero.jpg',
  // heroSlider: '',
  // trustBar__images: '',
  // trustBar__text: '',
};

const TIER_RANK = { hero: 1, primary: 2, supporting: 3, chrome: 4 };

function uploadSizeForUnits(units) {
  const u = Math.max(1, Number(units) || HERO_UNITS);
  return {
    width: UPLOAD_WIDTH,
    height: u * PX_PER_UNIT,
    label: UPLOAD_WIDTH + '×' + u * PX_PER_UNIT + 'px',
  };
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function placeholderSvg(meta) {
  const size = uploadSizeForUnits(meta.units);
  const w = size.width;
  const h = size.height;
  const bg =
    meta.tier === 'hero'
      ? '#1f3d34'
      : meta.tier === 'primary'
        ? '#d7ebe2'
        : meta.tier === 'chrome'
          ? '#e8e4d8'
          : '#efe4d2';
  const fg = meta.tier === 'hero' ? '#e5f3ed' : '#171714';
  const title = String(meta.label || meta.key || 'Section').slice(0, 40);
  const sub = size.label + ' · ' + (meta.tier || 'section');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '">' +
    '<rect width="100%" height="100%" fill="' +
    bg +
    '"/>' +
    '<text x="48" y="' +
    Math.round(h * 0.45) +
    '" fill="' +
    fg +
    '" font-family="Georgia,serif" font-size="42">' +
    escapeXml(title) +
    '</text>' +
    '<text x="48" y="' +
    Math.round(h * 0.45 + 48) +
    '" fill="' +
    fg +
    '" opacity=".75" font-family="Avenir Next,Segoe UI,sans-serif" font-size="28">' +
    escapeXml(sub) +
    '</text>' +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function resolveTrustVariant(section) {
  const v =
    (section && (section.previewVariant || section.trustVariant)) ||
    (section && section.meta && section.meta.trustVariant) ||
    'images';
  return v === 'text' ? 'text' : 'images';
}

function stockUrlFor(key, variant) {
  if (key === 'trustBar' && variant) {
    const specific = STOCK_IMAGE_URLS['trustBar__' + variant];
    if (specific) return specific;
  }
  return STOCK_IMAGE_URLS[key] || null;
}

function previewMetaForSection(sectionOrKey) {
  const isObj = sectionOrKey && typeof sectionOrKey === 'object';
  const key = isObj ? sectionOrKey.key : sectionOrKey;
  const label = isObj ? sectionOrKey.label || key : key;
  let base = PREVIEW_DEFAULTS[key] || {
    units: 7,
    tier: 'supporting',
    kind: 'content',
  };
  let variant = null;
  if (key === 'trustBar') {
    variant = resolveTrustVariant(isObj ? sectionOrKey : null);
    base = Object.assign({}, TRUST_VARIANTS[variant]);
  }
  const units = base.units;
  const upload = uploadSizeForUnits(units);
  const stockImageUrl = stockUrlFor(key, variant);
  const meta = {
    key: key,
    label: label,
    units: units,
    relativeToHero: Math.round((units / HERO_UNITS) * 1000) / 1000,
    tier: base.tier,
    tierRank: TIER_RANK[base.tier] || 3,
    kind: base.kind,
    variant: variant,
    uploadWidth: upload.width,
    uploadHeight: upload.height,
    uploadSizeLabel: upload.label,
    stockImageUrl: stockImageUrl,
    placeholderUrl: placeholderSvg({
      key: key,
      label: label,
      units: units,
      tier: base.tier,
    }),
    cloudinaryFolder: 'leadpages/layout-composer/stock',
    stockKey: variant ? key + '__' + variant : key,
  };
  meta.imageUrl = meta.stockImageUrl || meta.placeholderUrl;
  return meta;
}

function attachPreviewToCatalogue(sections) {
  return (sections || []).map(function (s) {
    return Object.assign({}, s, { preview: previewMetaForSection(s) });
  });
}

module.exports = {
  HERO_UNITS,
  UPLOAD_WIDTH,
  PX_PER_UNIT,
  PREVIEW_DEFAULTS,
  TRUST_VARIANTS,
  STOCK_IMAGE_URLS,
  uploadSizeForUnits,
  previewMetaForSection,
  attachPreviewToCatalogue,
};
