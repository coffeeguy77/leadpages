/**
 * Local Website Co. — presentation copy and fallbacks.
 */
const { applyTemplate } = require('./defaults');

const UNSPLASH = {
  demoTrades: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
  demoElectrical: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=900&q=80',
  demoCafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900&q=80',
  demoProfessional: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900&q=80',
  demoHealth: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=900&q=80',
  demoGarden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
  processChat: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80',
  processBuild: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&q=80',
  processLaunch: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=900&q=80',
  aboutShaun: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&q=80'
};

const FALLBACK_DEMOS = [
  {
    name: 'Flow Pro Plumbing',
    industry: 'Trades',
    tag: 'Trades',
    description: 'A mobile-first plumbing website built for urgent calls and quote requests.',
    image: UNSPLASH.demoTrades,
    url: '#contact',
    colours: ['#1D2B4D', '#F06428', '#f9f7f2', '#7f9c8d']
  },
  {
    name: 'Brightline Electrical',
    industry: 'Trades',
    tag: 'Trades',
    description: 'Clear services, fast contact options and local trust signals for electrical work.',
    image: UNSPLASH.demoElectrical,
    url: '#contact',
    colours: ['#001529', '#f2b84b', '#f9f7f2', '#dfe7ef']
  },
  {
    name: 'Corner Table Cafe',
    industry: 'Hospitality',
    tag: 'Hospitality',
    description: 'A warm venue website with menus, photos and booking-friendly enquiry paths.',
    image: UNSPLASH.demoCafe,
    url: '#contact',
    colours: ['#2e2118', '#e36b21', '#f9f7f2', '#8aa37b']
  },
  {
    name: 'Northside Advisory',
    industry: 'Professional',
    tag: 'Professional',
    description: 'Credibility-led service pages for consultants, brokers and advisory firms.',
    image: UNSPLASH.demoProfessional,
    url: '#contact',
    colours: ['#1D2B4D', '#7d92ad', '#f9f7f2', '#F06428']
  },
  {
    name: 'Glow Skin Studio',
    industry: 'Health & Beauty',
    tag: 'Health & Beauty',
    description: 'A polished service website for consultations, galleries and treatment enquiries.',
    image: UNSPLASH.demoHealth,
    url: '#contact',
    colours: ['#302137', '#F06428', '#f9f7f2', '#d9a7a0']
  },
  {
    name: 'Greenway Garden Care',
    industry: 'Trades',
    tag: 'Trades',
    description: 'A practical local services website with simple quote capture and service areas.',
    image: UNSPLASH.demoGarden,
    url: '#contact',
    colours: ['#16352d', '#e36b21', '#f9f7f2', '#9eb87f']
  }
];

const INDUSTRIES = [
  {
    title: 'Trades & Services',
    body: 'Plumbers, electricians, builders, cleaners, landscapers and local service teams.',
    image: '/assets/partner-templates/localwebsiteco/industry-trades.jpg'
  },
  {
    title: 'Hospitality',
    body: 'Cafes, restaurants, venues and experience-led local businesses.',
    image: '/assets/partner-templates/localwebsiteco/industry-hospitality.jpg'
  },
  {
    title: 'Professional Services',
    body: 'Brokers, consultants, advisors, health providers and office-based businesses.',
    image: '/assets/partner-templates/localwebsiteco/industry-professional.jpg'
  }
];

const FEATURE_CALLOUTS = [
  { side: 'left', title: 'Reviews', text: 'Show trust where customers make decisions.' },
  { side: 'left', title: 'Forms', text: 'Capture enquiries with the right questions.' },
  { side: 'left', title: 'Quotes', text: 'Turn interest into a practical next step.' },
  { side: 'right', title: 'Galleries', text: 'Show your work, venue, team or results.' },
  { side: 'right', title: 'Booking', text: 'Help customers ask for a time or callback.' },
  { side: 'right', title: 'Analytics', text: 'See what is happening after launch.' }
];

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'We talk through the business.',
    body: 'A short website chat covers what you do, who you want to reach, and what the site needs to achieve.',
    image: UNSPLASH.processChat
  },
  {
    number: '02',
    title: 'I shape the pages and build.',
    body: 'Your pages, copy direction, images and enquiry paths are assembled on LeadPages with a clear review path.',
    image: UNSPLASH.processBuild
  },
  {
    number: '03',
    title: 'You go live with support.',
    body: 'Launch with hosting, lead capture and ongoing local help behind your website.',
    image: UNSPLASH.processLaunch
  }
];

