/**
 * Cause House theme — presentation copy, service categories, and process steps.
 * Template strings use {{agencyName}}, {{partnerDisplayName}}, {{primaryRegion}}, {{primarySuburb}}.
 */
const { applyTemplate } = require('./defaults');

const SERVICE_CATEGORIES = [
  {
    num: '01',
    key: 'build',
    heading: 'Build your presence',
    summary: 'Professional websites planned around how your business wins customers.',
    serviceKeys: ['new-websites', 'redesigns', 'landing-pages']
  },
  {
    num: '02',
    key: 'convert',
    heading: 'Turn visitors into enquiries',
    summary: 'Forms, bookings and conversion paths that help visitors take the next step.',
    serviceKeys: ['quote-forms', 'booking', 'calculators', 'ecommerce']
  },
  {
    num: '03',
    key: 'connect',
    heading: 'Connect your customer journey',
    summary: 'Keep website activity linked to the tools you use every day.',
    serviceKeys: ['crm', 'lead-gen']
  },
  {
    num: '04',
    key: 'grow',
    heading: 'Grow with ongoing support',
    summary: 'Visibility, content and practical help after launch.',
    serviceKeys: ['seo-content', 'care-support', 'branding']
  }
];

const CAUSEHOUSE_PROCESS = [
  { step: 1, title: 'Learn the business', description: 'Understand your services, customers and what a strong enquiry looks like for you.', outcome: 'Clear understanding of goals and priorities.' },
  { step: 2, title: 'Plan the website', description: 'Shape the structure, messaging and customer journey before anything is built.', outcome: 'Agreed structure, content direction and scope.' },
  { step: 3, title: 'Build and connect', description: 'Create the website on LeadPages and connect forms, tools and lead capture.', outcome: 'A working website connected to your systems.' },
  { step: 4, title: 'Review together', description: 'Walk through the site live, refine the details and confirm you are ready to launch.', outcome: 'Confidence in the finished experience.' },
  { step: 5, title: 'Launch and support', description: 'Go live with hosting in place and ongoing local support behind the platform.', outcome: 'A live website with support in place.' }
];

const INDUSTRY_GROUPS = [
  { title: 'Trades and construction', note: 'Clear services, proof and enquiry paths for hands-on local work.' },
  { title: 'Hospitality and events', note: 'Menus, bookings, atmosphere and offers presented with confidence.' },
  { title: 'Professional services', note: 'Credibility, expertise and a polished first impression online.' },
  { title: 'Local service businesses', note: 'Service areas, trust signals and straightforward ways to enquire.' },
  { title: 'Retail and tourism', note: 'Product, location and experience presented for browsing customers.' },
  { title: 'Training and education', note: 'Programs, outcomes and next steps explained clearly.' }
];

function templateVars(content) {
  const p = content.partner || {};
  const sa = content.serviceArea || {};
  const areas = sa.areas || [];
  const canberraArea = areas.find(function(a) { return /canberra/i.test(a.label); });
  const mitchellArea = areas.find(function(a) { return /mitchell/i.test(a.label); });
  const suburb = (mitchellArea && mitchellArea.label) || sa.primarySuburb || (areas[0] && areas[0].label) || 'your region';
  const region = (canberraArea && canberraArea.label) || sa.primaryRegion || suburb || 'your region';
  const fn = (p.firstName || p.publicName || '').trim();
  return {
    agencyName: (p.agencyName || '').trim() || p.publicName || 'Your agency',
    partnerDisplayName: p.publicName || fn || 'your partner',
    firstName: fn || 'your partner',
    primaryRegion: region,
    primarySuburb: suburb,
    serviceRegion: region
  };
}

