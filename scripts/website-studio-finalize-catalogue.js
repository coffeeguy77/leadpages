'use strict';

/**
 * Phase 4 — finalize Marketplace catalogue statuses + append new apps.
 * Run: node scripts/website-studio-finalize-catalogue.js
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../lib/website-composer/marketplace/catalogue-data.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

/** Final decisions for previously deferred apps */
const FINAL = {
  // Promote to supported (viable + adapter coming)
  textBox: 'supported',
  featureStrip: 'supported',
  footer: 'supported',
  customerReactions: 'supported',
  jobsFeed: 'supported',
  projectFeed: 'supported',
  projectStats: 'supported',
  serviceAreas: 'supported',
  beforeAfterFeed: 'supported',

  // Supported with limitations (trade-niche or incomplete playground)
  activityCounter: 'supported-with-limitations',
  activityTimeline: 'supported-with-limitations',
  emergencyAvailability: 'supported-with-limitations',
  estimateBuilder: 'supported-with-limitations',
  finance: 'supported-with-limitations',
  header: 'supported-with-limitations',
  heroBeforeAfter: 'supported-with-limitations',
  igProjectFeed: 'supported-with-limitations',
  navMenu: 'supported-with-limitations',
  proofStream: 'supported-with-limitations',
  responseCards: 'supported-with-limitations',
  serviceAreaMap: 'supported-with-limitations',
  videoReels: 'supported-with-limitations',

  // Not a Marketplace section app
  seoTokens: 'incompatible'
};

const REASONS = {
  seoTokens: 'SEO config object, not a page section — managed via draft SEO fields',
  estimateBuilder: 'Interactive quote wizard with large config surface; not auto-selected',
  videoReels: 'Requires hosted video assets; Image Service stock path insufficient',
  proofStream: 'Mixed typed cards need richer validation before auto-select',
  header: 'Shell chrome via concept.header, not a section app',
  navMenu: 'Special header/nav render path; use navigation defaults',
  igProjectFeed: 'Overlaps supported instaGallery; IG token plumbing external',
  heroBeforeAfter: 'Playground omits before/after image fields; keep limited',
  activityCounter: 'Trade social-proof counters; opt-in for trades only',
  activityTimeline: 'Trade job timeline; opt-in for trades only',
  emergencyAvailability: 'Emergency schedule niche',
  finance: 'Finance callout niche',
  responseCards: 'Urgency cards trade-only',
  serviceAreaMap: 'Depends on map + serviceAreas data wiring'
};

for (const app of data.apps || []) {
  const id = app.appId;
  if (FINAL[id]) {
    app.websiteStudioSupport = FINAL[id];
    app.finalDecisionReason = REASONS[id] || app.finalDecisionReason || '';
    if (FINAL[id] === 'supported') app.adapterStatus = 'implemented';
    if (FINAL[id] === 'incompatible' || FINAL[id] === 'deprecated') {
      app.adapterStatus = 'none';
    }
  }
}

function newApp(partial) {
  return {
    appId: partial.appId,
    slug: partial.slug,
    name: partial.name,
    category: partial.category,
    sectionKey: partial.appId,
    rendererIdentifier: 'landing-shell-neutral-v1#' + partial.appId,
    configPath: 'sections.' + partial.appId,
    purpose: partial.purpose,
    supportedPagePositions: ['main'],
    suitableBusinessModels: partial.models || ['service', 'product', 'hospitality', 'retail'],
    suitableIndustries: partial.industries || ['*'],
    unsuitableIndustries: partial.unsuitable || [],
    conversionGoals: partial.goals || ['enquire', 'book'],
    supportedLayouts: [
      'classic',
      'premium-showcase',
      'authority-builder',
      'quote-first',
      'reviews-first',
      'offer-funnel',
      'photo-proof'
    ],
    supportedVariants: ['default'],
    requiredContentFields: partial.required || ['heading'],
    optionalContentFields: partial.optional || [],
    imageFields: partial.imageFields || [],
    iconFields: [],
    ctaFields: ['cta'],
    itemCountConstraints: partial.items || null,
    dependencies: [],
    incompatibilities: [],
    mobileBehaviour: { stack: true, priority: 'normal' },
    installMethod: 'draft.sections[sectionKey].on + draft.__websiteComposer.installedApps',
    adapterStatus: 'implemented',
    websiteStudioSupport: 'supported',
    sourceFilesInspected: [
      'landing-shell-neutral-v1.template.json',
      'trade.template.json',
      'lib/website-composer/adapters/registry.js',
      'marketplace/app-content.json'
    ],
    phaseAdded: 4
  };
}

const existing = new Set((data.apps || []).map((a) => a.appId));
const additions = [
  newApp({
    appId: 'productCollection',
    slug: 'product-collection',
    name: 'Product Collection',
    category: 'retail-content',
    purpose: 'Editorial product / collection shelf for retail and jewellery',
    models: ['product', 'retail'],
    industries: ['jewellery', 'retail', 'fashion', 'beauty'],
    unsuitable: ['plumbing', 'electrical'],
    goals: ['book', 'enquire', 'visit'],
    required: ['heading', 'items'],
    imageFields: ['items[].image'],
    items: { min: 2, max: 12 }
  }),
  newApp({
    appId: 'clientLogos',
    slug: 'client-logos',
    name: 'Client Logos',
    category: 'trust-conversion',
    purpose: 'Logo trust strip for corporate and event clients',
    models: ['service', 'events', 'hospitality', 'professional'],
    goals: ['trust'],
    required: ['heading', 'logos'],
    imageFields: ['logos[].image'],
    items: { min: 3, max: 12 }
  }),
  newApp({
    appId: 'bookingCta',
    slug: 'booking-cta',
    name: 'Booking CTA',
    category: 'trust-conversion',
    purpose: 'Appointment / booking conversion band',
    models: ['service', 'retail', 'hospitality', 'beauty', 'professional'],
    goals: ['book', 'appoint'],
    required: ['heading', 'cta'],
    optional: ['intro', 'finePrint']
  }),
  newApp({
    appId: 'brandStory',
    slug: 'brand-story',
    name: 'Brand Story',
    category: 'core-content',
    purpose: 'Long-form brand / provenance narrative',
    models: ['product', 'retail', 'hospitality', 'creative'],
    goals: ['trust', 'enquire'],
    required: ['heading', 'body'],
    imageFields: ['image'],
    optional: ['eyebrow', 'cta']
  }),
  newApp({
    appId: 'packageCompare',
    slug: 'package-compare',
    name: 'Package Compare',
    category: 'core-content',
    purpose: 'Side-by-side package / vehicle / tier comparison',
    models: ['service', 'events', 'hospitality', 'product'],
    industries: ['coffee-event', 'events', 'hospitality', 'retail'],
    goals: ['book', 'enquire'],
    required: ['heading', 'packages'],
    items: { min: 2, max: 4 },
    optional: ['intro', 'cta']
  })
];

for (const app of additions) {
  if (!existing.has(app.appId)) data.apps.push(app);
}

data.version = '2';
data.updatedAt = new Date().toISOString();
data.phase = 4;
data.notes =
  'Phase 4 final statuses. New apps render via landing-shell-neutral-v1; empty mounts also exist in trade.template.json (hidden).';

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

const by = {};
for (const a of data.apps) {
  by[a.websiteStudioSupport] = (by[a.websiteStudioSupport] || 0) + 1;
}
console.log('apps', data.apps.length, by);
console.log('no requires-adapter left', !by['requires-adapter']);
console.log('no requires-metadata left', !by['requires-metadata']);
