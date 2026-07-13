/**
 * Web Culture premium theme — presentation copy, industry tabs, service pillars.
 * Template strings use {{agencyName}}, {{partnerDisplayName}}, {{primaryRegion}}, {{primarySuburb}}.
 */
const { applyTemplate } = require('./defaults');

const SERVICE_PILLARS = [
  {
    key: 'build',
    icon: 'build',
    title: 'Build',
    summary: 'Professional websites planned around how your business wins customers.',
    detail: 'Structure, messaging and page flow planned before anything is built.',
    serviceKeys: ['new-websites', 'redesigns', 'landing-pages']
  },
  {
    key: 'convert',
    icon: 'convert',
    title: 'Convert',
    summary: 'Forms, bookings and conversion paths that turn visitors into enquiries.',
    detail: 'Every enquiry flows into your LeadPages CRM for faster follow-up.',
    serviceKeys: ['quote-forms', 'booking', 'calculators', 'ecommerce', 'lead-gen']
  },
  {
    key: 'connect',
    icon: 'connect',
    title: 'Connect',
    summary: 'Keep website activity linked to the tools you use every day.',
    detail: 'Hosting, forms, CRM and analytics in one connected platform.',
    serviceKeys: ['crm', 'lead-gen']
  },
  {
    key: 'grow',
    icon: 'grow',
    title: 'Grow',
    summary: 'Visibility, content and practical help after launch.',
    detail: 'Ongoing updates, support and practical guidance after go-live.',
    serviceKeys: ['seo-content', 'care-support', 'branding']
  }
];

const DEMO_TRUST_ITEMS = [
  { icon: 'monitor', label: 'Live website' },
  { icon: 'device', label: 'Mobile responsive' },
  { icon: 'search', label: 'Google indexed' },
  { icon: 'rocket', label: 'Fast loading' },
  { icon: 'cloud', label: 'Built with LeadPages' }
];

const HERO_JOURNEY_STEPS = [
  { icon: 'visitors', label: 'Visitor lands on website' },
  { icon: 'website', label: 'Enquiry submitted' },
  { icon: 'crm', label: 'CRM receives lead' },
  { icon: 'device', label: 'Phone notification appears' },
  { icon: 'check', label: 'Lead marked Contacted' },
  { icon: 'rocket', label: 'Success' }
];

const INDUSTRY_DEMO_FEATURES = {
  trades: ['Quote forms built for trade enquiries', 'Service-area pages for local search', 'Mobile-first layouts for on-site customers'],
  hospitality: ['Menus, bookings and enquiry paths', 'Gallery-led layouts that sell the experience', 'Fast mobile browsing for diners'],
  professional: ['Credibility-focused service pages', 'Clear consultation enquiry flows', 'Polished presentation for professional firms'],
  events: ['Showcase-led pages for venues and hire', 'Enquiry forms that capture event details', 'Mobile browsing for planners on the go'],
  local: ['Local trust signals and service clarity', 'Simple enquiry paths for busy owners', 'Layouts that work on every device']
};

