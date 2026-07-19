'use strict';

const { normalizeToken } = require('./foundations');

/**
 * Business classification profiles used before foundation/recipe selection.
 * Deterministic keyword mapping — Brain can refine later.
 */
const PROFILES = Object.freeze([
  {
    id: 'coffee-event',
    label: 'Coffee / event hospitality',
    match: [/coffee\s*cart/, /coffee\s*event/, /mobile\s*barista/, /event\s*coffee/, /\bbean\s*culture\b/],
    industry: 'coffee-event',
    preferredFoundationId: 'hospitality',
    preferredRecipeId: 'recipe-coffee-event'
  },
  {
    id: 'cafe',
    label: 'Café',
    match: [/\bcafe\b/, /\bcafé\b/, /specialty\s*coffee/, /brunch/],
    industry: 'cafe',
    preferredFoundationId: 'hospitality',
    preferredRecipeId: 'recipe-cafe'
  },
  {
    id: 'jewellery',
    label: 'Jewellery retail',
    match: [/jewell?ery/, /diamond/, /engagement\s*ring/],
    industry: 'jewellery',
    preferredFoundationId: 'retail',
    preferredRecipeId: 'recipe-luxury-jewellery'
  },
  {
    id: 'electrician',
    label: 'Electrician / electrical trade',
    match: [/electric/, /\bhvac\b/],
    industry: 'electrical',
    preferredFoundationId: 'trades',
    preferredRecipeId: 'recipe-field-trade'
  },
  {
    id: 'commercial-lawyer',
    label: 'Commercial legal',
    match: [/lawyer/, /\blegal\b/, /solicitor/, /commercial\s*law/, /\blaw\b/],
    industry: 'legal',
    preferredFoundationId: 'professional-services',
    preferredRecipeId: 'recipe-commercial-legal'
  },
  {
    id: 'hair-salon',
    label: 'Hair salon / beauty',
    match: [/hair\s*salon/, /\bsalon\b/, /\bbarber\b/, /\bhair\b/, /\bbeauty\b/],
    industry: 'hair-salon',
    preferredFoundationId: 'beauty',
    preferredRecipeId: 'recipe-hair-salon'
  },
  {
    id: 'wedding-photographer',
    label: 'Wedding photography',
    match: [/wedding\s*photo/, /photographer/, /\bphotography\b/],
    industry: 'wedding-photography',
    preferredFoundationId: 'creative',
    preferredRecipeId: 'recipe-wedding-photographer'
  },
  {
    id: 'security-trade',
    label: 'Security trade',
    match: [/\bsecurity\b/],
    industry: 'security',
    preferredFoundationId: 'trades',
    preferredRecipeId: 'recipe-field-trade'
  },
  {
    id: 'accounting',
    label: 'Accounting advisory',
    match: [/account/, /bookkeep/, /\btax\b/, /advisory/],
    industry: 'accounting',
    preferredFoundationId: 'professional-services',
    preferredRecipeId: 'recipe-sme-advisory'
  },
  {
    id: 'event-hire',
    label: 'Event hire',
    match: [/event[- ]?hire/, /marquee/, /party\s*hire/],
    industry: 'event-hire',
    preferredFoundationId: 'events',
    preferredRecipeId: 'recipe-event-hire'
  },
  {
    id: 'landscaping',
    label: 'Landscaping',
    match: [/landscap/, /garden\s*design/, /outdoor\s*living/, /hardscap/, /retaining\s*wall/],
    industry: 'landscaping',
    preferredFoundationId: 'construction',
    preferredRecipeId: 'recipe-landscaping-showcase'
  },
  {
    id: 'consultant',
    label: 'Professional consultant',
    match: [/consult/, /strategy/, /operations\s*advisory/],
    industry: 'consulting',
    preferredFoundationId: 'professional-services',
    preferredRecipeId: 'recipe-sme-advisory'
  },
  {
    // Must rank above automotive — "RC Car Shop" must not become a workshop.
    id: 'hobby-retail',
    label: 'Hobby / specialty retail',
    match: [
      /\brc\b/,
      /remote[- ]?control/,
      /hobby\s*(shop|store|retail)/,
      /model\s*(car|shop|store)/,
      /scale\s*model/,
      /toy\s*(shop|store)/,
      /games?\s*(shop|store)/
    ],
    industry: 'hobby-retail',
    preferredFoundationId: 'retail',
    preferredRecipeId: 'recipe-hobby-retail'
  },
  {
    id: 'automotive',
    label: 'Automotive workshop',
    // Avoid bare \bcar\b — it steals hobby/retail names like "RC Car Shop".
    match: [
      /automotive/,
      /mechanic/,
      /auto\s*repair/,
      /car\s*(service|workshop|servicing|mechanic)/,
      /panel\s*beat/,
      /vehicle\s*(repair|service)/
    ],
    industry: 'automotive',
    preferredFoundationId: 'automotive',
    preferredRecipeId: 'recipe-automotive-workshop'
  }
]);

/**
 * @param {object} brief
 * @returns {{
 *   profileId: string,
 *   label: string,
 *   industry: string,
 *   specialisation: string,
 *   preferredFoundationId: string|null,
 *   preferredRecipeId: string|null,
 *   confidence: number,
 *   signals: string[]
 * }}
 */
function classifyBusiness(brief) {
  const b = brief || {};
  const hay = [b.businessName, b.industry, b.specialisation, b.notes, b.audience, b.desiredStyle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let best = null;
  let bestScore = -1;
  const signals = [];

  for (const profile of PROFILES) {
    let score = 0;
    for (const re of profile.match) {
      if (re.test(hay)) {
        score += 50;
        signals.push(profile.id + ':' + re.source);
      }
    }
    const ind = normalizeToken(b.industry);
    if (ind && (ind === normalizeToken(profile.industry) || ind.includes(normalizeToken(profile.industry)))) {
      score += 40;
      signals.push(profile.id + ':industry');
    }
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }

  if (!best || bestScore <= 0) {
    return {
      profileId: 'generic',
      label: 'General local business',
      industry: String(b.industry || 'general').trim() || 'general',
      specialisation: String(b.specialisation || b.industry || '').trim(),
      preferredFoundationId: null,
      preferredRecipeId: 'recipe-generic-local',
      confidence: 0.2,
      signals: ['fallback_generic']
    };
  }

  return {
    profileId: best.id,
    label: best.label,
    industry: best.industry,
    specialisation: String(b.specialisation || best.label).trim(),
    preferredFoundationId: best.preferredFoundationId,
    preferredRecipeId: best.preferredRecipeId,
    confidence: Math.min(0.95, 0.35 + bestScore / 100),
    signals
  };
}

module.exports = {
  classifyBusiness,
  PROFILES
};