const PRICING_PLANS = [
  {
    name: 'Website Launch',
    price: 'From $2,500',
    note: 'For a new or refreshed business website.',
    bullets: ['Planning call', 'Core website pages', 'Lead capture form', 'Mobile-ready build'],
    cta: 'Start with launch'
  },
  {
    name: 'Website Growth',
    badge: 'MOST POPULAR',
    price: 'From $3,500',
    note: 'For businesses that want more pages, content support and stronger enquiry paths.',
    bullets: ['Everything in Launch', 'Service-area structure', 'Demo-inspired design direction', 'Launch support'],
    cta: 'Talk about growth'
  },
  {
    name: 'Something Custom',
    price: 'Scoped after chat',
    note: 'For bookings, quote flows, extra pages or more involved website needs.',
    bullets: ['Custom page planning', 'Advanced forms or sections', 'Platform guidance', 'Clear project quote'],
    cta: 'Scope a custom site'
  }
];

const TRUST_ITEMS = [
  { title: 'Local partner', body: 'A real person to plan with and call.' },
  { title: 'LeadPages hosting', body: 'Secure platform infrastructure behind every site.' },
  { title: 'Lead capture', body: 'Forms and enquiry paths built in from day one.' },
  { title: 'Mobile-first', body: 'Designed for customers searching on their phone.' },
  { title: 'SEO foundations', body: 'Clear services, locations and page structure.' },
  { title: 'Ongoing support', body: 'Help after the site goes live.' }
];

const FAQS = [
  { question: 'Is this just a template?', answer: 'No. The design starts from proven patterns, then the copy, pages, photos and calls to action are shaped around your business.' },
  { question: 'Can I see examples first?', answer: 'Yes. The demo section shows the kind of website direction we can use as a starting point.' },
  { question: 'Will Shaun build the website?', answer: 'You work directly with Shaun as your local website partner. The site is built on the LeadPages platform.' },
  { question: 'Do I need all the content ready?', answer: 'No. It helps to have photos and service details, but the process includes guidance on what is needed.' },
  { question: 'Can my website take enquiries?', answer: 'Yes. Contact, quote and booking-style forms can be included depending on your scope.' },
  { question: 'Can you connect my existing domain?', answer: 'In most cases, yes. We will confirm how your domain is currently managed and guide the connection.' },
  { question: 'What are the ongoing costs?', answer: 'Your proposal will separate the build cost from any ongoing hosting, platform and support fees.' },
  { question: 'What if I need changes later?', answer: 'You can ask Shaun for support, and the site remains backed by LeadPages platform infrastructure.' }
];

function varsFor(content) {
  const p = content.partner || {};
  const sa = content.serviceArea || {};
  const firstName = p.firstName || p.publicName || 'Shaun';
  const headlineRegion = sa.headline ? String(sa.headline).replace(/\.$/, '') : '';
  return {
    agencyName: p.agencyName || 'Local Website Co.',
    firstName: firstName,
    primaryRegion: headlineRegion || sa.primaryRegion || 'Canberra and surrounding regions',
    primarySuburb: sa.primarySuburb || 'Canberra'
  };
}

function demoFromContent(demo, index) {
  const industry = String(demo.industry || 'Local business').trim();
  return {
    name: demo.name || 'Website demo',
    industry: industry,
    tag: industry,
    description: demo.description || 'A practical local business website designed for trust, clarity and enquiries.',
    image: demo.thumbnail || FALLBACK_DEMOS[index % FALLBACK_DEMOS.length].image,
    url: demo.url || '#contact',
    colours: FALLBACK_DEMOS[index % FALLBACK_DEMOS.length].colours
  };
}

