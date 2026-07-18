'use strict';

/**
 * Website Composer foundations — STRUCTURAL ONLY.
 *
 * A foundation defines page skeleton, navigation defaults, spacing, recommended
 * app regions, layout rules, conversion style, and section placeholders.
 *
 * Foundations MUST NOT include:
 * - business copy, services, FAQs, testimonials
 * - imagery URLs or stock photo subjects
 * - plumbing / landscaping / trade marketing content
 * - sourceTemplateId trade inheritance
 */

const {
  LAYOUT_IDS,
  HEADER_VARIANTS,
  HERO_VARIANTS,
  TRADE_ONLY_SECTION_KEYS
} = require('./constants');

const CORE_SECTIONS = [
  'hero',
  'trustBar',
  'services',
  'why',
  'reviews',
  'quote',
  'faq',
  'footer',
  'crew',
  'featuredProjects',
  'specialOffer',
  'reviewHighlights',
  'heroSlider',
  'splitHero',
  'onlineQuote',
  'instaGallery',
  'navMenu',
  'seoTokens',
  'textBox',
  'productCollection',
  'clientLogos',
  'bookingCta',
  'brandStory',
  'packageCompare',
  'featureStrip',
  'customerReactions',
  'jobsFeed',
  'projectFeed',
  'projectStats',
  'serviceAreas',
  'beforeAfterFeed'
];

