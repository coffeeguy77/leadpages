/**
 * Cause House theme — presentation copy, service categories, and process steps.
 * Used only by the Cause House partner template renderer.
 */

const SERVICE_CATEGORIES = [
  {
    num: '01',
    key: 'build',
    heading: 'Build',
    summary: 'Professional websites planned around how your business wins customers.',
    serviceKeys: ['new-websites', 'redesigns', 'landing-pages']
  },
  {
    num: '02',
    key: 'convert',
    heading: 'Convert',
    summary: 'Turn visitors into enquiries, bookings and qualified leads.',
    serviceKeys: ['quote-forms', 'booking', 'calculators', 'ecommerce']
  },
  {
    num: '03',
    key: 'connect',
    heading: 'Connect',
    summary: 'Keep website activity linked to the systems you use every day.',
    serviceKeys: ['crm', 'lead-gen']
  },
  {
    num: '04',
    key: 'grow',
    heading: 'Grow',
    summary: 'Support visibility, content and practical help after launch.',
    serviceKeys: ['seo-content', 'care-support', 'branding']
  }
];

const CAUSEHOUSE_PROCESS = [
  { step: 1, title: 'Learn the business', description: 'Understand your services, customers and what a strong enquiry looks like for you.' },
  { step: 2, title: 'Plan the website', description: 'Shape the structure, messaging and customer journey before anything is built.' },
  { step: 3, title: 'Build and connect', description: 'Create the website on LeadPages and connect forms, tools and lead capture.' },
  { step: 4, title: 'Review together', description: 'Walk through the site live, refine the details and confirm you are ready to launch.' },
  { step: 5, title: 'Launch and support', description: 'Go live with hosting in place and ongoing local support behind the platform.' }
];

const DEFAULT_SECTION_COPY = {
  proof: {
    statement: 'Local website guidance, backed by a complete digital platform.',
    items: [
      { label: 'Direct partner support', value: 'Personal contact' },
      { label: 'Live demos before committing', value: 'See it first' },
      { label: 'Hosting, CRM and infrastructure included', value: 'One connected system' }
    ]
  },
  value: {
    eyebrow: 'MORE THAN A WEBSITE',
    heading: 'A clearer way to turn interest into action.',
    body: [
      'A successful website should help customers understand your business, trust what you offer and know what to do next.',
      'Your local partner combines personal planning and support with the LeadPages platform — giving your business a professional website and the connected tools needed to capture and manage new opportunities.'
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
    sub: 'We work with businesses that need customers to understand their value, compare their services and feel confident making contact.'
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
    headingPrefix: 'Work directly with'
  },
  serviceArea: {
    eyebrow: 'CANBERRA AND SURROUNDING REGION',
    sub: 'Based in Mitchell and working with businesses across Canberra, the ACT and surrounding NSW. In-person and remote consultations are available.'
  },
  platform: {
    eyebrow: 'ONE CONNECTED SERVICE',
    heading: 'Personal guidance. Platform-backed delivery.',
    agencyItems: ['Strategy', 'Content direction', 'Website planning', 'Customer relationship', 'Local support'],
    platformItems: ['Website platform', 'Hosting and security', 'CRM and lead capture', 'Backups', 'Central technical support']
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
    headingPrefix: 'Tell us what your business needs to achieve.',
    sub: 'Share a little about your business, your current website and what you would like to improve. We will review the details and respond within one business day.',
    formTitle: 'Plan your website',
    formSub: 'Start with the essentials — add more detail if you would like.',
    moreLabel: 'Tell us a little more'
  },
  closingCta: {
    eyebrow: 'GET STARTED',
    heading: 'Ready to build a website that works harder for your business?'
  },
  nav: [
    { href: '#services', label: 'Websites' },
    { href: '#demos', label: 'Live demos' },
    { href: '#process', label: 'How it works' },
    { href: '#partner', label: 'About' },
    { href: '#faqs', label: 'FAQs' }
  ]
};

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

module.exports = {
  SERVICE_CATEGORIES,
  CAUSEHOUSE_PROCESS,
  DEFAULT_SECTION_COPY,
  groupServicesByCategory,
  splitParagraphs
};
