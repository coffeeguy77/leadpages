'use strict';

/**
 * Marketplace recipes — independent of foundations.
 * A recipe decides apps, order, layouts, variants, CTAs, conversions, sections.
 * Recipes do NOT embed unrelated trade/plumbing content.
 */

const { MARKETPLACE_SECTION_KEYS: MK } = require('./constants');

function baseRecipe(partial) {
  return {
    status: 'active',
    version: 1,
    compatibleFoundationIds: [],
    industryHints: [],
    apps: [],
    sectionOrder: [],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    layoutIds: ['classic', 'premium-showcase'],
    variants: { hero: 'hero' },
    ctas: { primaryAction: 'enquire', secondaryAction: 'services' },
    conversionStyle: 'enquire',
    contentHints: { tone: 'clear', serviceShape: 'services' },
    ...partial
  };
}

/** @type {ReadonlyArray<object>} */
const RECIPES = Object.freeze([
  baseRecipe({
    id: 'recipe-field-trade',
    name: 'Field Trade',
    compatibleFoundationIds: ['trades'],
    industryHints: ['electrical', 'electrician', 'plumbing', 'hvac', 'security', 'trade', 'handyman'],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'proof' },
      { sectionKey: MK.QUOTE_BUILDER, role: 'conversion' },
      { sectionKey: 'serviceProcess', role: 'process' }
    ],
    sectionOrder: [
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
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    layoutIds: ['classic', 'quote-first', 'emergency-response', 'authority-builder'],
    variants: { hero: 'hero' },
    ctas: { primaryAction: 'call-quote', secondaryAction: 'services' },
    conversionStyle: 'call-and-quote',
    contentHints: { tone: 'direct', serviceShape: 'trade-services' }
  }),

  baseRecipe({
    id: 'recipe-commercial-legal',
    name: 'Commercial Legal',
    compatibleFoundationIds: ['professional-services'],
    industryHints: ['legal', 'lawyer', 'law', 'commercial-law', 'solicitor'],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'credibility' },
      { sectionKey: MK.BOOKING, role: 'conversion' },
      { sectionKey: 'crew', role: 'team' }
    ],
    sectionOrder: ['hero', 'trustBar', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    requiredSectionKeys: ['hero', 'services', 'why', 'quote', 'footer'],
    layoutIds: ['authority-builder', 'classic', 'reviews-first', 'quote-first'],
    ctas: { primaryAction: 'book-consult', secondaryAction: 'practice-areas' },
    conversionStyle: 'consult-first',
    contentHints: { tone: 'authoritative', serviceShape: 'practice-areas' }
  }),

  baseRecipe({
    id: 'recipe-coffee-event',
    name: 'Coffee Event',
    compatibleFoundationIds: ['hospitality', 'events'],
    industryHints: ['coffee-event', 'coffee-cart', 'mobile-barista', 'event-coffee', 'coffee'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.PACKAGE_COMPARE, role: 'vehicle-compare' },
      { sectionKey: 'serviceProcess', role: 'booking-process' },
      { sectionKey: MK.CLIENT_LOGOS, role: 'trust' },
      { sectionKey: MK.BOOKING_CTA, role: 'booking' },
      { sectionKey: 'faq', role: 'objections' }
    ],
    sectionOrder: [
      'hero',
      'services',
      'packageCompare',
      'featuredProjects',
      'brandStory',
      'serviceProcess',
      'clientLogos',
      'reviews',
      'faq',
      'bookingCta',
      'quote',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'packageCompare', 'featuredProjects', 'quote', 'faq', 'footer'],
    layoutIds: ['premium-showcase', 'offer-funnel', 'hero-image-slider', 'reviews-first'],
    variants: { hero: 'hero' },
    ctas: { primaryAction: 'book-event', secondaryAction: 'view-packages' },
    conversionStyle: 'book-event',
    contentHints: { tone: 'warm', serviceShape: 'event-packages' }
  }),

  baseRecipe({
    id: 'recipe-cafe',
    name: 'Café',
    compatibleFoundationIds: ['hospitality'],
    industryHints: ['cafe', 'café', 'brunch', 'specialty-coffee'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.INSTAGRAM_FEED, role: 'social' },
      { sectionKey: 'specialOffer', role: 'promo' }
    ],
    sectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'reviews',
      'specialOffer',
      'quote',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'classic', 'reviews-first'],
    ctas: { primaryAction: 'plan-visit', secondaryAction: 'menu' },
    conversionStyle: 'visit-and-order',
    contentHints: { tone: 'warm', serviceShape: 'menu-highlights' }
  }),

  baseRecipe({
    id: 'recipe-restaurant',
    name: 'Restaurant',
    compatibleFoundationIds: ['hospitality'],
    industryHints: ['restaurant', 'dining', 'bistro'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.BOOKING, role: 'conversion' }
    ],
    sectionOrder: ['hero', 'services', 'featuredProjects', 'why', 'reviews', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'reviews-first', 'classic'],
    ctas: { primaryAction: 'reserve', secondaryAction: 'menus' },
    conversionStyle: 'reserve-table',
    contentHints: { tone: 'polished', serviceShape: 'dining' }
  }),

  baseRecipe({
    id: 'recipe-coffee-roaster',
    name: 'Coffee Roaster',
    compatibleFoundationIds: ['hospitality', 'retail'],
    industryHints: ['roaster', 'coffee-roaster', 'wholesale-coffee'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.INSTAGRAM_FEED, role: 'social' }
    ],
    sectionOrder: ['hero', 'featuredProjects', 'services', 'why', 'reviews', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'classic'],
    ctas: { primaryAction: 'order-wholesale', secondaryAction: 'origins' },
    conversionStyle: 'enquire-wholesale',
    contentHints: { tone: 'artisan', serviceShape: 'origins-and-wholesale' }
  }),

  baseRecipe({
    id: 'recipe-luxury-jewellery',
    name: 'Luxury Jewellery',
    compatibleFoundationIds: ['retail'],
    industryHints: ['jewellery', 'jewelry', 'diamond', 'engagement', 'boutique'],
    apps: [
      { sectionKey: MK.PRODUCT_COLLECTION, role: 'collections' },
      { sectionKey: MK.BRAND_STORY, role: 'provenance' },
      { sectionKey: MK.BOOKING_CTA, role: 'appointment' },
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' }
    ],
    sectionOrder: [
      'hero',
      'productCollection',
      'featuredProjects',
      'brandStory',
      'why',
      'reviews',
      'bookingCta',
      'faq',
      'quote',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'productCollection', 'brandStory', 'bookingCta', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'offer-funnel', 'reviews-first', 'hero-image-slider'],
    ctas: { primaryAction: 'private-appointment', secondaryAction: 'collections' },
    conversionStyle: 'appointment-and-browse',
    contentHints: { tone: 'luxury', serviceShape: 'collections' }
  }),

  baseRecipe({
    id: 'recipe-hair-salon',
    name: 'Hair Salon',
    compatibleFoundationIds: ['beauty'],
    industryHints: ['hair', 'hair-salon', 'salon', 'barber', 'stylist'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.INSTAGRAM_FEED, role: 'social' },
      { sectionKey: MK.BOOKING_CTA, role: 'booking' },
      { sectionKey: 'crew', role: 'team' }
    ],
    sectionOrder: [
      'hero',
      'services',
      'featuredProjects',
      'why',
      'crew',
      'reviews',
      'bookingCta',
      'specialOffer',
      'quote',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'bookingCta', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'reviews-first', 'offer-funnel', 'classic'],
    ctas: { primaryAction: 'book-appointment', secondaryAction: 'services' },
    conversionStyle: 'book-appointment',
    contentHints: { tone: 'polished', serviceShape: 'salon-menu' }
  }),

  baseRecipe({
    id: 'recipe-wedding-photographer',
    name: 'Wedding Photographer',
    compatibleFoundationIds: ['creative', 'events'],
    industryHints: ['wedding-photography', 'photographer', 'wedding', 'photography'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'portfolio' },
      { sectionKey: MK.INSTAGRAM_FEED, role: 'social' },
      { sectionKey: MK.BOOKING, role: 'enquire' }
    ],
    sectionOrder: [
      'hero',
      'featuredProjects',
      'services',
      'why',
      'crew',
      'reviews',
      'quote',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'featuredProjects', 'quote', 'footer'],
    layoutIds: ['premium-showcase', 'photo-proof', 'hero-image-slider', 'reviews-first'],
    ctas: { primaryAction: 'check-date', secondaryAction: 'portfolio' },
    conversionStyle: 'enquire-date',
    contentHints: { tone: 'editorial', serviceShape: 'packages' }
  }),

  baseRecipe({
    id: 'recipe-sme-advisory',
    name: 'SME Advisory',
    compatibleFoundationIds: ['professional-services'],
    industryHints: ['accounting', 'advisory', 'bookkeeping', 'tax'],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'credibility' },
      { sectionKey: MK.BOOKING, role: 'conversion' }
    ],
    sectionOrder: ['hero', 'trustBar', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    layoutIds: ['authority-builder', 'classic', 'quote-first'],
    ctas: { primaryAction: 'book-consult', secondaryAction: 'services' },
    conversionStyle: 'consult-first',
    contentHints: { tone: 'calm', serviceShape: 'advisory' }
  }),

  baseRecipe({
    id: 'recipe-event-hire',
    name: 'Event Hire',
    compatibleFoundationIds: ['events'],
    industryHints: ['event-hire', 'marquee', 'party-hire'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'catalogue' },
      { sectionKey: 'specialOffer', role: 'promo' }
    ],
    sectionOrder: [
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
    layoutIds: ['premium-showcase', 'offer-funnel', 'classic'],
    ctas: { primaryAction: 'check-availability', secondaryAction: 'catalogue' },
    conversionStyle: 'request-availability',
    contentHints: { tone: 'celebratory', serviceShape: 'hire-packages' }
  }),

  baseRecipe({
    id: 'recipe-wellness-clinic',
    name: 'Wellness Clinic',
    compatibleFoundationIds: ['health'],
    industryHints: ['wellness', 'physiotherapy', 'dental', 'clinic', 'health'],
    apps: [
      { sectionKey: MK.BOOKING, role: 'booking' },
      { sectionKey: 'crew', role: 'team' }
    ],
    sectionOrder: ['hero', 'services', 'why', 'crew', 'reviews', 'quote', 'faq', 'footer'],
    layoutIds: ['reviews-first', 'classic', 'authority-builder'],
    ctas: { primaryAction: 'book-appointment', secondaryAction: 'services' },
    conversionStyle: 'book-appointment',
    contentHints: { tone: 'reassuring', serviceShape: 'treatments' }
  }),

  baseRecipe({
    id: 'recipe-builder-showcase',
    name: 'Builder Showcase',
    compatibleFoundationIds: ['construction'],
    industryHints: ['construction', 'builder', 'renovation'],
    apps: [
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.BEFORE_AFTER, role: 'proof' },
      { sectionKey: 'serviceProcess', role: 'process' }
    ],
    sectionOrder: [
      'hero',
      'trustBar',
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
    layoutIds: ['hero-image-slider', 'photo-proof', 'premium-showcase', 'ba-hero-slider'],
    ctas: { primaryAction: 'request-quote', secondaryAction: 'projects' },
    conversionStyle: 'quote-project',
    contentHints: { tone: 'solid', serviceShape: 'build-services' }
  }),

  baseRecipe({
    id: 'recipe-landscaping-showcase',
    name: 'Landscaping Showcase',
    compatibleFoundationIds: ['construction'],
    industryHints: ['landscaping', 'garden-design', 'outdoor-living', 'hardscaping'],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'visual-capabilities' },
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.BEFORE_AFTER, role: 'proof' },
      { sectionKey: 'serviceProcess', role: 'process' }
    ],
    sectionOrder: [
      'heroSlider',
      'trustBar',
      'featuredProjects',
      'services',
      'beforeAfter',
      'brandStory',
      'serviceProcess',
      'crew',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'trustBar', 'featuredProjects', 'services', 'quote', 'footer'],
    layoutIds: ['hero-image-slider', 'photo-proof', 'premium-showcase', 'ba-hero-slider'],
    variants: { hero: 'heroSlider' },
    ctas: { primaryAction: 'request-quote', secondaryAction: 'projects' },
    conversionStyle: 'quote-project',
    contentHints: { tone: 'outdoor-premium', serviceShape: 'landscape-services' }
  }),

  baseRecipe({
    id: 'recipe-automotive-workshop',
    name: 'Automotive Workshop',
    compatibleFoundationIds: ['automotive'],
    industryHints: ['automotive', 'mechanic', 'auto-repair', 'workshop'],
    apps: [
      { sectionKey: 'serviceProcess', role: 'process' },
      { sectionKey: MK.BEFORE_AFTER, role: 'proof' },
      { sectionKey: MK.BOOKING_CTA, role: 'booking' }
    ],
    sectionOrder: [
      'hero',
      'services',
      'serviceProcess',
      'beforeAfter',
      'why',
      'reviews',
      'bookingCta',
      'quote',
      'faq',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    layoutIds: ['classic', 'photo-proof', 'authority-builder'],
    ctas: { primaryAction: 'book-service', secondaryAction: 'services' },
    conversionStyle: 'book-service',
    contentHints: { tone: 'practical', serviceShape: 'trade-services' }
  }),

  baseRecipe({
    id: 'recipe-hobby-retail',
    name: 'Hobby & Specialty Retail',
    compatibleFoundationIds: ['retail', '*'],
    industryHints: ['rc', 'hobby', 'retail', 'toys', 'models'],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'proof' },
      { sectionKey: MK.FEATURED_PROJECTS, role: 'gallery' },
      { sectionKey: MK.BOOKING, role: 'conversion' }
    ],
    sectionOrder: [
      'hero',
      'trustBar',
      'services',
      'featuredProjects',
      'why',
      'reviews',
      'quote',
      'faq',
      'footer'
    ],
    requiredSectionKeys: ['hero', 'services', 'quote', 'footer'],
    layoutIds: ['classic', 'photo-proof', 'authority-builder'],
    ctas: { primaryAction: 'plan-visit', secondaryAction: 'services' },
    conversionStyle: 'visit',
    contentHints: { tone: 'enthusiastic-specialty', serviceShape: 'collections' }
  }),

  baseRecipe({
    id: 'recipe-generic-local',
    name: 'Generic Local Business',
    compatibleFoundationIds: ['*'],
    industryHints: [],
    apps: [
      { sectionKey: MK.TRUST_BAR, role: 'proof' },
      { sectionKey: MK.BOOKING, role: 'conversion' }
    ],
    sectionOrder: ['hero', 'services', 'why', 'reviews', 'quote', 'faq', 'footer'],
    layoutIds: ['classic', 'authority-builder', 'reviews-first'],
    ctas: { primaryAction: 'get-in-touch', secondaryAction: 'services' },
    conversionStyle: 'enquire',
    contentHints: { tone: 'clear', serviceShape: 'services' }
  })
]);

module.exports = { RECIPES };
