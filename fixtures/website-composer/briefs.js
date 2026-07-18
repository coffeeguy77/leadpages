'use strict';

/** Website Composer Phase 2 fixtures — six businesses, no shared trade content. */

const BEAN_CULTURE = Object.freeze({
  fixtureId: 'bean-culture',
  businessName: 'Bean Culture',
  industry: 'coffee-event',
  specialisation: 'Mobile specialty coffee carts for weddings and corporate events',
  location: 'Canberra',
  audience: 'Wedding couples, event planners and corporate marketers',
  desiredStyle: 'Warm, artisan, premium hospitality',
  conversionGoal: 'book-event',
  notes: 'Coffee cart and barista bar hire — not a trade business'
});

const PINK_DIAMOND_VAULT = Object.freeze({
  fixtureId: 'pink-diamond-vault',
  businessName: 'Pink Diamond Vault',
  industry: 'jewellery',
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
  specialisation: 'Licensed residential and light commercial electrical',
  location: 'Canberra',
  audience: 'Homeowners and small commercial managers',
  desiredStyle: 'Professional, bold, trustworthy',
  conversionGoal: 'call-and-quote'
});

const COMMERCIAL_LAWYER = Object.freeze({
  fixtureId: 'commercial-lawyer',
  businessName: 'Harbour & Co Legal',
  industry: 'legal',
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
  specialisation: 'Documentary wedding photography',
  location: 'Melbourne',
  audience: 'Engaged couples seeking natural wedding photography',
  desiredStyle: 'Editorial, romantic, documentary',
  conversionGoal: 'check-date'
});

module.exports = {
  BEAN_CULTURE,
  PINK_DIAMOND_VAULT,
  CANBERRA_ELECTRICIAN,
  COMMERCIAL_LAWYER,
  HAIR_SALON,
  WEDDING_PHOTOGRAPHER,
  ALL: [
    BEAN_CULTURE,
    PINK_DIAMOND_VAULT,
    CANBERRA_ELECTRICIAN,
    COMMERCIAL_LAWYER,
    HAIR_SALON,
    WEDDING_PHOTOGRAPHER
  ]
};
