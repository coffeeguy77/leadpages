'use strict';

/**
 * Curated Theme Studio foundation registry (static data).
 *
 * Rules:
 * - Only reference verified layout / template / section keys from the repo.
 * - Non-trade foundations still use sourceTemplateId "trade" (the only public
 *   multi-section landing renderer). Content and section sets must not inherit
 *   trade copy or trade-only modules.
 * - sourceAppIds list marketplace section_keys (verified app identities).
 */

const {
  LAYOUT_IDS,
  HEADER_VARIANTS,
  HERO_VARIANTS,
  MARKETPLACE_SECTION_KEYS,
  TRADE_ONLY_SECTION_KEYS
} = require('./constants');

const MK = MARKETPLACE_SECTION_KEYS;

function baseFoundation(partial) {
  return {
    status: 'active',
    version: 1,
    sourceTemplateId: 'trade',
    sourceAppIds: [],
    excludedIndustries: [],
    incompatibilities: {
      sectionKeys: [],
      layoutIds: [],
      heroVariants: []
    },
    supportedHeaderVariants: [...HEADER_VARIANTS],
    supportedFooterVariants: ['standard', 'minimal', 'bold'],
    supportedHeroVariants: [...HERO_VARIANTS],
    compatibleLayoutIds: [...LAYOUT_IDS],
    typographyProfile: {
      headingFont: 'Fraunces',
      bodyFont: 'DM Sans',
      scale: 'balanced'
    },
    imageDirectionProfile: {
      mood: ['authentic', 'local'],
      avoid: ['stock-handshake', 'generic-skyline']
    },
    mobileProfile: {
      stackOrder: 'content-first',
      stickyCta: true,
      heroHeight: 'compact'
    },
    ...partial
  };
}

