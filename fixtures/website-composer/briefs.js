'use strict';

/** Website Composer fixtures — ten businesses, no shared trade content leakage. */

const BEAN_CULTURE = Object.freeze({
  fixtureId: 'bean-culture',
  businessName: 'Bean Culture',
  industry: 'coffee-event',
  businessType: 'event-hospitality',
  specialisation: 'Mobile specialty coffee carts for weddings and corporate events',
  location: 'Canberra',
  audience: 'Wedding couples, event planners and corporate marketers',
  desiredStyle: 'Warm, artisan, premium hospitality',
  conversionGoal: 'book-event',
  secondaryConversionGoal: 'enquire',
  notes: 'Coffee cart and barista bar hire — not a trade business'
});

const PINK_DIAMOND_VAULT = Object.freeze({
  fixtureId: 'pink-diamond-vault',
  businessName: 'Pink Diamond Vault',
  industry: 'jewellery',
  businessType: 'luxury-retail',
  specialisation: 'Pink diamonds, engagement rings and premium jewellery',
  location: 'Canberra',
  audience: 'Affluent couples, engagement-ring buyers and premium jewellery collectors',
  desiredStyle: 'Luxury, elegant, editorial, feminine, modern and high-end',
  conversionGoal: 'book-private-appointment'
});

const CANBERRA_ELECTRICIAN = Object.freeze({
  fixtureId: 'canberra-electrician',
  businessName: 'Canberra Electrician Co',
  industry: 'electrical',
  businessType: 'trade',
  specialisation: 'Licensed residential and light commercial electrical',
  location: 'Canberra',
  serviceAreas: ['Canberra', 'Queanbeyan', 'Gungahlin'],
  audience: 'Homeowners and small commercial managers',
  desiredStyle: 'Professional, bold, trustworthy',
  conversionGoal: 'call-and-quote',
  certifications: ['Licensed electrician', 'Fully insured']
});

const COMMERCIAL_LAWYER = Object.freeze({
  fixtureId: 'commercial-lawyer',
  businessName: 'Harbour & Co Legal',
  industry: 'legal',
  businessType: 'professional-services',
  specialisation: 'Commercial law for growing Australian businesses',
  location: 'Sydney',
  audience: 'Founders and SME operators',
  desiredStyle: 'Calm, credible, authoritative',
  conversionGoal: 'book-consultation'
});

const HAIR_SALON = Object.freeze({
  fixtureId: 'hair-salon',
  businessName: 'Northside Hair Atelier',
  industry: 'hair-salon',
  businessType: 'beauty',
  specialisation: 'Cut, colour and occasion styling',
  location: 'Brisbane',
  audience: 'Locals seeking polished salon care',
  desiredStyle: 'Warm, polished, modern',
  conversionGoal: 'book-appointment'
});

const WEDDING_PHOTOGRAPHER = Object.freeze({
  fixtureId: 'wedding-photographer',
  businessName: 'Amberlight Weddings',
  industry: 'wedding-photography',
  businessType: 'creative',
  specialisation: 'Documentary wedding photography',
  location: 'Melbourne',
  audience: 'Engaged couples seeking natural wedding photography',
  desiredStyle: 'Editorial, romantic, documentary',
  conversionGoal: 'check-date'
});

const RIVERSONG_CAFE = Object.freeze({
  fixtureId: 'riversong-cafe',
  businessName: 'Riversong Café',
  industry: 'cafe',
  businessType: 'hospitality',
  specialisation: 'Specialty coffee and seasonal brunch',
  location: 'Hobart',
  audience: 'Locals and visitors seeking a warm café stop',
  desiredStyle: 'Warm, inviting, artisan',
  conversionGoal: 'plan-visit'
});

const GREENLINE_LANDSCAPING = Object.freeze({
  fixtureId: 'greenline-landscaping',
  businessName: 'Greenline Landscapes',
  industry: 'landscaping',
  businessType: 'outdoor-trade',
  specialisation: 'Residential landscaping and outdoor living',
  location: 'Adelaide',
  audience: 'Homeowners upgrading gardens and outdoor spaces',
  desiredStyle: 'Natural, practical, premium outdoor',
  conversionGoal: 'request-quote',
  notes: 'Landscaping — not plumbing'
});

const NORTHSIDE_CONSULTANT = Object.freeze({
  fixtureId: 'northside-consultant',
  businessName: 'Northside Advisory',
  industry: 'consulting',
  businessType: 'professional-services',
  specialisation: 'SME strategy and operations consulting',
  location: 'Melbourne',
  audience: 'Founders and operators of growing SMEs',
  desiredStyle: 'Calm, clear, professional',
  conversionGoal: 'book-consultation'
});

const PITLANE_AUTOMOTIVE = Object.freeze({
  fixtureId: 'pitlane-automotive',
  businessName: 'Pitlane Workshop',
  industry: 'automotive',
  businessType: 'automotive',
  specialisation: 'Servicing, diagnostics and performance maintenance',
  location: 'Geelong',
  audience: 'Drivers who want honest workshop advice',
  desiredStyle: 'Bold, practical, trustworthy',
  conversionGoal: 'book-service'
});

module.exports = {
  BEAN_CULTURE,
  PINK_DIAMOND_VAULT,
  CANBERRA_ELECTRICIAN,
  COMMERCIAL_LAWYER,
  HAIR_SALON,
  WEDDING_PHOTOGRAPHER,
  RIVERSONG_CAFE,
  GREENLINE_LANDSCAPING,
  NORTHSIDE_CONSULTANT,
  PITLANE_AUTOMOTIVE,
  ALL: [
    BEAN_CULTURE,
    PINK_DIAMOND_VAULT,
    CANBERRA_ELECTRICIAN,
    COMMERCIAL_LAWYER,
    HAIR_SALON,
    WEDDING_PHOTOGRAPHER,
    RIVERSONG_CAFE,
    GREENLINE_LANDSCAPING,
    NORTHSIDE_CONSULTANT,
    PITLANE_AUTOMOTIVE
  ]
};