const INDUSTRY_FAQ_SETS = {
  trades: [
    { question: 'Can this trades website be customised?', answer: 'Yes. Layouts, services, imagery and enquiry forms are tailored to your trade, service area and the jobs you want to win.' },
    { question: 'Will it work on mobile for customers on site?', answer: 'Yes. Every demo is designed mobile-first so customers can browse services, call and request quotes from any device.' },
    { question: 'Can quote requests go straight into my CRM?', answer: 'Yes. Enquiry and quote forms connect to LeadPages CRM so new requests are captured in one place.' },
    { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure are part of the ongoing website service.' },
    { question: 'How long does setup take?', answer: 'Most trade websites can be ready for review within two to four weeks once content and approvals are supplied.' }
  ],
  hospitality: [
    { question: 'Can this hospitality design be customised?', answer: 'Yes. Menus, galleries, booking paths and messaging can be shaped around your venue, offer and customer journey.' },
    { question: 'Can I update menus and photos myself?', answer: 'Depending on your configuration, you can manage key content directly or ask your partner to handle updates for you.' },
    { question: 'Will it work on mobile?', answer: 'Yes. Hospitality demos are built for fast mobile browsing because most diners and planners search on their phone.' },
    { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure are part of the ongoing website service.' },
    { question: 'How long does setup take?', answer: 'A standard hospitality website is often ready for review within two to four weeks after content is supplied.' }
  ],
  professional: [
    { question: 'Can this professional services website be customised?', answer: 'Yes. Service pages, credentials, enquiry flows and messaging are tailored to your firm and ideal clients.' },
    { question: 'Can I update content myself after launch?', answer: 'Yes. You can update key content directly or work with your partner for larger changes, depending on your setup.' },
    { question: 'Will it work on mobile?', answer: 'Yes. Professional service websites are tested across desktop, tablet and mobile so prospects can browse with confidence.' },
    { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure are part of the ongoing website service.' },
    { question: 'How long does setup take?', answer: 'Most professional websites can be reviewed within two to four weeks once required content is supplied.' }
  ],
  events: [
    { question: 'Can this events website be customised?', answer: 'Yes. Galleries, packages, availability messaging and enquiry forms can be shaped around your venue or hire business.' },
    { question: 'Can I update packages and photos myself?', answer: 'Yes. You can manage updates directly or ask your partner to handle changes, depending on your account setup.' },
    { question: 'Will it work on mobile?', answer: 'Yes. Event and venue sites are designed for mobile browsing because planners often research on the go.' },
    { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure are part of the ongoing website service.' },
    { question: 'How long does setup take?', answer: 'A standard events website is often ready for review within two to four weeks after content is supplied.' }
  ],
  local: [
    { question: 'Can this design be customised?', answer: 'Yes. Services, imagery, enquiry forms and messaging are tailored to your business and local market.' },
    { question: 'Can I update it myself?', answer: 'Yes. You can manage key content directly or work with your partner for larger updates, depending on your setup.' },
    { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure are part of the ongoing website service.' },
    { question: 'How long does setup take?', answer: 'Most business websites can be ready for review within two to four weeks once content and approvals are supplied.' },
    { question: 'Will it work on mobile?', answer: 'Yes. Every website is designed and tested for desktop, tablet and mobile use.' }
  ]
};

const WEBCULTURE_PROCESS = [
  { step: 1, title: 'Talk', icon: 'talk', description: 'Understand your services, customers and what a strong enquiry looks like.', detail: 'We start by mapping how customers find you, what they need to see, and what a qualified enquiry looks like for your business.' },
  { step: 2, title: 'Plan', icon: 'plan', description: 'Shape structure, messaging and the customer journey before anything is built.', detail: 'Page structure, calls to action and enquiry paths are planned first so the website supports real business goals.' },
  { step: 3, title: 'Build', icon: 'monitor', description: 'Create the website on LeadPages and connect forms, tools and lead capture.', detail: 'Your site is built on LeadPages with forms, CRM connections and the platform tools your business needs from day one.' },
  { step: 4, title: 'Review', icon: 'review', description: 'Walk through the site live, refine details and confirm you are ready to launch.', detail: 'You review the live site on desktop and mobile, refine messaging and confirm everything is ready to go live.' },
  { step: 5, title: 'Launch', icon: 'rocket', description: 'Go live with hosting in place and ongoing local support behind the platform.', detail: 'Launch with hosting, lead capture and CRM in place, backed by local partner support and the LeadPages platform.' }
];

const INDUSTRY_TABS = [
  { key: 'trades', label: 'Trades', match: /trade|construction|plumb|electric|build|tradie/i },
  { key: 'hospitality', label: 'Hospitality', match: /hospitality|cafe|food|restaurant|bar|hotel/i },
  { key: 'professional', label: 'Professional Services', match: /professional|legal|account|consult|medical|dental/i },
  { key: 'events', label: 'Events', match: /event|hire|wedding|venue/i },
  { key: 'local', label: 'Local Services', match: /local|service|clean|garden|retail|tourism|training/i }
];

const LEAD_FLOW_STEPS = [
  { key: 'visitors', label: 'Visitors', sub: 'Google, Social', icon: 'visitors' },
  { key: 'website', label: 'Website', sub: 'Your business online', icon: 'website' },
  { key: 'enquiries', label: 'Enquiry', sub: 'Forms & Bookings', icon: 'enquiries' },
  { key: 'crm', label: 'CRM', sub: 'Lead capture', icon: 'crm' },
  { key: 'customer', label: 'Customer', sub: 'Growth', icon: 'customers' }
];

function templateVars(content) {
  const p = content.partner || {};
  const sa = content.serviceArea || {};
  const areas = sa.areas || [];
  const suburb = sa.primarySuburb || (areas[0] && areas[0].label) || 'your region';
  const region = sa.primaryRegion || suburb || 'your region';
  const agency = (p.agencyName || '').trim();
  const fn = (p.firstName || p.publicName || '').trim();
  return {
    agencyName: agency || p.publicName || 'Your agency',
    partnerDisplayName: p.publicName || fn || 'your partner',
    firstName: fn || 'your partner',
    primaryRegion: region,
    primarySuburb: suburb,
    serviceRegion: sa.headline ? region : region
  };
}

function buildWebcultureCopy(content) {
  const vars = templateVars(content);

  return {
    hero: {
      eyebrow: 'YOUR LOCAL LEADPAGES PARTNER',
      headline: 'Websites that work harder for your business.',
      highlight: 'work harder',
      supporting: applyTemplate(
        'Work directly with {{agencyName}} to create a professional website that builds trust, generates enquiries and grows with your business. Explore real live demos before you commit, then launch on the complete LeadPages platform with local support every step of the way.',
        vars
      ),
      primaryCta: 'Plan My Website',
      secondaryCta: 'Explore Live Demos'
    },
    heroTrust: [
      { icon: 'pin', label: applyTemplate('{{primaryRegion}} Local Support', vars) },
      { icon: 'monitor', label: 'Live Website Demos' },
      { icon: 'cloud', label: 'Powered by LeadPages' }
    ],
    heroResponse: {
      label: 'Average response',
      value: '< 1 Business Day',
      fallback: 'Usually responds within 24 hours'
    },
    heroDashboard: {
      eyebrow: 'LEADPAGES PLATFORM',
      heading: 'Your website and business tools in one place.',
      widgets: [
        { label: 'Website Visitors', hint: 'Track activity' },
        { label: 'New Quote Requests', hint: 'Capture enquiries' },
        { label: 'Conversion Rate', hint: 'View insights' },
        { label: 'CRM Status', hint: 'Connected' },
        { label: 'Recent Lead', hint: 'Ready to follow up' },
        { label: 'Online Status', hint: 'Live', status: 'live' }
      ]
    },
    connected: {
      eyebrow: 'A CONNECTED SYSTEM',
      heading: 'More than a website. Your leads. Your follow-ups. All working together.',
      proofHeading: 'YOU GET',
      proofCards: [
        { icon: 'pin', title: 'Local partner support', body: applyTemplate('{{primaryRegion}} based planning and personal guidance.', vars) },
        { icon: 'monitor', title: 'Live demos before you decide', body: 'Explore industry-specific examples before you commit.' },
        { icon: 'cloud', title: 'Platform-backed reliability', body: 'LeadPages hosting, CRM and infrastructure included.' }
      ],
      transformBefore: [
        'Facebook only',
        'Manual quoting',
        'No SEO',
        'Missed enquiries'
      ],
      transformAfter: [
        'Professional website',
        'Online enquiries',
        'CRM follow-up',
        'Google visibility'
      ]
    },
    demos: {
      eyebrow: 'LIVE WEBSITE DEMOS',
      heading: 'Choose an industry.',
      headingLine2: 'Explore a real website.',
      sub: 'Open a live demo, explore the pages and experience the customer journey.',
      ctaExplore: 'View live demo',
      ctaBuild: 'Build this website'
    },
    faqs: {
      eyebrow: 'COMMON QUESTIONS',
      heading: 'Know what to expect before we begin.',
      expandLabel: 'View all questions',
      featuredCount: 5
    },
    gallery: {
      eyebrow: 'LIVE DEMO GALLERY',
      heading: 'See what we build — hover to preview.',
      openLabel: 'Open live demo'
    },
    services: {
      eyebrow: 'WHAT WE DO',
      heading: 'Websites that do more for your business.'
    },
    partner: {
      eyebrow: 'YOUR LOCAL PARTNER',
      badge: 'LeadPages Certified Partner',
      bookCta: 'Book Consultation',
      callCta: 'Call'
    },
    process: {
      eyebrow: 'THE PROCESS',
      heading: 'Talk → Plan → Build → Review → Launch'
    },
    platform: {
      eyebrow: 'ONE CONNECTED SERVICE',
      heading: 'Personal guidance. Platform-backed delivery.',
      connector: 'Your complete website service',
      agencyItems: ['Strategy', 'Content', 'Local consultation', 'Partnership'],
      platformItems: ['Hosting', 'CRM', 'Updates', 'Technical support']
    },
    testimonials: {
      eyebrow: 'CLIENT EXPERIENCE',
      heading: 'Built around clarity, confidence and support.',
      googleFallback: 'Google Reviews \u00b7 Trusted by local businesses'
    },
    contact: {
      eyebrow: 'GET STARTED',
      heading: applyTemplate('Let\u2019s talk about your business.', vars),
      sub: applyTemplate(
        'Share a little about your business. {{firstName}} will respond within one business day.',
        vars
      ),
      formTitle: 'Let\u2019s talk about your business.',
      formSub: 'Tell us about your business — we respond within one business day.',
      formReassurance: 'No obligation. We\u2019ll recommend the best solution for your business\u2014even if it\u2019s not us.',
      trustItems: [
        { icon: 'pin', label: 'Friendly local support' },
        { icon: 'check', label: 'No obligation' },
        { icon: 'talk', label: 'Usually replies within one business day' }
      ],
      moreLabel: 'Tell us more'
    },
    closingCta: {
      heading: 'Ready for a website that works as hard as you do?',
      sub: 'Let\u2019s build something your customers will remember.',
      button: 'Plan My Website'
    },
    footer: {
      tagline: applyTemplate('Websites. Leads. Growth.', vars),
      localLine: applyTemplate('{{primaryRegion}} Website Designer \u2022 LeadPages Partner \u2022 Local Support', vars),
      poweredLine: applyTemplate('{{agencyName}} websites are powered by LeadPages.', vars)
    },
    nav: [
      { href: '#demos', label: 'Websites' },
      { href: '#services', label: 'Services' },
      { href: '#process', label: 'Process' },
      { href: '#partner', label: 'About' },
      { href: '#contact', label: 'Contact', arrow: true }
    ],
    quoteToast: {
      title: 'New quote request',
      body: 'Kitchen renovation enquiry',
      time: '2 mins ago'
    }
  };
}

function groupServicesByPillar(services) {
  const enabled = (services || []).filter(Boolean);
  const byKey = {};
  enabled.forEach(function(s) { byKey[s.key] = s; });
  return SERVICE_PILLARS.map(function(pillar) {
    const items = pillar.serviceKeys.map(function(k) { return byKey[k]; }).filter(Boolean);
    if (!items.length) return null;
    return {
      key: pillar.key,
      icon: pillar.icon,
      title: pillar.title,
      summary: pillar.summary,
      detail: pillar.detail,
      services: items
    };
  }).filter(Boolean);
}

function matchIndustryTab(industry) {
  const label = String(industry || '').trim();
  if (!label) return 'local';
  for (let i = 0; i < INDUSTRY_TABS.length; i++) {
    if (INDUSTRY_TABS[i].match.test(label)) return INDUSTRY_TABS[i].key;
  }
  return 'local';
}

function groupDemosByIndustryTab(demos) {
  const groups = {};
  INDUSTRY_TABS.forEach(function(tab) { groups[tab.key] = []; });
  (demos || []).forEach(function(d) {
    const key = matchIndustryTab(d.industry);
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });
  const ordered = [];
  INDUSTRY_TABS.forEach(function(tab) {
    if (groups[tab.key] && groups[tab.key].length) {
      ordered.push({ tab: tab, demos: groups[tab.key] });
    }
  });
  if (!ordered.length && demos && demos.length) {
    ordered.push({ tab: INDUSTRY_TABS[INDUSTRY_TABS.length - 1], demos: demos.slice() });
  }
  return ordered;
}

function pickHeroDemos(demos, limit) {
  const max = limit || 5;
  const list = demos || [];
  const featured = list.filter(function(d) { return d.featured; });
  const rest = list.filter(function(d) { return !d.featured; });
  const ordered = featured.concat(rest);
  const seen = {};
  const out = [];
  ordered.forEach(function(d) {
    const key = d.slug || d.url || d.name;
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(d);
  });
  if (out.length) return out.slice(0, max);
  return list.slice(0, max);
}

function pickHeroDemo(demos) {
  const list = pickHeroDemos(demos, 1);
  return list[0] || null;
}

function industryDemoFeatures(tabKey) {
  return INDUSTRY_DEMO_FEATURES[tabKey] || INDUSTRY_DEMO_FEATURES.local;
}

function demoTrustItems() {
  return DEMO_TRUST_ITEMS.slice();
}

function heroJourneySteps() {
  return HERO_JOURNEY_STEPS.slice();
}

function industryFaqsForTab(tabKey) {
  return (INDUSTRY_FAQ_SETS[tabKey] || INDUSTRY_FAQ_SETS.local).slice();
}

function isLogoThumbnail(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  return /logo|favicon|icon|avatar|profile/.test(u) && !/screenshot|showcase|unsplash|photo-|image\/upload.*\/w_\d{3,}/.test(u);
}

module.exports = {
  SERVICE_PILLARS,
  WEBCULTURE_PROCESS,
  INDUSTRY_TABS,
  LEAD_FLOW_STEPS,
  DEMO_TRUST_ITEMS,
  HERO_JOURNEY_STEPS,
  buildWebcultureCopy,
  groupServicesByPillar,
  groupDemosByIndustryTab,
  matchIndustryTab,
  pickHeroDemo,
  pickHeroDemos,
  industryDemoFeatures,
  demoTrustItems,
  heroJourneySteps,
  industryFaqsForTab,
  isLogoThumbnail,
  templateVars
};
