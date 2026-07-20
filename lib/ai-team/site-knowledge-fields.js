'use strict';

/**
 * Site Knowledge field guide — approved business truth (not page copy).
 *
 * Site Knowledge stores facts the business has approved.
 * Echo owns generated website copy. Forge owns configuration.
 * Do not treat generated copy as permanent Site Knowledge.
 */

const SITE_KNOWLEDGE_FIELDS = Object.freeze([
  {
    key: 'businessName',
    label: 'Business name',
    kind: 'business_fact',
    question: 'What is the business name customers should see?',
    help: 'The trading name on the website — usually what people search for or see on your van, invoice, or shopfront.',
    explain:
      'This is simply the name of the business. Use the name customers already know you by. Example: “Bean Culture” not a long legal company name unless that is how you brand yourself.',
    examples: ['Bean Culture', 'Luke’s Security', 'Canberra Hot Water'],
    multiline: false,
    brainPath: 'business.name'
  },
  {
    key: 'industry',
    label: 'Industry',
    kind: 'business_fact',
    question: 'What kind of business is this?',
    help: 'A short plain description of the trade or industry (not a slogan).',
    explain:
      'Industry means the type of work you do. Think “what would you say if a stranger asked what your business does?” Keep it simple — one short phrase.',
    examples: ['Café / specialty coffee', 'Security systems', 'Architectural 3D rendering'],
    multiline: false,
    brainPath: 'business.industry'
  },
  {
    key: 'mainServices',
    label: 'Main services',
    kind: 'business_fact',
    question: 'What are the main things you sell or do for customers?',
    help: 'List the top services or offers, one per line. These shape homepage and SEO advice.',
    explain:
      'Services are the jobs or products people hire you for. Write them the way a customer would say them. One service per line. You can edit this list any time. This is business truth — Echo may later turn it into public copy.',
    examples: ['Commercial renders', 'Emergency lockouts', 'Espresso coffee & brunch'],
    multiline: true,
    brainPath: 'offers.mainServices'
  },
  {
    key: 'targetAudience',
    label: 'Target audience',
    kind: 'business_fact',
    question: 'Who are you mainly trying to attract?',
    help: 'The kind of customer you want more of — not “everyone”.',
    explain:
      'Your target audience is the people most likely to buy. Be specific: homeowners, builders, offices, tourists, etc. “Anyone” is too vague for good website advice.',
    examples: ['Canberra homeowners', 'Commercial builders', 'Office workers near Civic'],
    multiline: false,
    brainPath: 'audience.primary'
  },
  {
    key: 'primaryGoal',
    label: 'Primary goal',
    kind: 'business_fact',
    question: 'What is the main result you want this website to achieve?',
    help: 'One clear outcome (more enquiries, bookings, quotes, foot traffic).',
    explain:
      'A primary goal is the #1 job of the website. Pick one main outcome so the AI Team knows what “better” means. You can still care about other things — this is just the priority.',
    examples: [
      'Get more quote requests each week',
      'Book more tables for weekend brunch',
      'Win more commercial rendering jobs'
    ],
    multiline: false,
    brainPath: 'goals.primary'
  },
  {
    key: 'serviceAreas',
    label: 'Service areas',
    kind: 'business_fact',
    question: 'Where do you serve customers?',
    help: 'Suburbs, cities, or regions you cover — one per line.',
    explain:
      'Service areas are the places you actually work. This helps local SEO and keeps the site from promising areas you do not cover.',
    examples: ['Canberra', 'Queanbeyan', 'Belconnen'],
    multiline: true,
    brainPath: 'locations.serviceAreas'
  },
  {
    key: 'preferredCta',
    label: 'Preferred call to action (CTA)',
    kind: 'business_fact',
    question: 'What should the main button on your website say?',
    help: 'The short action phrase visitors should take — approved business intent, not final page copy.',
    explain:
      'CTA means “call to action” — the next step you want visitors to take. Avoid vague lines like “Contact us” or “Learn more”. Use something specific that matches your goal, e.g. “Get a free quote” or “Book a table”. Site Knowledge stores this as approved business truth; Forge applies it; Echo may polish surrounding copy later.',
    examples: ['Get a free quote', 'Book a table', 'Request a site visit', 'Order online'],
    multiline: false,
    brainPath: 'goals.preferredCta'
  },
  {
    key: 'brandTone',
    label: 'Brand tone',
    kind: 'business_fact',
    question: 'How should the website sound when it talks to customers?',
    help: 'A few words describing the voice — friendly, premium, no-nonsense, etc.',
    explain:
      'Brand tone is the personality of your writing. Imagine how you want to sound on the phone with a new customer, then write that down in a few words. Echo uses this when generating copy — it is not the copy itself.',
    examples: ['Warm and local', 'Premium and precise', 'Straight-talking and reliable'],
    multiline: false,
    brainPath: 'brand.tone'
  },
  {
    key: 'contentRestrictions',
    label: 'Content restrictions',
    kind: 'business_fact',
    question: 'Is there anything the website must never say or claim?',
    help: 'Optional. Things to avoid — competitor names, guarantees you cannot keep, banned phrases.',
    explain:
      'Restrictions are guardrails. If there are claims you are not allowed to make (or words you hate), list them here so the AI Team does not suggest them.',
    examples: ['No competitor names', 'Do not promise same-day if we cannot deliver', 'No medical claims'],
    multiline: true,
    brainPath: 'content.restrictions'
  }
]);

function getField(key) {
  return SITE_KNOWLEDGE_FIELDS.find((f) => f.key === String(key || '')) || null;
}

function fieldKeyFromBrainPath(path) {
  const p = String(path || '');
  const hit = SITE_KNOWLEDGE_FIELDS.find((f) => f.brainPath === p);
  return hit ? hit.key : null;
}

module.exports = {
  SITE_KNOWLEDGE_FIELDS,
  getField,
  fieldKeyFromBrainPath
};
