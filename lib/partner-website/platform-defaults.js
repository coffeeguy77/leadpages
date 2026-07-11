/**
 * Platform-controlled Partner Website defaults — services, FAQs, process, fallback testimonials.
 */

const PLATFORM_SERVICES = [
  { key: 'new-websites', name: 'New business websites', description: 'Professional websites built for local trades and service businesses.', featured: true },
  { key: 'redesigns', name: 'Website redesigns', description: 'Refresh outdated sites with modern design and better conversion paths.' },
  { key: 'landing-pages', name: 'Landing pages', description: 'Focused pages designed to turn visitors into enquiries.' },
  { key: 'lead-gen', name: 'Local lead-generation websites', description: 'Sites engineered to capture phone calls and form submissions.', featured: true },
  { key: 'ecommerce', name: 'Ecommerce', description: 'Sell products online with secure checkout and inventory-friendly layouts.' },
  { key: 'booking', name: 'Booking websites', description: 'Let customers book appointments or request callbacks online.' },
  { key: 'quote-forms', name: 'Quote forms', description: 'Online quote wizards that qualify leads before they reach you.', featured: true },
  { key: 'crm', name: 'CRM integrations', description: 'Connect enquiries to your CRM or inbox workflow.' },
  { key: 'calculators', name: 'Online calculators', description: 'Interactive pricing and planning tools for complex services.' },
  { key: 'seo-content', name: 'SEO content', description: 'Search-friendly structure and content guidance for local visibility.' },
  { key: 'care-support', name: 'Website care and support', description: 'Ongoing updates, fixes, and partner support after launch.' },
  { key: 'branding', name: 'Branding and content assistance', description: 'Help shaping your message, imagery, and page structure.' }
];

const PLATFORM_FAQS = [
  { key: 'pricing', question: 'How much does a website cost?', answer: 'Pricing depends on scope — number of pages, features, and integrations. Your local partner will provide a clear quote after understanding your business. Many projects start with a live demo walkthrough so you know what you are getting.', locked: true },
  { key: 'timeframe', question: 'How long does a website take to build?', answer: 'Typical projects launch in days to a few weeks depending on content readiness and complexity. Your partner will give you a realistic timeline during your first conversation.', locked: true },
  { key: 'hosting', question: 'Is hosting included?', answer: 'Yes — every LeadPages website includes secure hosting on the LeadPages platform. Your partner handles setup; LeadPages manages the infrastructure.', locked: true },
  { key: 'domain', question: 'Can I use my own domain?', answer: 'Yes. Your partner can connect your existing domain or help you register one. Your LeadPages address also works as a backup.', locked: true },
  { key: 'ownership', question: 'Who owns the website?', answer: 'Your business owns its content and account. The website runs on LeadPages infrastructure with your partner as your local contact.', locked: true },
  { key: 'updates', question: 'Can I update the site myself?', answer: 'Yes. LeadPages includes an editor your partner can train you on. Your partner remains available for larger changes and strategy.', locked: true },
  { key: 'support', question: 'Who do I contact for support?', answer: 'Your local LeadPages partner is your first contact for website changes and strategy. LeadPages provides platform-level hosting, security, and technical infrastructure behind every site.', locked: true },
  { key: 'partner-availability', question: 'What if my partner is unavailable?', answer: 'Your business account and website remain on the LeadPages platform. Accounts can be reassigned to another partner or supported centrally according to platform policies — your data stays with your business.', locked: true },
  { key: 'ongoing-fees', question: 'Are there ongoing fees?', answer: 'Hosting and platform access are billed on a plan basis. Your partner will explain build costs and monthly hosting before you commit.', locked: true },
  { key: 'seo', question: 'Will my site rank on Google?', answer: 'Sites are built with local SEO fundamentals — mobile performance, clear structure, and search-friendly pages. Ongoing rankings depend on competition, content, and your market.', locked: false },
  { key: 'ecommerce-faq', question: 'Can you build an online shop?', answer: 'Yes — ecommerce and product sales can be included where appropriate. Your partner will recommend the right approach for your business.', locked: false },
  { key: 'cancellation', question: 'What happens if I cancel?', answer: 'Cancellation terms depend on your hosting plan and agreement. Your partner and LeadPages support can explain options before you sign up.', locked: true }
];

const PLATFORM_PROCESS = [
  { step: 1, title: 'Discovery', description: 'We learn about your business, customers, and goals — what a great enquiry looks like for you.' },
  { step: 2, title: 'Content and direction', description: 'We shape your messaging, structure, and design direction so the site reflects your business properly.' },
  { step: 3, title: 'Website build', description: 'Your site is built on LeadPages — fast, mobile-first, with the features your business needs.' },
  { step: 4, title: 'Review and refinements', description: 'You review the site live, request changes, and we refine until you are confident to launch.' },
  { step: 5, title: 'Launch and support', description: 'Go live with hosting, forms, and tracking in place — with your partner available for ongoing help.' }
];

const PLATFORM_TESTIMONIALS = [
  {
    id: 'lp-platform-1',
    customerName: 'Business owner',
    businessName: 'Local service business',
    role: 'Owner',
    location: 'Australia',
    text: 'Having a professional website that actually brings in enquiries made a real difference. The platform handles the technical side so we can focus on the work.',
    isPlatform: true,
    attribution: 'LeadPages platform customer'
  },
  {
    id: 'lp-platform-2',
    customerName: 'Trade business owner',
    businessName: 'Trade & services',
    role: 'Director',
    location: 'Australia',
    text: 'Our old site looked fine but never generated calls. The new site with proper forms and mobile layout changed that within weeks.',
    isPlatform: true,
    attribution: 'LeadPages platform customer'
  }
];

const PLATFORM_BENEFITS = [
  { title: 'Live demos before committing', body: 'Explore real websites in your browser before you decide what is right for your business.' },
  { title: 'Conversion-focused layouts', body: 'Pages designed to turn visitors into phone calls and form submissions — not just page views.' },
  { title: 'Local personal support', body: 'Work directly with a partner who understands your market and picks up when you call.' },
  { title: 'Lead capture and CRM', body: 'Enquiry forms wired into your workflow from day one.' },
  { title: 'Secure hosting and backups', body: 'Enterprise-grade infrastructure managed by LeadPages behind every site.' },
  { title: 'Ongoing updates', body: 'Platform improvements and security updates handled for you.' }
];

const ENQUIRY_GOALS = [
  'Generate more enquiries', 'Improve business credibility', 'Replace an outdated website',
  'Launch a new business', 'Sell products online', 'Accept bookings',
  'Improve local Google visibility', 'Build a custom online system'
];

const ENQUIRY_FEATURES = [
  'Quote form', 'Booking system', 'Ecommerce', 'Gallery', 'Blog',
  'CRM integration', 'Email marketing', 'Online calculator', 'Customer portal', 'Membership system'
];

module.exports = {
  PLATFORM_SERVICES,
  PLATFORM_FAQS,
  PLATFORM_PROCESS,
  PLATFORM_TESTIMONIALS,
  PLATFORM_BENEFITS,
  ENQUIRY_GOALS,
  ENQUIRY_FEATURES
};