/** @type {ReadonlyArray<object>} */
const FOUNDATIONS = Object.freeze([
  baseFoundation({
    id: 'trade-field-services',
    name: 'Trade / Field Services',
    category: 'trade',
    supportedIndustries: [
      'plumbing',
      'electrical',
      'hvac',
      'security',
      'property-maintenance',
      'landscaping',
      'cleaning',
      'pest-control',
      'roofing',
      'handyman',
      'trade',
      'field-services'
    ],
    visualStyles: ['bold', 'trustworthy', 'high-contrast', 'practical'],
    conversionStyle: 'call-and-quote',
    supportedSectionKeys: [
      'emerg',
      'hero',
      'trustBar',
      'services',
      'serviceProcess',
      'featureStrip',
      'why',
      'crew',
      'area',
      'reviews',
      'quote',
      'faq',
      'footer',
      'beforeAfter',
      'specialOffer',
      'certifications',
      'finance',
      'estimateBuilder',
      'emergencyAvailability',
      'responseCards',
      'projectStats',
      'serviceAreas',
      'reviewHighlights',
      'featuredProjects',
      'heroSlider',
      'heroBeforeAfter',
      'splitHero',
      'activityCounter',
      'proofStream',
      'projectFeed',
      'jobsFeed',
      'beforeAfterFeed',
      'videoReels',
      'activityTimeline',
      'customerReactions',
      'onlineQuote',
      'serviceAreaMap',
      'instaGallery',
      'igProjectFeed',
      'seoTokens',
      'textBox',
      'navMenu'
    ],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    optionalSectionKeys: [
      'emerg',
      'trustBar',
      'why',
      'reviews',
      'faq',
      'area',
      'serviceProcess',
      'featureStrip',
      'beforeAfter',
      'specialOffer',
      'jobsFeed',
      'projectFeed',
      'onlineQuote',
      'emergencyAvailability'
    ],
    defaultSectionOrder: [
      'emerg',
      'hero',
      'trustBar',
      'services',
      'serviceProcess',
      'featureStrip',
      'why',
      'reviews',
      'area',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'classic',
    compatibleLayoutIds: [
      'classic',
      'quote-first',
      'photo-proof',
      'emergency-response',
      'authority-builder',
      'service-area-dominator',
      'reviews-first',
      'premium-showcase',
      'offer-funnel',
      'ba-hero-slider',
      'hero-image-slider',
      'social-proof-feed'
    ],
    sourceAppIds: [
      MK.PROJECT_FEED,
      MK.QUOTE_BUILDER,
      MK.BEFORE_AFTER,
      MK.TRUST_BAR,
      'jobsFeed',
      'emergencyAvailability'
    ],
    typographyProfile: {
      headingFont: 'Fraunces',
      bodyFont: 'DM Sans',
      scale: 'bold'
    },
    imageDirectionProfile: {
      mood: ['on-site', 'crew', 'before-after', 'tools'],
      avoid: ['luxury-jewellery', 'cafe-lifestyle']
    }
  }),

  baseFoundation({
    id: 'professional-services',
    name: 'Professional Services',
    category: 'professional',
    supportedIndustries: [
      'accounting',
      'legal',
      'consulting',
      'finance',
      'insurance',
      'real-estate-agency',
      'coaching',
      'professional-services'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'hvac', 'security', 'jewellery'],
    visualStyles: ['calm', 'credible', 'editorial', 'minimal'],
    conversionStyle: 'consult-first',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'specialOffer',
      'reviewHighlights',
      'featuredProjects',
      'splitHero',
      'heroSlider',
      'onlineQuote',
      'instaGallery',
      'projectStats',
      'textBox',
      'navMenu',
      'seoTokens'
    ],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: [
      'trustBar',
      'reviews',
      'faq',
      'crew',
      'specialOffer',
      'onlineQuote',
      'featuredProjects',
      'reviewHighlights'
    ],
    defaultSectionOrder: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'authority-builder',
    compatibleLayoutIds: [
      'classic',
      'authority-builder',
      'reviews-first',
      'premium-showcase',
      'quote-first'
    ],
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [MK.TRUST_BAR, MK.BOOKING, MK.INSTAGRAM_FEED, MK.FEATURED_PROJECTS],
    typographyProfile: {
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      scale: 'refined'
    },
    imageDirectionProfile: {
      mood: ['portrait', 'workspace', 'calm-office'],
      avoid: ['hi-vis', 'drains', 'emergency-van']
    }
  }),

  baseFoundation({
    id: 'retail-boutique',
    name: 'Retail / Boutique',
    category: 'retail',
    supportedIndustries: [
      'jewellery',
      'jewelry',
      'retail',
      'boutique',
      'fashion',
      'luxury-goods',
      'gift-retail',
      'homewares'
    ],
    excludedIndustries: [
      'plumbing',
      'electrical',
      'hvac',
      'security',
      'property-maintenance',
      'landscaping',
      'pest-control',
      'trade',
      'field-services'
    ],
    visualStyles: ['luxury', 'elegant', 'editorial', 'feminine', 'modern', 'high-end'],
    conversionStyle: 'appointment-and-browse',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'specialOffer',
      'featuredProjects',
      'reviewHighlights',
      'heroSlider',
      'splitHero',
      'instaGallery',
      'igProjectFeed',
      'onlineQuote',
      'projectStats',
      'textBox',
      'navMenu',
      'seoTokens',
      'videoReels'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'faq',
      'crew',
      'specialOffer',
      'trustBar',
      'instaGallery',
      'onlineQuote',
      'reviewHighlights',
      'heroSlider'
    ],
    defaultSectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'premium-showcase',
    compatibleLayoutIds: [
      'premium-showcase',
      'classic',
      'photo-proof',
      'hero-image-slider',
      'reviews-first'
    ],
    incompatibilities: {
      sectionKeys: [
        ...TRADE_ONLY_SECTION_KEYS,
        'beforeAfter',
        'serviceProcess',
        'jobsFeed',
        MK.PROJECT_FEED,
        'estimateBuilder',
        'finance'
      ],
      layoutIds: [
        'emergency-response',
        'service-area-dominator',
        'offer-funnel',
        'ba-hero-slider'
      ],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [
      MK.FEATURED_PROJECTS,
      MK.INSTAGRAM_FEED,
      MK.BOOKING,
      MK.TRUST_BAR
    ],
    typographyProfile: {
      headingFont: 'Playfair Display',
      bodyFont: 'DM Sans',
      scale: 'editorial'
    },
    imageDirectionProfile: {
      mood: ['product-closeup', 'editorial', 'soft-light', 'jewellery', 'rings'],
      avoid: ['hi-vis', 'drains', 'hedge-trimming', 'emergency-callout', 'tradie-van']
    },
    mobileProfile: {
      stackOrder: 'imagery-first',
      stickyCta: true,
      heroHeight: 'tall'
    }
  }),

  baseFoundation({
    id: 'hospitality-cafe',
    name: 'Hospitality / Café',
    category: 'hospitality',
    supportedIndustries: [
      'cafe',
      'café',
      'coffee',
      'restaurant',
      'hospitality',
      'bakery',
      'bar',
      'wine-bar'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'security', 'jewellery', 'trade'],
    visualStyles: ['warm', 'inviting', 'lifestyle', 'artisan'],
    conversionStyle: 'visit-and-order',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'specialOffer',
      'featuredProjects',
      'heroSlider',
      'instaGallery',
      'igProjectFeed',
      'onlineQuote',
      'videoReels',
      'customerReactions',
      'textBox',
      'navMenu',
      'seoTokens'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'faq',
      'crew',
      'specialOffer',
      'instaGallery',
      'onlineQuote',
      'trustBar',
      'heroSlider'
    ],
    defaultSectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    defaultLayoutId: 'photo-proof',
    compatibleLayoutIds: [
      'photo-proof',
      'classic',
      'premium-showcase',
      'hero-image-slider',
      'social-proof-feed'
    ],
    incompatibilities: {
      sectionKeys: [
        ...TRADE_ONLY_SECTION_KEYS,
        'beforeAfter',
        MK.PROJECT_FEED,
        'estimateBuilder',
        'finance'
      ],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [MK.FEATURED_PROJECTS, MK.INSTAGRAM_FEED, MK.BOOKING, MK.TRUST_BAR],
    typographyProfile: {
      headingFont: 'Lora',
      bodyFont: 'Work Sans',
      scale: 'warm'
    },
    imageDirectionProfile: {
      mood: ['coffee', 'interior', 'food', 'community'],
      avoid: ['hi-vis', 'drains', 'jewellery-macro']
    }
  }),

  baseFoundation({
    id: 'events-hire',
    name: 'Events / Hire',
    category: 'events',
    supportedIndustries: [
      'events',
      'event-hire',
      'equipment-hire',
      'party-hire',
      'wedding-hire',
      'marquee',
      'av-hire'
    ],
    excludedIndustries: ['plumbing', 'jewellery', 'cafe', 'security'],
    visualStyles: ['celebratory', 'polished', 'catalogue', 'bold'],
    conversionStyle: 'quote-and-availability',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'specialOffer',
      'featuredProjects',
      'heroSlider',
      'onlineQuote',
      'estimateBuilder',
      'projectFeed',
      'instaGallery',
      'projectStats',
      'reviewHighlights',
      'textBox',
      'navMenu',
      'seoTokens'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'faq',
      'specialOffer',
      'onlineQuote',
      'estimateBuilder',
      'projectFeed',
      'instaGallery',
      'trustBar'
    ],
    defaultSectionOrder: [
      'hero',
      'services',
      'featuredProjects',
      'why',
      'specialOffer',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'offer-funnel',
    compatibleLayoutIds: [
      'offer-funnel',
      'classic',
      'premium-showcase',
      'photo-proof',
      'quote-first',
      'hero-image-slider'
    ],
    incompatibilities: {
      sectionKeys: [
        ...TRADE_ONLY_SECTION_KEYS.filter((k) => k !== 'area'),
        'beforeAfter',
        'emerg',
        'emergencyAvailability',
        'responseCards',
        'jobsFeed'
      ],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [
      MK.FEATURED_PROJECTS,
      MK.QUOTE_BUILDER,
      MK.PROJECT_FEED,
      MK.INSTAGRAM_FEED,
      MK.ESTIMATE_BUILDER
    ],
    typographyProfile: {
      headingFont: 'Poppins',
      bodyFont: 'DM Sans',
      scale: 'energetic'
    },
    imageDirectionProfile: {
      mood: ['events', 'setup', 'celebration', 'equipment'],
      avoid: ['hi-vis-tradie', 'jewellery-vault', 'emergency-plumbing']
    }
  }),

  baseFoundation({
    id: 'health-wellness',
    name: 'Health / Wellness',
    category: 'health',
    supportedIndustries: [
      'health',
      'wellness',
      'physiotherapy',
      'chiropractic',
      'massage',
      'dental',
      'medical-clinic',
      'yoga',
      'fitness-studio',
      'mental-health'
    ],
    excludedIndustries: ['plumbing', 'security', 'jewellery', 'equipment-hire', 'trade'],
    visualStyles: ['calm', 'clean', 'reassuring', 'soft'],
    conversionStyle: 'book-appointment',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'specialOffer',
      'featuredProjects',
      'splitHero',
      'onlineQuote',
      'instaGallery',
      'reviewHighlights',
      'textBox',
      'navMenu',
      'seoTokens'
    ],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: [
      'reviews',
      'faq',
      'crew',
      'specialOffer',
      'featuredProjects',
      'onlineQuote',
      'trustBar',
      'instaGallery'
    ],
    defaultSectionOrder: [
      'hero',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'reviews-first',
    compatibleLayoutIds: [
      'reviews-first',
      'classic',
      'authority-builder',
      'premium-showcase',
      'quote-first'
    ],
    incompatibilities: {
      sectionKeys: [
        ...TRADE_ONLY_SECTION_KEYS,
        'beforeAfter',
        MK.PROJECT_FEED,
        'estimateBuilder',
        'finance'
      ],
      layoutIds: [
        'emergency-response',
        'service-area-dominator',
        'ba-hero-slider',
        'offer-funnel'
      ],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [MK.BOOKING, MK.TRUST_BAR, MK.INSTAGRAM_FEED],
    typographyProfile: {
      headingFont: 'Lora',
      bodyFont: 'Inter',
      scale: 'soft'
    },
    imageDirectionProfile: {
      mood: ['calm', 'care', 'studio', 'wellness'],
      avoid: ['hi-vis', 'drains', 'party-hire']
    }
  }),

  baseFoundation({
    id: 'creative-agency',
    name: 'Creative / Agency',
    category: 'creative',
    supportedIndustries: [
      'agency',
      'creative',
      'design',
      'marketing',
      'branding',
      'photography',
      'video-production',
      'studio'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'hvac', 'security', 'trade'],
    visualStyles: ['bold', 'expressive', 'portfolio', 'modern'],
    conversionStyle: 'enquiry-portfolio',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer',
      'featuredProjects',
      'projectFeed',
      'heroSlider',
      'splitHero',
      'instaGallery',
      'igProjectFeed',
      'videoReels',
      'projectStats',
      'onlineQuote',
      'textBox',
      'navMenu',
      'seoTokens'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'faq',
      'crew',
      'projectFeed',
      'instaGallery',
      'trustBar',
      'projectStats',
      'heroSlider'
    ],
    defaultSectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'footer'
    ],
    defaultLayoutId: 'social-proof-feed',
    compatibleLayoutIds: [
      'social-proof-feed',
      'premium-showcase',
      'photo-proof',
      'classic',
      'hero-image-slider',
      'authority-builder'
    ],
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    sourceAppIds: [
      MK.FEATURED_PROJECTS,
      MK.PROJECT_FEED,
      MK.INSTAGRAM_FEED,
      MK.BOOKING
    ],
    typographyProfile: {
      headingFont: 'Poppins',
      bodyFont: 'Inter',
      scale: 'expressive'
    },
    imageDirectionProfile: {
      mood: ['portfolio', 'studio', 'creative-process'],
      avoid: ['hi-vis', 'emergency-van', 'jewellery-vault']
    }
  }),

  baseFoundation({
    id: 'property-construction',
    name: 'Property / Construction',
    category: 'property',
    supportedIndustries: [
      'construction',
      'builder',
      'renovation',
      'property-development',
      'architecture',
      'project-management',
      'civil'
    ],
    visualStyles: ['strong', 'documentary', 'premium-trade', 'structured'],
    conversionStyle: 'project-enquiry',
    supportedSectionKeys: [
      'hero',
      'trustBar',
      'services',
      'why',
      'crew',
      'area',
      'reviews',
      'quote',
      'faq',
      'footer',
      'beforeAfter',
      'featuredProjects',
      'projectFeed',
      'serviceProcess',
      'proofStream',
      'jobsFeed',
      'heroSlider',
      'heroBeforeAfter',
      'onlineQuote',
      'estimateBuilder',
      'projectStats',
      'reviewHighlights',
      'instaGallery',
      'serviceAreas',
      'certifications',
      'seoTokens',
      'textBox',
      'navMenu'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'faq',
      'beforeAfter',
      'area',
      'serviceProcess',
      'projectFeed',
      'proofStream',
      'onlineQuote',
      'trustBar'
    ],
    defaultSectionOrder: [
      'hero',
      'services',
      'featuredProjects',
      'beforeAfter',
      'serviceProcess',
      'why',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'photo-proof',
    compatibleLayoutIds: [
      'photo-proof',
      'classic',
      'authority-builder',
      'ba-hero-slider',
      'premium-showcase',
      'reviews-first',
      'hero-image-slider'
    ],
    incompatibilities: {
      sectionKeys: ['emerg', 'emergencyAvailability', 'responseCards'],
      layoutIds: ['emergency-response'],
      heroVariants: []
    },
    sourceAppIds: [
      MK.FEATURED_PROJECTS,
      MK.PROJECT_FEED,
      MK.BEFORE_AFTER,
      MK.QUOTE_BUILDER
    ],
    typographyProfile: {
      headingFont: 'Fraunces',
      bodyFont: 'Work Sans',
      scale: 'structured'
    },
    imageDirectionProfile: {
      mood: ['build-progress', 'finished-spaces', 'site-safety'],
      avoid: ['jewellery', 'cafe-latte-art']
    }
  })
]);

module.exports = {
  FOUNDATIONS
};