function baseFoundation(partial) {
  return {
    status: 'active',
    version: 3,
    // Explicit: foundations do not inherit a trade content template.
    sourceTemplateId: null,
    rendererShellId: 'landing-shell-neutral-v1',
    pageSkeleton: ['home'],
    navigationDefaults: [
      { label: 'Services', target: '#services' },
      { label: 'Contact', target: '#quote' }
    ],
    spacingProfile: 'balanced',
    recommendedAppRegions: ['proof', 'conversion'],
    layoutRules: {
      heroExclusive: true,
      maxHeroVariants: 1,
      requireFooter: true
    },
    sectionPlaceholders: ['hero', 'services', 'why', 'quote', 'footer'],
    sourceAppIds: [],
    excludedIndustries: [],
    aliases: [],
    incompatibilities: {
      sectionKeys: [],
      layoutIds: [],
      heroVariants: []
    },
    supportedHeaderVariants: [...HEADER_VARIANTS],
    supportedFooterVariants: ['standard', 'minimal', 'bold'],
    supportedHeroVariants: [...HERO_VARIANTS],
    compatibleLayoutIds: ['classic', 'authority-builder', 'premium-showcase', 'quote-first', 'reviews-first'],
    typographyProfile: {
      headingFont: 'Fraunces',
      bodyFont: 'DM Sans',
      scale: 'balanced'
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
    id: 'trades',
    name: 'Trades',
    aliases: ['trade-field-services'],
    category: 'trades',
    supportedIndustries: [
      'plumbing',
      'electrical',
      'electrician',
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
    spacingProfile: 'compact',
    recommendedAppRegions: ['emergency', 'proof', 'booking', 'areas'],
    sectionPlaceholders: [
      'emerg',
      'hero',
      'trustBar',
      'services',
      'serviceProcess',
      'why',
      'reviews',
      'area',
      'quote',
      'faq',
      'footer'
    ],
    supportedSectionKeys: [
      ...CORE_SECTIONS,
      'emerg',
      'serviceProcess',
      'featureStrip',
      'area',
      'beforeAfter',
      'certifications',
      'finance',
      'estimateBuilder',
      'emergencyAvailability',
      'responseCards',
      'projectStats',
      'serviceAreas',
      'heroBeforeAfter',
      'projectFeed',
      'jobsFeed',
      'beforeAfterFeed',
      'videoReels',
      'activityCounter',
      'proofStream',
      'activityTimeline',
      'customerReactions',
      'serviceAreaMap',
      'igProjectFeed'
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
      'onlineQuote'
    ],
    defaultSectionOrder: [
      'emerg',
      'hero',
      'trustBar',
      'services',
      'serviceProcess',
      'why',
      'reviews',
      'area',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'classic',
    compatibleLayoutIds: [...LAYOUT_IDS],
    typographyProfile: { headingFont: 'Fraunces', bodyFont: 'DM Sans', scale: 'bold' }
  }),

  baseFoundation({
    id: 'professional-services',
    name: 'Professional Services',
    category: 'professional',
    supportedIndustries: [
      'accounting',
      'legal',
      'lawyer',
      'law',
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
    recommendedAppRegions: ['credibility', 'team', 'booking'],
    sectionPlaceholders: ['hero', 'trustBar', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS, 'projectStats'],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: ['trustBar', 'reviews', 'faq', 'crew', 'specialOffer', 'onlineQuote', 'featuredProjects'],
    defaultSectionOrder: ['hero', 'trustBar', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'authority-builder',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Playfair Display', bodyFont: 'Inter', scale: 'refined' }
  }),

  baseFoundation({
    id: 'hospitality',
    name: 'Hospitality',
    aliases: ['hospitality-cafe'],
    category: 'hospitality',
    supportedIndustries: [
      'cafe',
      'coffee',
      'coffee-cart',
      'coffee-event',
      'restaurant',
      'bar',
      'bakery',
      'hospitality',
      'catering',
      'roaster'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'security', 'jewellery', 'legal'],
    visualStyles: ['warm', 'inviting', 'artisan', 'lifestyle'],
    conversionStyle: 'visit-and-book',
    spacingProfile: 'airy',
    recommendedAppRegions: ['gallery', 'menu', 'booking', 'social'],
    sectionPlaceholders: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    supportedSectionKeys: [
      ...CORE_SECTIONS,
      'igProjectFeed',
      'serviceProcess',
      'packageCompare',
      'clientLogos',
      'bookingCta',
      'brandStory'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'specialOffer',
      'instaGallery',
      'crew',
      'faq',
      'serviceProcess',
      'packageCompare',
      'clientLogos',
      'bookingCta',
      'brandStory'
    ],
    defaultSectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'packageCompare',
      'why',
      'serviceProcess',
      'clientLogos',
      'reviews',
      'bookingCta',
      'faq',
      'quote',
      'footer'
    ],
    defaultLayoutId: 'premium-showcase',
    compatibleLayoutIds: [
      'premium-showcase',
      'classic',
      'offer-funnel',
      'reviews-first',
      'hero-image-slider',
      'photo-proof',
      'authority-builder'
    ],
    incompatibilities: {
      // serviceProcess allowed for hospitality booking journeys (not trade-only here)
      sectionKeys: [
        ...TRADE_ONLY_SECTION_KEYS.filter((k) => k !== 'serviceProcess'),
        'beforeAfter',
        'jobsFeed',
        'emerg'
      ],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Lora', bodyFont: 'DM Sans', scale: 'warm' }
  }),

  baseFoundation({
    id: 'retail',
    name: 'Retail',
    aliases: ['retail-boutique'],
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
    spacingProfile: 'airy',
    recommendedAppRegions: ['gallery', 'appointment', 'social'],
    sectionPlaceholders: [
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
    supportedSectionKeys: [
      ...CORE_SECTIONS,
      'igProjectFeed',
      'productCollection',
      'brandStory',
      'bookingCta',
      'clientLogos'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'specialOffer',
      'faq',
      'instaGallery',
      'crew',
      'brandStory',
      'bookingCta',
      'productCollection'
    ],
    defaultSectionOrder: [
      'hero',
      'productCollection',
      'featuredProjects',
      'brandStory',
      'why',
      'reviews',
      'bookingCta',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'premium-showcase',
    compatibleLayoutIds: ['premium-showcase', 'classic', 'offer-funnel', 'reviews-first', 'hero-image-slider'],
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed', 'emerg', 'serviceProcess'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Playfair Display', bodyFont: 'Inter', scale: 'editorial' }
  }),

  baseFoundation({
    id: 'health',
    name: 'Health',
    aliases: ['health-wellness'],
    category: 'health',
    supportedIndustries: [
      'health',
      'wellness',
      'physiotherapy',
      'dental',
      'medical',
      'chiropractic',
      'psychology',
      'allied-health'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'jewellery', 'cafe'],
    visualStyles: ['calm', 'clean', 'reassuring'],
    conversionStyle: 'book-appointment',
    recommendedAppRegions: ['team', 'booking', 'credibility'],
    sectionPlaceholders: ['hero', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: ['crew', 'reviews', 'faq', 'trustBar', 'onlineQuote'],
    defaultSectionOrder: ['hero', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'reviews-first',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS.filter((k) => k !== 'area'), 'beforeAfter', 'jobsFeed', 'emerg'],
      layoutIds: ['emergency-response', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Lora', bodyFont: 'Inter', scale: 'calm' }
  }),

  baseFoundation({
    id: 'beauty',
    name: 'Beauty',
    category: 'beauty',
    supportedIndustries: [
      'beauty',
      'hair',
      'hair-salon',
      'salon',
      'barber',
      'nails',
      'spa',
      'aesthetics',
      'makeup'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'legal', 'security'],
    visualStyles: ['polished', 'warm', 'glamorous', 'modern'],
    conversionStyle: 'book-appointment',
    spacingProfile: 'airy',
    recommendedAppRegions: ['gallery', 'booking', 'social', 'team'],
    sectionPlaceholders: [
      'hero',
      'services',
      'featuredProjects',
      'why',
      'crew',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    supportedSectionKeys: [...CORE_SECTIONS, 'igProjectFeed'],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    optionalSectionKeys: ['featuredProjects', 'why', 'crew', 'reviews', 'specialOffer', 'instaGallery', 'faq'],
    defaultSectionOrder: [
      'hero',
      'services',
      'featuredProjects',
      'why',
      'crew',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    defaultLayoutId: 'premium-showcase',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed', 'emerg'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Playfair Display', bodyFont: 'DM Sans', scale: 'soft' }
  }),

  baseFoundation({
    id: 'events',
    name: 'Events',
    aliases: ['events-hire'],
    category: 'events',
    supportedIndustries: [
      'event-hire',
      'events',
      'wedding',
      'marquee',
      'party-hire',
      'corporate-events',
      'event-planning'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'jewellery'],
    visualStyles: ['celebratory', 'polished', 'catalogue'],
    conversionStyle: 'request-availability',
    recommendedAppRegions: ['gallery', 'packages', 'booking'],
    sectionPlaceholders: [
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
    supportedSectionKeys: [...CORE_SECTIONS],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: ['why', 'specialOffer', 'reviews', 'faq', 'crew'],
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
    defaultLayoutId: 'premium-showcase',
    compatibleLayoutIds: [
      'premium-showcase',
      'classic',
      'offer-funnel',
      'reviews-first',
      'hero-image-slider',
      'photo-proof',
      'authority-builder',
      'quote-first'
    ],
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed', 'emerg'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Fraunces', bodyFont: 'DM Sans', scale: 'celebratory' }
  }),

  baseFoundation({
    id: 'construction',
    name: 'Construction',
    aliases: ['property-construction'],
    category: 'construction',
    supportedIndustries: [
      'construction',
      'builder',
      'renovation',
      'property-development',
      'carpentry',
      'project-building',
      'landscaping',
      'garden-design'
    ],
    visualStyles: ['solid', 'documentary', 'premium-trade'],
    conversionStyle: 'quote-project',
    recommendedAppRegions: ['gallery', 'process', 'proof'],
    sectionPlaceholders: [
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
    supportedSectionKeys: [
      ...CORE_SECTIONS,
      'beforeAfter',
      'serviceProcess',
      'featureStrip',
      'projectStats',
      'projectFeed',
      'heroBeforeAfter'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: ['beforeAfter', 'serviceProcess', 'why', 'reviews', 'faq'],
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
      'premium-showcase',
      'authority-builder',
      'classic',
      'ba-hero-slider',
      'hero-image-slider'
    ],
    incompatibilities: {
      sectionKeys: ['emerg', 'emergencyAvailability', 'responseCards', 'jobsFeed'],
      layoutIds: ['emergency-response'],
      heroVariants: []
    },
    typographyProfile: { headingFont: 'Fraunces', bodyFont: 'Work Sans', scale: 'solid' }
  }),

  baseFoundation({
    id: 'creative',
    name: 'Creative',
    aliases: ['creative-agency'],
    category: 'creative',
    supportedIndustries: [
      'creative',
      'agency',
      'design',
      'photography',
      'wedding-photography',
      'photographer',
      'videography',
      'branding',
      'marketing-agency'
    ],
    excludedIndustries: ['plumbing', 'electrical', 'security'],
    visualStyles: ['bold', 'editorial', 'portfolio'],
    conversionStyle: 'enquire',
    spacingProfile: 'airy',
    recommendedAppRegions: ['portfolio', 'process', 'booking'],
    sectionPlaceholders: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'footer'
    ],
    supportedSectionKeys: [...CORE_SECTIONS, 'igProjectFeed', 'videoReels', 'projectFeed'],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: ['why', 'crew', 'reviews', 'instaGallery', 'faq'],
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
    defaultLayoutId: 'premium-showcase',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'beforeAfter', 'jobsFeed', 'emerg'],
      layoutIds: ['emergency-response', 'service-area-dominator', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'DM Serif Display', bodyFont: 'Work Sans', scale: 'editorial' }
  }),

  baseFoundation({
    id: 'education',
    name: 'Education',
    category: 'education',
    supportedIndustries: ['education', 'tutoring', 'training', 'school', 'course', 'coaching-education'],
    visualStyles: ['clear', 'friendly', 'structured'],
    conversionStyle: 'enrol-enquire',
    recommendedAppRegions: ['programs', 'credibility', 'booking'],
    sectionPlaceholders: ['hero', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: ['crew', 'reviews', 'faq', 'featuredProjects'],
    defaultSectionOrder: ['hero', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'authority-builder',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'emerg', 'beforeAfter'],
      layoutIds: ['emergency-response', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    }
  }),

  baseFoundation({
    id: 'technology',
    name: 'Technology',
    category: 'technology',
    supportedIndustries: ['technology', 'saas', 'software', 'it-services', 'msp', 'app-development'],
    visualStyles: ['modern', 'precise', 'product'],
    conversionStyle: 'demo-enquire',
    recommendedAppRegions: ['product', 'proof', 'booking'],
    sectionPlaceholders: ['hero', 'services', 'featureStrip', 'why', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS, 'featureStrip', 'projectStats'],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: ['featureStrip', 'reviews', 'faq', 'crew', 'featuredProjects'],
    defaultSectionOrder: ['hero', 'services', 'featureStrip', 'why', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'authority-builder',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'emerg', 'beforeAfter'],
      layoutIds: ['emergency-response', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    },
    typographyProfile: { headingFont: 'Poppins', bodyFont: 'Inter', scale: 'product' }
  }),

  baseFoundation({
    id: 'non-profit',
    name: 'Non-profit',
    category: 'non-profit',
    supportedIndustries: ['non-profit', 'charity', 'ngo', 'community', 'foundation'],
    visualStyles: ['human', 'hopeful', 'clear'],
    conversionStyle: 'donate-volunteer',
    recommendedAppRegions: ['impact', 'stories', 'cta'],
    sectionPlaceholders: ['hero', 'services', 'why', 'featuredProjects', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    optionalSectionKeys: ['featuredProjects', 'reviews', 'faq', 'crew'],
    defaultSectionOrder: ['hero', 'why', 'services', 'featuredProjects', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'reviews-first',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'emerg', 'beforeAfter'],
      layoutIds: ['emergency-response', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    }
  }),

  baseFoundation({
    id: 'travel',
    name: 'Travel',
    category: 'travel',
    supportedIndustries: ['travel', 'tourism', 'tour', 'accommodation', 'holiday'],
    visualStyles: ['scenic', 'aspirational', 'warm'],
    conversionStyle: 'book-trip',
    spacingProfile: 'airy',
    recommendedAppRegions: ['gallery', 'packages', 'booking'],
    sectionPlaceholders: ['hero', 'featuredProjects', 'services', 'why', 'reviews', 'quote', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    optionalSectionKeys: ['why', 'reviews', 'specialOffer', 'faq'],
    defaultSectionOrder: ['hero', 'featuredProjects', 'services', 'why', 'reviews', 'quote', 'footer'],
    defaultLayoutId: 'premium-showcase',
    incompatibilities: {
      sectionKeys: [...TRADE_ONLY_SECTION_KEYS, 'emerg', 'beforeAfter'],
      layoutIds: ['emergency-response', 'ba-hero-slider'],
      heroVariants: ['heroBeforeAfter']
    }
  }),

  baseFoundation({
    id: 'manufacturing',
    name: 'Manufacturing',
    category: 'manufacturing',
    supportedIndustries: ['manufacturing', 'fabrication', 'production', 'factory'],
    visualStyles: ['industrial', 'precise', 'capability'],
    conversionStyle: 'rfq',
    recommendedAppRegions: ['capabilities', 'proof', 'contact'],
    sectionPlaceholders: ['hero', 'services', 'featuredProjects', 'why', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS, 'featureStrip', 'projectStats', 'beforeAfter'],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    optionalSectionKeys: ['featuredProjects', 'why', 'reviews', 'faq', 'featureStrip'],
    defaultSectionOrder: ['hero', 'services', 'featuredProjects', 'why', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'authority-builder',
    incompatibilities: {
      sectionKeys: ['emerg', 'emergencyAvailability', 'responseCards', 'jobsFeed'],
      layoutIds: ['emergency-response'],
      heroVariants: []
    }
  }),

  baseFoundation({
    id: 'industrial',
    name: 'Industrial',
    category: 'industrial',
    supportedIndustries: ['industrial', 'warehousing', 'logistics', 'heavy-industry'],
    visualStyles: ['robust', 'clear', 'operational'],
    conversionStyle: 'rfq',
    recommendedAppRegions: ['capabilities', 'safety', 'contact'],
    sectionPlaceholders: ['hero', 'services', 'why', 'certifications', 'reviews', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS, 'certifications', 'featureStrip', 'projectStats'],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    optionalSectionKeys: ['why', 'certifications', 'reviews', 'faq'],
    defaultSectionOrder: ['hero', 'services', 'why', 'certifications', 'reviews', 'quote', 'faq', 'footer'],
    defaultLayoutId: 'classic',
    incompatibilities: {
      sectionKeys: ['emerg', 'emergencyAvailability', 'responseCards'],
      layoutIds: ['emergency-response', 'offer-funnel'],
      heroVariants: ['heroBeforeAfter']
    }
  }),

  baseFoundation({
    id: 'automotive',
    name: 'Automotive',
    category: 'automotive',
    supportedIndustries: ['automotive', 'mechanic', 'auto-repair', 'detailing', 'car-dealership'],
    visualStyles: ['sharp', 'practical', 'premium'],
    conversionStyle: 'book-service',
    recommendedAppRegions: ['services', 'proof', 'booking'],
    sectionPlaceholders: ['hero', 'services', 'why', 'reviews', 'specialOffer', 'quote', 'faq', 'footer'],
    supportedSectionKeys: [...CORE_SECTIONS, 'beforeAfter', 'serviceProcess', 'bookingCta'],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    optionalSectionKeys: [
      'why',
      'reviews',
      'specialOffer',
      'faq',
      'beforeAfter',
      'serviceProcess',
      'bookingCta'
    ],
    defaultSectionOrder: [
      'hero',
      'services',
      'why',
      'beforeAfter',
      'reviews',
      'specialOffer',
      'quote',
      'faq',
      'footer'
    ],
    defaultLayoutId: 'classic',
    incompatibilities: {
      sectionKeys: ['emerg', 'emergencyAvailability', 'responseCards', 'jobsFeed'],
      layoutIds: ['emergency-response'],
      heroVariants: []
    }
  })
]);

module.exports = { FOUNDATIONS };
