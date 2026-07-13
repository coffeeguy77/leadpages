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
    serviceKeys: ['new-websites', 'redesigns', 'landing-pages']
  },
  {
    key: 'convert',
    icon: 'convert',
    title: 'Convert',
    summary: 'Forms, bookings and conversion paths that turn visitors into enquiries.',
    serviceKeys: ['quote-forms', 'booking', 'calculators', 'ecommerce', 'lead-gen']
  },
  {
    key: 'connect',
    icon: 'connect',
    title: 'Connect',
    summary: 'Keep website activity linked to the tools you use every day.',
    serviceKeys: ['crm', 'lead-gen']
  },
  {
    key: 'grow',
    icon: 'grow',
    title: 'Grow',
    summary: 'Visibility, content and practical help after launch.',
    serviceKeys: ['seo-content', 'care-support', 'branding']
  }
];

const WEBCULTURE_PROCESS = [
  { step: 1, title: 'Talk', icon: 'talk', description: 'Understand your services, customers and what a strong enquiry looks like.' },
  { step: 2, title: 'Plan', icon: 'plan', description: 'Shape structure, messaging and the customer journey before anything is built.' },
  { step: 3, title: 'Build', icon: 'monitor', description: 'Create the website on LeadPages and connect forms, tools and lead capture.' },
  { step: 4, title: 'Review', icon: 'review', description: 'Walk through the site live, refine details and confirm you are ready to launch.' },
  { step: 5, title: 'Launch', icon: 'rocket', description: 'Go live with hosting in place and ongoing local support behind the platform.' }
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
  { key: 'website', label: 'Your Website', sub: '', icon: 'website' },
  { key: 'enquiries', label: 'Enquiries', sub: 'Forms & Bookings', icon: 'enquiries' },
  { key: 'crm', label: 'CRM & Follow-up', sub: '', icon: 'crm' }
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
      { label: applyTemplate('{{primaryRegion}}-Based Partner', vars) },
      { label: 'Explore Live Websites' },
      { label: 'Powered by LeadPages' }
    ],
    heroBenefits: {
      eyebrow: 'BUILT INTO EVERY LEADPAGES WEBSITE',
      heading: 'Tracking, analytics and conversion tools included.',
      items: [
        {
          icon: 'search',
          title: 'Built-in analytics',
          body: 'See which pages, services and calls-to-action drive the most enquiries.'
        },
        {
          icon: 'globe',
          title: 'Visitor tracking',
          body: 'Understand where your traffic comes from and what customers do before they contact you.'
        },
        {
          icon: 'enquiries',
          title: 'Lead capture & CRM',
          body: 'Every form submission and booking flows straight into your LeadPages CRM.'
        },
        {
          icon: 'convert',
          title: 'Conversion insights',
          body: 'Measure calls, forms and bookings so you know what is actually working.'
        }
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
      badge: 'LeadPages Certified Partner'
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
      heading: 'Built around clarity, confidence and support.'
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
  buildWebcultureCopy,
  groupServicesByPillar,
  groupDemosByIndustryTab,
  matchIndustryTab,
  pickHeroDemo,
  pickHeroDemos,
  isLogoThumbnail,
  templateVars
};
