'use strict';

/**
 * Curated AI-selection metadata for Website Studio–supported apps.
 * Brain must not invent app IDs outside this registry + catalogue.
 */

function meta(partial) {
  return {
    industries: ['*'],
    businessModels: ['service'],
    pagePurposes: ['home'],
    conversionGoals: ['enquire'],
    visualStyles: ['balanced'],
    contentDensity: 'medium',
    imageDependency: 'optional',
    trustPurpose: false,
    recommendedPagePosition: 'main',
    suitableForHomePage: true,
    suitableForLandingPage: true,
    suitableForProductBusiness: true,
    suitableForServiceBusiness: true,
    suitableForHospitality: true,
    suitableForRetail: true,
    suitableForEvents: true,
    suitableForProfessionalServices: true,
    suitableForTrades: true,
    compatiblePreviousApps: [],
    compatibleNextApps: [],
    incompatibleApps: [],
    supportedVariants: ['default'],
    preferredVariantsByIndustry: {},
    minimumItems: 0,
    maximumItems: 12,
    requiredImages: 0,
    mobilePriority: 'normal',
    qualityScore: 0.8,
    status: 'supported',
    ...partial
  };
}

/** @type {Readonly<Record<string, object>>} */
const APP_METADATA = Object.freeze({
  hero: meta({
    pagePurposes: ['home', 'landing'],
    conversionGoals: ['enquire', 'book', 'call', 'visit'],
    imageDependency: 'required',
    recommendedPagePosition: 'hero',
    requiredImages: 1,
    mobilePriority: 'critical',
    qualityScore: 0.95,
    incompatibleApps: ['heroSlider', 'heroBeforeAfter', 'splitHero'],
    supportedVariants: ['hero'],
    preferredVariantsByIndustry: {
      jewellery: 'hero',
      'coffee-event': 'hero',
      electrical: 'hero'
    }
  }),
  heroSlider: meta({
    pagePurposes: ['home'],
    imageDependency: 'required',
    recommendedPagePosition: 'hero',
    requiredImages: 2,
    minimumItems: 2,
    maximumItems: 5,
    incompatibleApps: ['hero', 'heroBeforeAfter', 'splitHero'],
    supportedVariants: ['heroSlider'],
    suitableForTrades: false,
    qualityScore: 0.85
  }),
  splitHero: meta({
    pagePurposes: ['home'],
    imageDependency: 'required',
    recommendedPagePosition: 'hero',
    requiredImages: 1,
    incompatibleApps: ['hero', 'heroSlider', 'heroBeforeAfter'],
    supportedVariants: ['splitHero'],
    qualityScore: 0.82
  }),
  services: meta({
    pagePurposes: ['home', 'services'],
    conversionGoals: ['enquire', 'book'],
    contentDensity: 'cards',
    minimumItems: 3,
    maximumItems: 8,
    compatiblePreviousApps: ['hero', 'trustBar'],
    compatibleNextApps: ['why', 'featuredProjects', 'quote'],
    qualityScore: 0.93
  }),
  featuredProjects: meta({
    pagePurposes: ['home', 'gallery'],
    imageDependency: 'required',
    contentDensity: 'gallery',
    minimumItems: 2,
    maximumItems: 9,
    requiredImages: 2,
    suitableForTrades: true,
    suitableForHospitality: true,
    suitableForRetail: true,
    suitableForEvents: true,
    qualityScore: 0.9
  }),
  why: meta({
    pagePurposes: ['home'],
    trustPurpose: true,
    contentDensity: 'editorial',
    compatiblePreviousApps: ['services', 'featuredProjects'],
    qualityScore: 0.88
  }),
  trustBar: meta({
    pagePurposes: ['home'],
    trustPurpose: true,
    contentDensity: 'compact',
    recommendedPagePosition: 'upper',
    minimumItems: 3,
    maximumItems: 6,
    qualityScore: 0.86
  }),
  reviews: meta({
    pagePurposes: ['home'],
    trustPurpose: true,
    minimumItems: 2,
    maximumItems: 8,
    qualityScore: 0.9
  }),
  reviewHighlights: meta({
    pagePurposes: ['home'],
    trustPurpose: true,
    minimumItems: 1,
    maximumItems: 4,
    qualityScore: 0.84
  }),
  faq: meta({
    pagePurposes: ['home', 'landing'],
    contentDensity: 'list',
    minimumItems: 2,
    maximumItems: 8,
    compatiblePreviousApps: ['quote', 'services'],
    qualityScore: 0.87
  }),
  quote: meta({
    pagePurposes: ['home', 'landing'],
    conversionGoals: ['enquire', 'book', 'quote'],
    recommendedPagePosition: 'conversion',
    mobilePriority: 'high',
    qualityScore: 0.94
  }),
  onlineQuote: meta({
    pagePurposes: ['home', 'landing'],
    conversionGoals: ['quote', 'book'],
    recommendedPagePosition: 'conversion',
    suitableForHospitality: false,
    suitableForRetail: false,
    qualityScore: 0.8
  }),
  specialOffer: meta({
    pagePurposes: ['home'],
    conversionGoals: ['book', 'enquire'],
    contentDensity: 'promo',
    qualityScore: 0.83
  }),
  crew: meta({
    pagePurposes: ['home'],
    trustPurpose: true,
    imageDependency: 'optional',
    suitableForTrades: true,
    suitableForProfessionalServices: true,
    suitableForBeauty: true,
    qualityScore: 0.85
  }),
  serviceProcess: meta({
    pagePurposes: ['home'],
    contentDensity: 'steps',
    minimumItems: 3,
    maximumItems: 6,
    // Used for trade workflows and hospitality booking journeys
    suitableForHospitality: true,
    suitableForEvents: true,
    suitableForRetail: false,
    suitableForTrades: true,
    suitableForProfessionalServices: true,
    qualityScore: 0.84
  }),
  area: meta({
    pagePurposes: ['home'],
    suitableForHospitality: false,
    suitableForRetail: false,
    suitableForTrades: true,
    industries: ['electrical', 'plumbing', 'security', 'hvac', 'trade'],
    qualityScore: 0.78
  }),
  emerg: meta({
    pagePurposes: ['home'],
    conversionGoals: ['call'],
    recommendedPagePosition: 'top',
    suitableForHospitality: false,
    suitableForRetail: false,
    suitableForProfessionalServices: false,
    suitableForEvents: false,
    suitableForTrades: true,
    industries: ['electrical', 'plumbing', 'security', 'hvac', 'trade'],
    qualityScore: 0.75
  }),
  certifications: meta({
    trustPurpose: true,
    suitableForTrades: true,
    suitableForHospitality: false,
    suitableForRetail: false,
    qualityScore: 0.72
  }),
  beforeAfter: meta({
    pagePurposes: ['home', 'gallery'],
    imageDependency: 'required',
    requiredImages: 2,
    suitableForTrades: true,
    suitableForConstruction: true,
    suitableForHospitality: false,
    suitableForRetail: false,
    suitableForProfessionalServices: false,
    qualityScore: 0.8
  }),
  instaGallery: meta({
    pagePurposes: ['home'],
    imageDependency: 'required',
    requiredImages: 3,
    suitableForHospitality: true,
    suitableForRetail: true,
    suitableForBeauty: true,
    suitableForEvents: true,
    qualityScore: 0.8
  })
});

