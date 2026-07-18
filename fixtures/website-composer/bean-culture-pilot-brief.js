'use strict';

/**
 * Bean Culture Coffee Roastery — Phase 6 pilot brief TEMPLATE.
 *
 * This is the recommended content a superuser enters through the Website Studio UI.
 * Tests use this shape to validate composition/leakage — they must not inject it
 * directly into a live site config outside the Composer → application path.
 *
 * Pilot creates a NEW draft site. Does not replace the existing Bean Culture website.
 */

module.exports = Object.freeze({
  fixtureId: 'bean-culture-pilot',
  pilot: true,
  mustNotModifyExistingSlug: 'beanculture',
  businessName: 'Bean Culture',
  industry: 'coffee-event',
  businessType: 'event-hospitality',
  specialisation:
    'Mobile specialty coffee cart, coffee van and coffee caravan hire for weddings, corporate events, private celebrations and branded activations across Canberra and surrounding areas',
  location: 'Canberra',
  serviceAreas: ['Canberra', 'Queanbeyan', 'Yass', 'Goulburn', 'South Coast (by arrangement)'],
  yearsOperating: 'Established Canberra specialty coffee business',
  shortDescription:
    'Bean Culture brings café-quality specialty coffee to events with cart, van and caravan options staffed by trained baristas.',
  mainServices: [
    'Coffee cart hire',
    'Coffee van hire',
    'Coffee caravan hire',
    'Corporate event coffee',
    'Wedding coffee service',
    'Private event barista bars',
    'Branded activations'
  ],
  packages: [
    { name: 'Coffee cart', note: 'Confirm inclusions with operator' },
    { name: 'Coffee van', note: 'Confirm inclusions with operator' },
    { name: 'Coffee caravan', note: 'Confirm inclusions with operator' }
  ],
  primaryOffer: 'Event coffee hire with specialty barista service',
  differentiators: [
    'Specialty coffee focus',
    'Multiple vehicle formats',
    'Corporate and wedding experience',
    'Canberra-based'
  ],
  pricingDisplayPreference: 'enquiry',
  promotions: [],
  faqs: [],
  process: ['Enquire', 'Confirm event details', 'Match cart/van/caravan', 'Serve on the day'],
  audience: 'Wedding couples, event planners, corporate marketers and private hosts',
  customerProblems: ['Need café-quality coffee on site', 'Want a branded hospitality moment'],
  buyingPriorities: ['Reliability', 'Presentation', 'Coffee quality', 'Local Canberra coverage'],
  tone: 'Warm, artisan, premium hospitality',
  geographicFocus: 'Canberra and surrounding regions',
  conversionGoal: 'book-event',
  secondaryConversionGoal: 'enquire',
  phoneCta: true,
  formCta: true,
  bookingCta: true,
  desiredStyle: 'Warm, artisan, premium hospitality',
  notes:
    'Pilot brief — do not invent awards, prices, client logos or testimonials. Mark unconfirmed claims. No trade/plumbing content.',
  contactPlaceholders: {
    businessEmail: 'ENTER_REAL_BUSINESS_EMAIL',
    leadRecipientEmail: 'ENTER_TEST_RECIPIENT_EMAIL',
    phone: 'ENTER_REAL_PHONE'
  },
  contentRequiringConfirmation: [
    'Exact package inclusions and pricing',
    'Named client logos',
    'Testimonials',
    'Years in business wording',
    'Service area edge cases'
  ]
});
