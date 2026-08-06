/**
 * Local Website Co. — presentation copy (partners1.png).
 */
const { applyTemplate } = require('./defaults');

const LOCAL_ASSETS = '/assets/partner-templates/localwebsiteco';

const UNSPLASH = {
  demoTrades: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80',
  demoElectrical: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=1200&q=80',
  demoGarden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
  demoCafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80',
  demoProfessional: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&q=80',
  demoHealth: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1200&q=80',
  processChat: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80',
  processBuild: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80',
  processLaunch: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&q=80',
  // Bundled photographic fallbacks — never use SVG upload/cloud placeholders on the public page.
  aboutShaun: LOCAL_ASSETS + '/about-shaun.jpg',
  trustPhoto: LOCAL_ASSETS + '/tech-strip.jpg',
  contactPhoto: LOCAL_ASSETS + '/contact-meeting.jpg'
};

const DEFAULT_TESTIMONIALS = [
  {
    text: 'The whole process felt straightforward. We knew what was being built and how customers would contact us.',
    customerName: 'Luke',
    businessName: 'Flow Pro Plumbing'
  },
  {
    text: 'It gave us a more professional way to show the venue and made enquiries easier to manage.',
    customerName: 'Megan',
    businessName: 'Harvest Café'
  },
  {
    text: 'We liked having local guidance with the confidence of a proper platform behind the website.',
    customerName: 'David',
    businessName: 'Clear Path Consulting'
  }
];

/* Match LWC gallery tabs / curated industries only — not arbitrary partner trades like "Builder". */
const LWC_DEMO_INDUSTRY_RE = /^(trades|hospitality|professional|health(\s*&\s*beauty)?|plumbing|electrical|landscaping|consulting)\b/i;

/**
 * Accept only photographic partner images for LWC portrait slots.
 * Reject SVG / cloud-upload placeholders that would render as giant icons.
 */
function photographicUrl(url, fallback) {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower.indexOf('.svg') !== -1) return fallback;
  if (lower.indexOf('image/svg') !== -1) return fallback;
  if (lower.indexOf('placeholder') !== -1) return fallback;
  if (lower.indexOf('upload-icon') !== -1) return fallback;
  if (lower.indexOf('cloud-arrow') !== -1) return fallback;
  if (!/^https?:\/\//i.test(trimmed) && trimmed.charAt(0) !== '/') return fallback;
  return trimmed;
}

const FALLBACK_DEMOS = [
  {
    name: 'Flow Pro Plumbing',
    industry: 'Trades',
    tag: 'Plumbing',
    description: 'Urgent-call CTAs, suburb coverage and quote capture for a busy local plumber.',
    image: UNSPLASH.demoTrades,
    url: '#contact',
    colours: ['#1D2B4D', '#F06428', '#f9f7f2', '#7f9c8d']
  },
  {
    name: 'Brightline Electrical',
    industry: 'Trades',
    tag: 'Electrical',
    description: 'Clear services, fast contact options and local trust signals for electrical work.',
    image: UNSPLASH.demoElectrical,
    url: '#contact',
    colours: ['#001529', '#f2b84b', '#f9f7f2', '#dfe7ef']
  },
  {
    name: 'Green Space Landscapes',
    industry: 'Trades',
    tag: 'Landscaping',
    description: 'Project galleries and simple enquiry paths for outdoor living work.',
    image: UNSPLASH.demoGarden,
    url: '#contact',
    colours: ['#16352d', '#e36b21', '#f9f7f2', '#9eb87f']
  },
  {
    name: 'Harvest Café',
    industry: 'Hospitality',
    tag: 'Hospitality',
    description: 'Warm venue storytelling with menus, photos and booking-friendly enquiry paths.',
    image: UNSPLASH.demoCafe,
    url: '#contact',
    colours: ['#2e2118', '#e36b21', '#f9f7f2', '#8aa37b']
  },
  {
    name: 'Clear Path Consulting',
    industry: 'Professional',
    tag: 'Consulting',
    description: 'Credibility-led service pages for consultants who need trust and clear next steps.',
    image: UNSPLASH.demoProfessional,
    url: '#contact',
    colours: ['#1D2B4D', '#7d92ad', '#f9f7f2', '#F06428']
  },
  {
    name: 'Bloom Beauty Studio',
    industry: 'Health & Beauty',
    tag: 'Health & Beauty',
    description: 'Treatment menus, gallery proof and consultation enquiries for a beauty studio.',
    image: UNSPLASH.demoHealth,
    url: '#contact',
    colours: ['#302137', '#F06428', '#f9f7f2', '#d9a7a0']
  }
];