function getAppMetadata(appId) {
  const m = APP_METADATA[appId];
  return m ? { ...m } : null;
}

function listAppMetadataIds() {
  return Object.keys(APP_METADATA);
}

/**
 * Score an app for a business profile / foundation / recipe context.
 */
function scoreAppForContext(appId, ctx) {
  const m = getAppMetadata(appId);
  if (!m || m.status !== 'supported') return { appId, score: -1000, reasons: ['unsupported'] };

  let score = (m.qualityScore || 0.5) * 40;
  const reasons = ['base_quality'];
  const industry = String((ctx && ctx.industry) || '').toLowerCase();
  const foundationCat = String((ctx && ctx.foundationCategory) || '').toLowerCase();
  const goal = String((ctx && ctx.conversionGoal) || '').toLowerCase();

  const flagMap = {
    trades: 'suitableForTrades',
    hospitality: 'suitableForHospitality',
    retail: 'suitableForRetail',
    events: 'suitableForEvents',
    professional: 'suitableForProfessionalServices',
    beauty: 'suitableForHospitality',
    creative: 'suitableForEvents',
    construction: 'suitableForTrades'
  };

  const flag = flagMap[foundationCat];
  if (flag && m[flag] === false) {
    return { appId, score: -200, reasons: ['unsuitable_foundation:' + foundationCat] };
  }
  if (flag && m[flag] === true) {
    score += 15;
    reasons.push('foundation_fit');
  }

  if (Array.isArray(m.industries) && !m.industries.includes('*')) {
    if (m.industries.some((i) => industry.includes(i) || i.includes(industry))) {
      score += 20;
      reasons.push('industry_fit');
    } else {
      score -= 80;
      reasons.push('industry_mismatch');
    }
  }

  if (goal && (m.conversionGoals || []).some((g) => goal.includes(g) || g.includes(goal.split('-')[0]))) {
    score += 10;
    reasons.push('conversion_fit');
  }

  if (ctx && Array.isArray(ctx.excludeApps) && ctx.excludeApps.includes(appId)) {
    return { appId, score: -500, reasons: ['explicitly_excluded'] };
  }

  return { appId, score, reasons, metadata: m };
}

module.exports = {
  APP_METADATA,
  getAppMetadata,
  listAppMetadataIds,
  scoreAppForContext
};