function buildCausehouseCopy(content) {
  const vars = templateVars(content);
  const pos = content.positioning || {};
  const sa = content.serviceArea || {};
  const regionLabel = sa.primaryRegion || vars.primaryRegion;

  return {
    proof: {
      statement: 'Local website guidance, backed by a complete digital platform.',
      items: [
        { label: 'Local strategy', value: 'Personal planning and support' },
        { label: 'Live demos', value: 'See the direction before you commit' },
        { label: 'Connected platform', value: 'Hosting, CRM and infrastructure included' }
      ]
    },
    heroTrust: [
      { label: regionLabel + '-based partner' },
      { label: 'Explore live demos first' },
      { label: 'Powered and supported by LeadPages' }
    ],
    value: {
      eyebrow: 'MORE THAN A WEBSITE',
      heading: 'A clearer way to turn interest into action.',
      body: [
        'A successful website should help customers understand your business, trust what you offer and know what to do next.',
        pos.platformBackingStatement || applyTemplate(
          '{{agencyName}} combines local planning and personal support with the LeadPages platform — giving your business a professional website and the connected tools needed to capture and manage new opportunities.',
          vars
        )
      ],
      cards: [
        { title: 'Built around your business', body: 'Your pages, services and enquiry path are planned around how your actual customers make decisions.' },
        { title: 'See it before you commit', body: 'Explore live examples and agree on the direction before the website is launched.' },
        { title: 'Leads stay connected', body: 'Forms and enquiries can flow into the LeadPages CRM instead of becoming disconnected inbox messages.' },
        { title: 'Support continues after launch', body: 'Work with a local partner while LeadPages provides the platform and central technical infrastructure.' }
      ]
    },
    industries: {
      eyebrow: 'WHO WE HELP',
      heading: 'Built for local businesses that rely on trust.',
      sub: applyTemplate(
        '{{agencyName}} works best with businesses that rely on local reputation, professional presentation and a steady flow of customer enquiries.',
        vars
      )
    },
    demos: {
      eyebrow: 'LIVE WEBSITE DEMOS',
      heading: 'See what your new website could become.',
      sub: 'Open a live demo, explore the pages and experience the customer journey before deciding what is right for your business.'
    },
    services: {
      eyebrow: 'CONNECTED WEBSITE SERVICES',
      heading: 'Everything needed to build, convert and grow.'
    },
    process: {
      eyebrow: 'A PRACTICAL BUILD PROCESS',
      heading: 'From first conversation to confident launch.'
    },
    partner: {
      eyebrow: 'YOUR LOCAL PARTNER',
      heading: (content.partner && content.partner.publicIntro && content.partner.publicIntro.agencyHeading)
        || vars.agencyName
        || 'Work directly with your local LeadPages Partner',
      roleLine: (content.partner && content.partner.publicIntro && content.partner.publicIntro.contactLine)
        || applyTemplate('Work directly with {{firstName}}.', vars)
    },
    serviceArea: {
      eyebrow: applyTemplate('{{primaryRegion}} AND SURROUNDING REGION', vars).toUpperCase(),
      heading: applyTemplate('Serving {{primaryRegion}} and the surrounding region.', vars),
      sub: applyTemplate(
        'Based in {{primarySuburb}}, {{agencyName}} works with businesses across {{primaryRegion}}, Queanbeyan and surrounding ACT and NSW regions. In-person and remote consultations are available.',
        vars
      ),
      baseLabel: applyTemplate('Base location: {{primarySuburb}}', vars)
    },
    platform: {
      eyebrow: 'ONE CONNECTED SERVICE',
      heading: 'Personal guidance. Platform-backed delivery.',
      connector: 'One connected website service',
      agencyItems: [
        'Strategy and planning',
        'Content direction',
        'Website presentation',
        'Local consultation',
        'Ongoing client relationship'
      ],
      platformItems: [
        'Website platform',
        'Hosting and security',
        'Forms and CRM',
        'Backups',
        'Technical infrastructure',
        'Central support'
      ]
    },
    testimonials: {
      eyebrow: 'CLIENT EXPERIENCE',
      heading: 'Built around clarity, confidence and support.',
      platformLabel: 'LeadPages platform client',
      partnerLabel: 'Partner client'
    },
    faqs: {
      eyebrow: 'COMMON QUESTIONS',
      heading: 'Know what to expect before we begin.',
      expandLabel: 'View all questions',
      featuredCount: 6
    },
    contact: {
      eyebrow: 'START A CONVERSATION',
      heading: applyTemplate('Tell us what your business needs to achieve.', vars),
      sub: applyTemplate(
        'Share a little about your business, your current website and what you would like to improve. {{firstName}} will review the details and respond within one business day.',
        vars
      ),
      formTitle: 'Plan your website',
      formSub: 'Start with the essentials — add more detail if you would like.',
      moreLabel: 'Tell us a little more'
    },
    closingCta: {
      eyebrow: 'GET STARTED',
      heading: 'Ready for a website that works harder for your business?'
    },
    footer: {
      tagline: applyTemplate('{{primaryRegion}} website strategy, design and connected business systems.', vars),
      poweredLine: applyTemplate('{{agencyName}} websites are powered by LeadPages.', vars)
    },
    nav: [
      { href: '#services', label: 'Websites' },
      { href: '#demos', label: 'Live demos' },
      { href: '#process', label: 'How it works' },
      { href: '#partner', label: 'About' },
      { href: '#faqs', label: 'FAQs' }
    ]
  };
}

function groupServicesByCategory(services) {
  const enabled = (services || []).filter(Boolean);
  const byKey = {};
  enabled.forEach(function(s) { byKey[s.key] = s; });
  return SERVICE_CATEGORIES.map(function(cat) {
    const items = cat.serviceKeys.map(function(k) { return byKey[k]; }).filter(Boolean);
    if (!items.length) return null;
    return {
      num: cat.num,
      key: cat.key,
      heading: cat.heading,
      summary: cat.summary,
      services: items
    };
  }).filter(Boolean);
}

function splitParagraphs(text) {
  if (!text) return [];
  return String(text).split(/\n\s*\n/).map(function(p) { return p.trim(); }).filter(Boolean);
}

function isLogoThumbnail(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  return /logo|favicon|icon|avatar|profile/.test(u) && !/screenshot|showcase|unsplash|photo-|image\/upload.*\/w_\d{3,}/.test(u);
}

module.exports = {
  SERVICE_CATEGORIES,
  CAUSEHOUSE_PROCESS,
  INDUSTRY_GROUPS,
  buildCausehouseCopy,
  groupServicesByCategory,
  splitParagraphs,
  isLogoThumbnail
};
