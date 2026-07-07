/**
 * Marketplace catalog category mapping (shared by seed + content build).
 */
const CATEGORIES = [
  { slug: 'heroes-layout', name: 'Heroes & Layout', blurb: 'Hero sections, sliders, navigation and trust strips.', sort_order: 10 },
  { slug: 'core-content', name: 'Core Content', blurb: 'Services, reviews, FAQs and lead capture — the backbone of every trade site.', sort_order: 20 },
  { slug: 'social-proof', name: 'Social Proof', blurb: 'Live feeds, portfolios, timelines and team sections that prove you are busy.', sort_order: 30 },
  { slug: 'trust-conversion', name: 'Trust & Conversion', blurb: 'Credentials, offers, stats and emergency messaging that close the sale.', sort_order: 40 },
  { slug: 'social-instagram', name: 'Social & Instagram', blurb: 'Instagram grids and project feeds connected to your clients social accounts.', sort_order: 50 }
];

const SECTION_CATEGORY = {
  hero: 'heroes-layout',
  heroSlider: 'heroes-layout',
  heroBeforeAfter: 'heroes-layout',
  splitHero: 'heroes-layout',
  navMenu: 'heroes-layout',
  textBox: 'heroes-layout',
  trustBar: 'heroes-layout',
  services: 'core-content',
  why: 'core-content',
  area: 'core-content',
  faq: 'core-content',
  quote: 'core-content',
  reviews: 'core-content',
  reviewHighlights: 'core-content',
  proofStream: 'social-proof',
  projectFeed: 'social-proof',
  jobsFeed: 'social-proof',
  beforeAfter: 'social-proof',
  beforeAfterFeed: 'social-proof',
  videoReels: 'social-proof',
  activityTimeline: 'social-proof',
  customerReactions: 'social-proof',
  activityCounter: 'social-proof',
  crew: 'social-proof',
  featuredProjects: 'social-proof',
  certifications: 'trust-conversion',
  finance: 'trust-conversion',
  estimateBuilder: 'trust-conversion',
  emergencyAvailability: 'trust-conversion',
  serviceProcess: 'trust-conversion',
  projectStats: 'trust-conversion',
  responseCards: 'trust-conversion',
  serviceAreas: 'trust-conversion',
  serviceAreaMap: 'trust-conversion',
  specialOffer: 'trust-conversion',
  instaGallery: 'social-instagram',
  igProjectFeed: 'social-instagram'
};

function categoryForSection(sectionKey) {
  return SECTION_CATEGORY[sectionKey] || 'core-content';
}

module.exports = {
  CATEGORIES,
  SECTION_CATEGORY,
  categoryForSection
};