const INDUSTRIES = [
  {
    title: 'Trades & Services',
    body: 'Plumbers, electricians, builders, cleaners and local service teams.',
    image: '/assets/partner-templates/localwebsiteco/industry-trades.jpg'
  },
  {
    title: 'Hospitality',
    body: 'Cafes, restaurants, venues and experience-led local businesses.',
    image: '/assets/partner-templates/localwebsiteco/industry-hospitality.jpg'
  },
  {
    title: 'Professional Services',
    body: 'Brokers, consultants, advisors and office-based businesses.',
    image: '/assets/partner-templates/localwebsiteco/industry-professional.jpg'
  }
];

const FEATURE_CALLOUTS = [
  { side: 'left', title: 'Look professional', text: 'A clear site that matches the quality of your work.' },
  { side: 'left', title: 'Always open', text: 'Customers can learn what you do and reach you any time.' },
  { side: 'left', title: 'Get found locally', text: 'Suburb and service pages that help nearby customers find you.' },
  { side: 'right', title: 'Understand what’s working', text: 'Simple analytics so you can see what customers respond to.' },
  { side: 'right', title: 'Turn visitors into enquiries', text: 'Strong calls to action so people know what to do next.' },
  { side: 'right', title: 'Get help from a real person', text: 'Local support when you need changes or advice.' }
];

const FEATURE_PINS = ['Reviews', 'Forms', 'Galleries', 'Quotes', 'Booking', 'Analytics'];

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Tell me about your business',
    body: 'A short chat about what you do, who you serve and what the website needs to achieve.',
    image: UNSPLASH.processChat
  },
  {
    number: '02',
    title: 'I build and tailor your website',
    body: 'Pages, messaging, photos and enquiry paths are shaped around your business on LeadPages.',
    image: UNSPLASH.processBuild
  },
  {
    number: '03',
    title: 'Launch, grow and stay supported',
    body: 'Go live with hosting, lead capture and ongoing local help when you need it.',
    image: UNSPLASH.processLaunch,
    floatChip: { label: 'New enquiry', kind: 'mail' }
  }
];

const PRICING_PLANS = [
  {
    name: 'Website Launch',
    audience: 'For a new or refreshed business website.',
    price: 'From $2,500',
    note: 'Setup scoped before work begins.',
    bullets: ['Planning call', 'Core website pages', 'Lead capture form', 'Mobile-ready build'],
    cta: 'Start with launch'
  },
  {
    name: 'Website Growth',
    badge: 'MOST POPULAR',
    audience: 'For businesses that want stronger enquiry paths and more pages.',
    price: 'From $3,500',
    note: 'Includes launch support and clearer local structure.',
    bullets: ['Everything in Launch', 'Service-area structure', 'Demo-inspired design direction', 'Launch support'],
    cta: 'Grow my business'
  },
  {
    name: 'Something Custom',
    audience: 'For bookings, quote flows or more involved website needs.',
    price: 'Scoped after chat',
    note: 'Clear quote after we understand the brief.',
    bullets: ['Custom page planning', 'Advanced forms or sections', 'Platform guidance', 'Clear project quote'],
    cta: "Let's talk"
  }
];

const TRUST_ITEMS = [
  { title: 'Reliable hosting' },
  { title: 'Mobile-ready websites' },
  { title: 'Secure SSL' },
  { title: 'Practical business apps' },
  { title: 'Platform updates' },
  { title: 'Australian team' }
];

const FAQS = [
  {
    question: 'How much does a website cost?',
    answer: 'A standard website launch starts with a clear scope and quote. The final cost depends on pages, content, features and how much support you need.'
  },
  {
    question: 'Can I update the website later?',
    answer: 'Yes. You can ask for changes after launch, and the site stays backed by LeadPages hosting and platform tools.'
  },
  {
    question: 'How long does it take?',
    answer: 'Most local business websites can be ready for review within two to four weeks once the key content, photos and approvals are available.'
  },
  {
    question: 'What ongoing support do I receive?',
    answer: 'You keep local partner support for practical changes, plus LeadPages hosting, updates and platform tools behind the site.'
  },
  {
    question: 'Can you use my existing domain?',
    answer: 'Yes. Your existing domain can usually be connected to the new website. I will help confirm the best way to manage the changeover.'
  },
  {
    question: 'Can you build for my industry?',
    answer: 'Yes. The demos cover trades, hospitality, professional services and health & beauty — and we can shape a direction for other local industries too.'
  }
];