function buildLocalWebsiteCoCopy(content) {
  content = content || {};
  const vars = varsFor(content);
  const partner = content.partner || {};
  const contact = content.contact || {};
  const biography = content.biography || {};
  const testimonials = (content.testimonials && content.testimonials.length)
    ? content.testimonials.slice(0, 3)
    : [];
  const demos = (content.demos && content.demos.length)
    ? content.demos.slice(0, 6).map(demoFromContent)
    : [];
  if (demos.length < 6) {
    FALLBACK_DEMOS.slice(demos.length, 6).forEach(function(demo) {
      demos.push(demo);
    });
  }
  const partnerFaqs = (content.faqs || [])
    .filter(function(f) { return f && f.question && f.answer; })
    .slice(0, 8);

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
      supporting: applyTemplate(
        'For local businesses that need a professional website without the agency runaround. Work directly with {{firstName}}, explore real examples, and launch on an Australian platform with ongoing support.',
        vars
      ),
      primaryCta: "Let's build your website",
      secondaryCta: 'See my website demos',
      image: '/assets/partner-templates/localwebsiteco/hero-meeting.jpg',
      chips: ['Website launched', 'New enquiry', 'Local support'],
      trust: [
        'Local one-to-one',
        'Australian platform',
        'Ongoing support',
        applyTemplate('{{primaryRegion}}', vars)
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
      callouts: FEATURE_CALLOUTS
    },
    process: {
      eyebrow: 'HOW IT WORKS',
      heading: 'From first chat to live website.',
      steps: PROCESS_STEPS,
      cta: 'Book a quick website chat'
    },
    about: {
      eyebrow: 'ABOUT YOUR PARTNER',
      heading: applyTemplate("Your local website partner. Hi, I'm {{firstName}}.", vars),
      body: biography.fullBio || applyTemplate("I help local businesses plan and launch better websites without making the process complicated. You get direct support from {{firstName}}, backed by LeadPages technology behind the scenes.", vars),
      image: partner.headshotUrl || UNSPLASH.aboutShaun,
      icons: ['One-to-one guidance', 'Plain-English advice', 'Local business focus', 'LeadPages backed'],
      callLabel: 'Call',
      emailLabel: 'Email'
    },
    pricing: {
      eyebrow: 'PRICING',
      heading: 'A clear way to get online.',
      sub: 'Start with a practical scope, then choose the level of support your business actually needs.',
      plans: PRICING_PLANS
    },
    testimonials: {
      eyebrow: 'LOCAL EXPERIENCE',
      heading: 'What business owners value.',
      items: testimonials.length ? testimonials : [
        { text: 'The whole process felt straightforward. We knew what was being built and how customers would contact us.', customerName: 'Local business owner', businessName: 'Canberra service business' },
        { text: 'It gave us a more professional way to show our services and made enquiries easier to manage.', customerName: 'Small business client', businessName: 'Local services' },
        { text: 'We liked having local guidance with the confidence of a proper platform behind the website.', customerName: 'Professional services client', businessName: 'Canberra region' }
      ]
    },
    trust: {
      eyebrow: 'WHY IT WORKS',
      heading: 'Local service. Serious technology behind it.',
      items: TRUST_ITEMS,
      powered: 'Powered by LeadPages: hosting, CRM-ready lead capture, analytics, platform updates and technical support behind your local partner.'
    },
    faqs: {
      eyebrow: 'FAQ',
      heading: 'Questions before we chat?',
      items: partnerFaqs.length ? partnerFaqs : FAQS
    },
    contact: {
      eyebrow: 'START HERE',
      heading: 'Tell me what you need your website to do.',
      sub: applyTemplate('{{firstName}} will reply with the next practical step for your business.', vars),
      formTitle: 'Start the conversation',
      formSub: 'A few details is enough to start. No pressure, no jargon.',
      image: partner.headshotUrl || UNSPLASH.aboutShaun,
      phone: contact.phone || '',
      email: contact.email || ''
    },
    footer: {
      tagline: applyTemplate('Local websites from {{agencyName}}, powered by LeadPages.', vars),
      privacy: '/privacy-policy.html',
      terms: '/terms-of-use.html'
    }
  };
}

module.exports = {
  buildLocalWebsiteCoCopy,
  FALLBACK_DEMOS,
  UNSPLASH
};
