'use strict';

/**
 * Verified LeadPages identifiers for Theme Studio (Phases 1–2).
 * Sources: manage.html LAYOUTS / DEFAULT_TRADE_SECTIONS / headerStyle;
 * lib/marketplace-categories.js; marketplace app-content section_keys.
 * Do not invent IDs — only reference values present in the repository.
 */

/** @type {readonly string[]} */
const LAYOUT_IDS = Object.freeze([
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
]);

/** Competing hero section keys (HERO_EXCLUSIVE + classic hero). */
const HERO_VARIANTS = Object.freeze([
  'hero',
  'heroSlider',
  'heroBeforeAfter',
  'splitHero'
]);

/** logo.headerStyle values from manage.html */
const HEADER_VARIANTS = Object.freeze([
  'solid-sticky',
  'solid-scroll',
  'float',
  'shrink'
]);

/** sites.template values verified in api/render.js / manage.html */
const SITE_TEMPLATES = Object.freeze(['trade', 'broker-leads', 'broker-app']);

/** APPR_FONTS keys from manage.html */
const FONT_NAMES = Object.freeze([
  'Fraunces',
  'Playfair Display',
  'Lora',
  'DM Serif Display',
  'Poppins',
  'Inter',
  'Work Sans',
  'DM Sans',
  'System'
]);

/**
 * Section keys from manage.html DEFAULT_TRADE_SECTIONS (verified).
 * @type {readonly string[]}
 */
const KNOWN_SECTION_KEYS = Object.freeze([
  'navMenu',
  'textBox',
  'seoTokens',
  'emergencyAvailability',
  'serviceAreaMap',
  'onlineQuote',
  'estimateBuilder',
  'certifications',
  'finance',
  'trustBar',
  'serviceProcess',
  'featureStrip',
  'projectFeed',
  'instaGallery',
  'igProjectFeed',
  'activityTimeline',
  'customerReactions',
  'videoReels',
  'jobsFeed',
  'beforeAfterFeed',
  'crew',
  'splitHero',
  'activityCounter',
  'proofStream',
  'heroSlider',
  'heroBeforeAfter',
  'specialOffer',
  'featuredProjects',
  'reviewHighlights',
  'serviceAreas',
  'projectStats',
  'responseCards',
  'beforeAfter',
  'header',
  'hero',
  'services',
  'why',
  'area',
  'reviews',
  'faq',
  'quote',
  'emerg',
  'footer'
]);

/**
 * Marketplace / catalog section_keys commonly attached as apps.
 * Values are the same verified keys (slug identity = section_key).
 */
const MARKETPLACE_SECTION_KEYS = Object.freeze({
  PROJECT_FEED: 'projectFeed',
  INSTAGRAM_FEED: 'instaGallery',
  IG_PROJECT_FEED: 'igProjectFeed',
  QUOTE_BUILDER: 'onlineQuote',
  BOOKING: 'onlineQuote',
  ESTIMATE_BUILDER: 'estimateBuilder',
  BEFORE_AFTER: 'beforeAfter',
  TRUST_BAR: 'trustBar',
  FEATURED_PROJECTS: 'featuredProjects'
});

/** Section keys that are strongly tradie / emergency oriented. */
const TRADE_ONLY_SECTION_KEYS = Object.freeze([
  'emerg',
  'emergencyAvailability',
  'responseCards',
  'jobsFeed',
  'serviceProcess',
  'featureStrip',
  'proofStream',
  'activityCounter',
  'activityTimeline',
  'certifications',
  'serviceAreaMap',
  'serviceAreas',
  'area'
]);

/**
 * Writable config paths the adapter may set (allowlist).
 * Paths use dot notation; `sections.<key>` means any known section key.
 */
const WRITABLE_CONFIG_PATHS = Object.freeze([
  'theme.pipe',
  'theme.hivis',
  'theme.steel',
  'theme.safety',
  'theme.lightBg',
  'theme.accent',
  'theme.presetName',
  'theme.presetKey',
  'theme.fonts.fontDisplay',
  'theme.fonts.fontUi',
  'layout',
  'sectionOrder',
  'trade',
  'name',
  'phone',
  'phoneText',
  'email',
  'region',
  'seoTitle',
  'seoDescription',
  'logo.headerStyle',
  'services',
  'sections',
  'pages'
]);

/**
 * Protected operational fields — never written by Theme Studio adapter.
 * Documented for Phase 3+ redesign merges; Phases 1–2 enforce via omit.
 */
const PROTECTED_FIELDS = Object.freeze([
  'id',
  'slug',
  'owner_user_id',
  'owner_email',
  'referring_partner_id',
  'servicing_partner_id',
  'commission_partner_id',
  'custom_domain',
  'status',
  'billing_status',
  'plan_key',
  'stripe_customer_id',
  'stripe_item_id',
  'setup_paid',
  'is_partner_home',
  'is_demo',
  'is_mockup',
  // config-level operational
  'users',
  'savedThemes',
  'googleAds',
  'google_ads',
  'analytics',
  'gtmId',
  'gaId',
  'facebookPixel',
  'tracking',
  'crm',
  'emailIntegrations',
  'leadRouting',
  'formDestinations',
  'permissions',
  'auth',
  'billing',
  'domain',
  'domains',
  'publishing',
  'publishedAt',
  'preview_password',
  'password'
]);

const CONCEPT_SCHEMA_VERSION = 1;
const CONCEPT_SCHEMA_ID = 'theme_studio.concept.v1';

module.exports = {
  LAYOUT_IDS,
  HERO_VARIANTS,
  HEADER_VARIANTS,
  SITE_TEMPLATES,
  FONT_NAMES,
  KNOWN_SECTION_KEYS,
  MARKETPLACE_SECTION_KEYS,
  TRADE_ONLY_SECTION_KEYS,
  WRITABLE_CONFIG_PATHS,
  PROTECTED_FIELDS,
  CONCEPT_SCHEMA_VERSION,
  CONCEPT_SCHEMA_ID
};
