'use strict';

/**
 * Section catalogue for Layout Composer (labels + defaults).
 * Keys align with lib/section-order.js — Trust Bar pin still applied on compile.
 */

const {
  DEFAULT_LAYOUT_SECTIONS,
  OPTIONAL_SECTIONS,
  OFF_BY_DEFAULT,
} = require('../section-order');

const SECTION_LABELS = {
  emerg: 'Emergency bar',
  hero: 'Hero',
  trustBar: 'Trust bar',
  services: 'Services',
  serviceProcess: 'How it works',
  featureStrip: 'Feature strip',
  why: 'Why us',
  crew: 'Team / crew',
  area: 'Service area',
  reviews: 'Reviews',
  quote: 'Quote form',
  faq: 'FAQ',
  footer: 'Footer',
  navMenu: 'Nav menu',
  textBox: 'Text block',
  seoText: 'SEO text',
  searchCanvas: 'Search canvas',
  instaGallery: 'Instagram gallery',
  igProjectFeed: 'IG project feed',
  beforeAfter: 'Before & after',
  responseCards: 'Response cards',
  projectStats: 'Project stats',
  serviceAreas: 'Service areas',
  reviewHighlights: 'Review highlights',
  featuredProjects: 'Featured projects',
  premiumGallery: 'Premium gallery',
  specialOffer: 'Special offer',
  scrollingSponsorBanner: 'Sponsor banner',
  heroBeforeAfter: 'Hero before/after',
  heroSlider: 'Hero slider',
  splitHero: 'Split hero',
  activityCounter: 'Activity counter',
  proofStream: 'Proof stream',
  projectFeed: 'Project feed',
  jobsFeed: 'Jobs feed',
  beforeAfterFeed: 'Before/after feed',
  videoReels: 'Video reels',
  activityTimeline: 'Activity timeline',
  customerReactions: 'Customer reactions',
  onlineQuote: 'Online quote',
  orderStorefront: 'Order storefront',
  bookingStorefront: 'Booking storefront',
  customHtml: 'Custom HTML',
  estimateBuilder: 'Estimate builder',
  finance: 'Finance',
  serviceAreaMap: 'Service area map',
  emergencyAvailability: 'Emergency availability',
  certifications: 'Certifications',
  promotions: 'Promotions',
};

function humanizeKey(key) {
  return String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/^\s+/, '')
    .replace(/^./, function (c) { return c.toUpperCase(); });
}

function labelForSection(key) {
  return SECTION_LABELS[key] || humanizeKey(key);
}

function listCatalogueSections() {
  const seen = {};
  const out = [];
  function push(key, group) {
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push({
      key: key,
      label: labelForSection(key),
      group: group,
      defaultOn: OFF_BY_DEFAULT.indexOf(key) < 0,
    });
  }
  DEFAULT_LAYOUT_SECTIONS.forEach(function (k) { push(k, 'default'); });
  OPTIONAL_SECTIONS.forEach(function (k) { push(k, 'optional'); });
  return out;
}

function scratchBlueprint(name) {
  const sections = DEFAULT_LAYOUT_SECTIONS.map(function (key) {
    return {
      key: key,
      enabled: OFF_BY_DEFAULT.indexOf(key) < 0,
      origin: 'scratch',
      label: labelForSection(key),
    };
  });
  // Ensure trust bar exists for pin law on compile
  if (!sections.some(function (s) { return s.key === 'trustBar'; })) {
    sections.splice(1, 0, {
      key: 'trustBar',
      enabled: true,
      origin: 'scratch',
      label: labelForSection('trustBar'),
    });
  }
  return {
    kind: 'scratch',
    readOnly: false,
    source: 'scratch',
    sourceId: null,
    slug: '',
    name: name || 'Untitled layout',
    description: '',
    status: 'draft',
    themeRef: null,
    pages: [{ id: 'home', label: 'Home', path: '/', sections: sections }],
    apps: sections.map(function (s) {
      return { sectionKey: s.key, enabled: s.enabled, label: s.label };
    }),
    preview: { themeImageUrl: null, layoutImageUrl: null, hasSamplePacks: false, samplePackKeys: [] },
    meta: { industryTags: [], visibility: 'private', enabled: true },
  };
}

module.exports = {
  SECTION_LABELS,
  labelForSection,
  listCatalogueSections,
  scratchBlueprint,
};