function varsFor(content) {
  const p = content.partner || {};
  const sa = content.serviceArea || {};
  const firstName = p.firstName || p.publicName || 'Shaun';
  const headlineRaw = sa.headline ? String(sa.headline).replace(/\.$/, '').trim() : '';
  // Only treat short place-like headlines as a region (avoid marketing copy).
  const headlineRegion = (headlineRaw
    && headlineRaw.length <= 48
    && !/website|digital|design|platform|support/i.test(headlineRaw))
    ? headlineRaw
    : '';
  return {
    agencyName: p.agencyName || 'Local Website Co.',
    firstName: firstName,
    primaryRegion: headlineRegion || sa.primaryRegion || 'Canberra and surrounding regions',
    primarySuburb: sa.primarySuburb || 'Canberra'
  };
}

function demoFromContent(demo, index) {
  const industry = String(demo.industry || 'Local business').trim();
  const fallback = FALLBACK_DEMOS[index % FALLBACK_DEMOS.length];
  return {
    name: demo.name || fallback.name,
    industry: industry,
    tag: industry,
    description: demo.description || fallback.description,
    image: photographicUrl(demo.thumbnail, fallback.image),
    url: demo.url || '#contact',
    colours: fallback.colours
  };
}

function demosForGallery(content) {
  // Curated Flow Pro / Brightline / … set is the LWC design default.
  // Partner live demos replace it only when they clearly match LWC industry tabs
  // (or the profile explicitly opts in via meta.lwcUsePartnerDemos).
  const optIn = !!(content.meta && content.meta.lwcUsePartnerDemos);
  const partnerDemos = (content.demos || []).map(demoFromContent);
  const matching = partnerDemos.filter(function(d) {
    return LWC_DEMO_INDUSTRY_RE.test(String(d.industry || '') + ' ' + String(d.name || ''));
  });
  if (optIn && partnerDemos.length) {
    const out = partnerDemos.slice(0, 6);
    FALLBACK_DEMOS.slice(out.length, 6).forEach(function(d) { out.push(d); });
    return out;
  }
  if (matching.length >= 3) {
    const out = matching.slice(0, 6);
    FALLBACK_DEMOS.slice(out.length, 6).forEach(function(d) { out.push(d); });
    return out;
  }
  return FALLBACK_DEMOS.slice();
}

function testimonialsForGallery(content) {
  const items = (content.testimonials && content.testimonials.length)
    ? content.testimonials.slice(0, 3).map(function(item) {
      return {
        text: item.text || item.quote || '',
        customerName: item.customerName || item.name || 'Local business owner',
        businessName: item.businessName || item.business || item.location || 'Local business'
      };
    })
    : [];
  const out = items.slice();
  while (out.length < 3) {
    out.push(DEFAULT_TESTIMONIALS[out.length]);
  }
  return out;
}

function buildLocalWebsiteCoCopy(content) {
  content = content || {};
  const vars = varsFor(content);
  const partner = content.partner || {};
  const contact = content.contact || {};
  const biography = content.biography || {};
  const testimonials = testimonialsForGallery(content);
  const demos = demosForGallery(content);
  const partnerFaqs = (content.faqs || [])
    .filter(function(f) { return f && f.question && f.answer; })
    .slice(0, 6);
  // REPLACE_POINT: partner.headshotUrl — portrait slot only when it is a real photograph (not SVG upload art).
  const aboutPhoto = photographicUrl(partner.headshotUrl, UNSPLASH.aboutShaun);
  // Tech strip + final CTA use dedicated scene photography (not the upload/cloud headshot SVG).
  const trustPhoto = UNSPLASH.trustPhoto;
  const contactPhoto = UNSPLASH.contactPhoto;

  return {
    nav: [
      { href: '#websites', label: 'Websites' },
      { href: '#process', label: 'How it works' },
      { href: '#about', label: applyTemplate('About {{firstName}}', vars) },
      { href: '#pricing', label: 'Pricing' },
      { href: '#contact', label: 'Contact' }
    ],
    powered: 'Websites powered by LeadPages',
    hero: {
      eyebrow: 'LOCAL WEBSITES • REAL SUPPORT',
      headline: 'A better website, built by someone who knows your business.',
      headlineHtml: 'A better website,\nbuilt by someone\nwho knows your\nbusiness.',
      supporting: applyTemplate(
        'I help local businesses look professional online — without the agency runaround. Work directly with {{firstName}}, explore real examples, and launch on an Australian platform with ongoing support.',
        vars
      ),
      primaryCta: "Let's build your website",
      secondaryCta: 'See my website demos',
      image: '/assets/partner-templates/localwebsiteco/hero-meeting.jpg',
      chips: [
        { label: 'Website launched', kind: 'success' },
        { label: 'New enquiry', kind: 'mail' },
        { label: 'Local support', kind: 'support' }
      ],
      trust: [
        'Local one-to-one service',
        'Australian platform',
        'Ongoing support',
        applyTemplate('Helping businesses across {{primaryRegion}}', vars)
      ]
    },
    industries: {
      eyebrow: 'WHO I HELP',
      heading: 'Websites for real local businesses.',
      sub: 'Clear, practical websites for businesses that need to look credible and make it easy for customers to take action.',
      cards: INDUSTRIES
    },
    demos: {
      eyebrow: 'LIVE EXAMPLES',
      heading: 'See what your website could look like.',
      sub: 'Choose a direction, explore the style, then we shape the final website around your business.',
      tabs: ['All', 'Trades', 'Hospitality', 'Professional', 'Health & Beauty'],
      cards: demos,
      missingLine: "Can't see your industry? Ask me for an example."
    },
    features: {
      eyebrow: 'WHAT IS INCLUDED',
      heading: 'More than a good-looking website.',
      sub: 'Your website can connect the practical pieces a local business needs: enquiries, trust, forms, photos and simple follow-up.',
      callouts: FEATURE_CALLOUTS,
      pins: FEATURE_PINS
    },
    process: {
      eyebrow: 'HOW IT WORKS',
      heading: 'From first chat to live website.',
      steps: PROCESS_STEPS,
      cta: 'Book a quick website chat'
    },
    about: {
      eyebrow: 'ABOUT YOUR WEBSITE PARTNER',
      heading: applyTemplate("Your local website partner. Hi, I'm {{firstName}}.", vars),
      headingHtml: applyTemplate("Your local website partner.\nHi, I'm {{firstName}}.", vars),
      body: biography.fullBio || applyTemplate(
        "Hi, I'm {{firstName}}. I work with Canberra and surrounding-region businesses that need a better website, clearer enquiries, and practical support from a real person.\n\nInstead of sending you through layers of account managers, I help plan the pages, explain the options, and build your website on the LeadPages platform so your site has serious technology behind it.",
        vars
      ),
      image: aboutPhoto,
      icons: ['Local knowledge', 'Plain-English advice', 'Personal service', 'Backed by LeadPages'],
      callLabel: applyTemplate('Call {{firstName}}', vars),
      emailLabel: applyTemplate('Email {{firstName}}', vars)
    },
    pricing: {
      eyebrow: 'PRICING',
      heading: 'A clear way to get online.',
      sub: 'Scope and pricing are confirmed before work begins — so you know what you are getting.',
      plans: PRICING_PLANS
    },
    testimonials: {
      eyebrow: 'LOCAL EXPERIENCE',
      heading: 'What local businesses say.',
      items: testimonials
    },
    trust: {
      eyebrow: 'WHY IT WORKS',
      heading: 'Local service. Serious technology behind it.',
      items: TRUST_ITEMS,
      powered: 'Hosting, CRM-ready lead capture, analytics, platform updates and technical support sit behind your local partner.',
      image: trustPhoto
    },
    faqs: {
      eyebrow: 'FAQ',
      heading: 'Questions before we chat?',
      items: partnerFaqs.length >= 6 ? partnerFaqs : FAQS
    },
    contact: {
      eyebrow: 'START HERE',
      heading: "Let's build a website your business can grow with.",
      headingHtml: "Let's build a website\nyour business can\ngrow with.",
      sub: applyTemplate('{{firstName}} will reply with the next practical step for your business.', vars),
      formTitle: 'Start the conversation',
      formSub: 'A few details is enough to start. No pressure, no jargon.',
      image: contactPhoto,
      phone: contact.phone || '',
      email: contact.email || ''
    },
    footer: {
      tagline: applyTemplate('Local websites from {{agencyName}}, powered by LeadPages.', vars),
      location: applyTemplate('{{primarySuburb}} and surrounding regions, Australia', vars),
      privacy: '/privacy-policy.html',
      terms: '/terms-of-use.html'
    }
  };
}

module.exports = {
  buildLocalWebsiteCoCopy,
  FALLBACK_DEMOS,
  FEATURE_PINS,
  UNSPLASH
};
