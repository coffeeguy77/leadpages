/**
 * Studio family partner designs (Nov 2026) — three looks that share one renderer:
 *
 *   localwebsiteco  "Studio"        orange, portfolio-led  ("Your business. Impossible to ignore.")
 *   studioplus      "Studio Plus"   orange, content-led    ("A better website. A stronger business.")
 *   presence        "Presence"      navy & lime            ("Small business. Big presence.")
 *
 * Every word and image on these pages is an editable "design text" slot. Partners edit them in
 * the partner dashboard (Website → Design text); values live in
 * websiteProfile.designCopy[templateId][slotKey]. Anything left blank uses the default below.
 * Shared facts (logo, contact details, live client demos, region, first name) come from the
 * normal partner profile, so switching design never loses content.
 *
 * Colours are the LeadPages theme tokens (--hivis accent, --steel-900 dark bands, --light page,
 * --ink text, --pipe accent text) so the standard Try colours studio re-colours the whole page.
 */
const { buildContext, pageShell, esc } = require('./shared');
const { librarySection } = require('./showcase-library-section');

const IMG = '/assets/partner-templates/studio/';

/* ---------------------------------------------------------------- slots */
// type: text (one line) | area (multi-line; a new line = a line break) | image (URL)
function T(k, label, def, group) { return { k: k, label: label, def: def, type: 'text', group: group }; }
function A(k, label, def, group) { return { k: k, label: label, def: def, type: 'area', group: group }; }
function I(k, label, def, group) { return { k: k, label: label, def: def, type: 'image', group: group }; }

const NAV_STUDIO = [
  T('nav.work', 'Menu: work', 'Work', 'Menu'),
  T('nav.services', 'Menu: services', 'What we do', 'Menu'),
  T('nav.partner', 'Menu: partner', 'Your local partner', 'Menu'),
  T('nav.cta', 'Menu button', 'Let’s talk', 'Menu')
];

const SLOTS = {
  localwebsiteco: [].concat(NAV_STUDIO, [
    A('hero.title', 'Headline', 'Your business.\nImpossible to ignore.', 'Hero'),
    A('hero.sub', 'Supporting line', 'Standout websites. Smart tools.\nA local partner who gets it.', 'Hero'),
    T('hero.cta1', 'Main button', 'Explore the possibilities', 'Hero'),
    T('hero.cta2', 'Second button', 'Let’s talk', 'Hero'),
    T('hero.kicker', 'Small print under buttons', '{region} web design • Powered by LeadPages', 'Hero'),
    I('hero.image', 'Hero artwork', IMG + 'hero-showcase.webp', 'Hero'),
    T('band.text', 'Orange strip', 'Designed to stand out. Built to bring business in.', 'Strip'),
    A('work.title', 'Heading', 'A little inspiration.\nA lot of possibility.', 'Example designs'),
    T('work.label', 'Label', 'Example designs', 'Example designs'),
    I('work.1.image', 'Design 1 image', IMG + 'example-construction.webp', 'Example designs'),
    T('work.1.title', 'Design 1 caption', 'Built for the trade', 'Example designs'),
    T('work.1.link', 'Design 1 link (optional)', '', 'Example designs'),
    I('work.2.image', 'Design 2 image', IMG + 'example-cafe.webp', 'Example designs'),
    T('work.2.title', 'Design 2 caption', 'Made for hospitality', 'Example designs'),
    T('work.2.link', 'Design 2 link (optional)', '', 'Example designs'),
    I('work.3.image', 'Design 3 image (wide)', IMG + 'example-advisory.webp', 'Example designs'),
    T('work.3.title', 'Design 3 caption (optional)', '', 'Example designs'),
    T('work.3.link', 'Design 3 link (optional)', '', 'Example designs'),
    T('work.tag', 'Caption tag', 'Example design', 'Example designs'),
    T('demos.title', 'Live sites heading', 'Live client websites', 'Live demos'),
    T('demos.cta', 'Live site button', 'View live site', 'Live demos'),
    A('ideas.title', 'Heading', 'Big ideas.\nOne local partner.', 'Dark band'),
    A('ideas.1.title', 'Point 1 title', 'Websites with\npresence', 'Dark band'),
    A('ideas.1.text', 'Point 1 text', 'Beautiful, strategic websites that showcase your business and make a lasting impression.', 'Dark band'),
    A('ideas.2.title', 'Point 2 title', 'Tools that\nwork harder', 'Dark band'),
    A('ideas.2.text', 'Point 2 text', 'LeadPages and smart integrations to capture leads, grow your audience and keep things simple.', 'Dark band'),
    A('ideas.3.title', 'Point 3 title', 'Support from\na real person', 'Dark band'),
    A('ideas.3.text', 'Point 3 text', 'Direct, local support from someone who knows your business and is there when you need it.', 'Dark band'),
    T('partner.letter', 'Big letter', '', 'Partner'),
    T('partner.kicker', 'Small heading', 'Meet {firstName} • Your {region} partner', 'Partner'),
    A('partner.title', 'Heading', 'Local knowledge.\nSerious digital capability.', 'Partner'),
    A('partner.text', 'Text', '{brand} is a {region} website studio led by {firstName}, helping local businesses look sharper online, attract the right customers and get more from smart tools like LeadPages.', 'Partner'),
    T('partner.link', 'Link', 'Meet your partner', 'Partner'),
    A('cta.title', 'Heading', 'Let’s make them say,\n“I love your website.”', 'Call to action'),
    T('cta.button', 'Button', 'Start a conversation', 'Call to action'),
    T('footer.place', 'Footer location', '{region}, {state}', 'Footer')
  ]),

  studioplus: [
    T('nav.work', 'Menu: work', 'Work', 'Menu'),
    T('nav.services', 'Menu: services', 'Services', 'Menu'),
    T('nav.how', 'Menu: how it works', 'How it works', 'Menu'),
    T('nav.about', 'Menu: about', 'About', 'Menu'),
    T('nav.contact', 'Menu: contact', 'Contact', 'Menu'),
    A('hero.title', 'Headline', 'A better website.\nA stronger business.', 'Hero'),
    A('hero.sub', 'Supporting text', 'Your website should do more than look good. It should tell your story, make your services clear and give customers a reason to choose you. We bring thoughtful design, useful technology and local support together in one place.', 'Hero'),
    T('hero.cta1', 'Main button', 'Let’s talk about your website', 'Hero'),
    T('hero.cta2', 'Second button', 'Explore example designs', 'Hero'),
    T('hero.kicker', 'Small print under buttons', '{region} & surrounds • Your local LeadPages partner', 'Hero'),
    I('hero.image', 'Hero artwork', IMG + 'hero-showcase-wide.webp', 'Hero'),
    T('strip.1', 'Strip point 1', 'Local, personal service in {region}', 'Strip'),
    T('strip.2', 'Strip point 2', 'Thoughtful design and clear messaging', 'Strip'),
    T('strip.3', 'Strip point 3', 'Practical tools that help your business run better', 'Strip'),
    A('intro.title', 'Heading', 'Built around your business.\nNot the other way around.', 'Intro'),
    A('intro.text1', 'Text column 1', 'Every business is different, which is why we take the time to understand what you do, who your customers are and what you want to achieve. From there, we plan a website that fits your goals, your brand and the way your business actually works.', 'Intro'),
    A('intro.text2', 'Text column 2', 'A great website should make it easy for the right people to take action. We help you clarify your message, improve your enquiry paths and add the right features, then stay close and reachable with ongoing local support, so you’re never left figuring it out on your own.', 'Intro'),
    T('svc.kicker', 'Small heading', 'Our services', 'Services'),
    A('svc.title', 'Heading', 'Everything you need to make a stronger impression.', 'Services'),
    A('svc.text', 'Text', 'A complete but flexible website solution, combining professional design, practical tools and local support so your business can present well, get more enquiries and serve your customers with ease.', 'Services'),
    T('svc.1.title', 'Service 1 title', 'Website design', 'Services'),
    A('svc.1.text', 'Service 1 text', 'A modern, professional website that clearly presents your business, builds trust and makes it easy for people to get in touch.', 'Services'),
    A('svc.1.points', 'Service 1 ticks (one per line)', 'Mobile-friendly layouts that look great on phones, tablets and desktops.\nClear, engaging content that explains what you do and why it matters.\nWell-designed enquiry forms that make it simple for customers to reach you.', 'Services'),
    T('svc.2.title', 'Service 2 title', 'Smart business tools', 'Services'),
    A('svc.2.text', 'Service 2 text', 'Useful features that help you do more online, save time and give customers a smoother experience.', 'Services'),
    A('svc.2.points', 'Service 2 ticks (one per line)', 'Bookings and appointments, where suitable for your business and customers.\nOnline sales options, such as products, vouchers or selected services.\nIntegrations where needed, such as email marketing, enquiries and other key tools.', 'Services'),
    T('svc.3.title', 'Service 3 title', 'Ongoing local support', 'Services'),
    A('svc.3.text', 'Service 3 text', 'Reliable, down-to-earth support from a local partner who knows your website and your business.', 'Services'),
    A('svc.3.points', 'Service 3 ticks (one per line)', 'Help with updates and content changes when you need them.\nOngoing care to keep your website running smoothly and securely.\nPractical advice and options as your business grows or your needs change.', 'Services'),
    T('work.kicker', 'Small heading', 'Example designs', 'Example designs'),
    A('work.title', 'Heading', 'See what your business could look like.', 'Example designs'),
    A('work.text', 'Text', 'A look at two example website designs that show how a clear, modern website can bring a business to life online. These are example designs, not actual client projects.', 'Example designs'),
    I('work.1.image', 'Design 1 image', IMG + 'example-construction.webp', 'Example designs'),
    T('work.1.title', 'Design 1 title', 'Construction website — Example design', 'Example designs'),
    A('work.1.text', 'Design 1 text', 'A clean, confident website for a construction business, with a strong headline, clear services and an easy way to request a quote.', 'Example designs'),
    T('work.1.link', 'Design 1 link (optional)', '', 'Example designs'),
    I('work.2.image', 'Design 2 image', IMG + 'example-cafe.webp', 'Example designs'),
    T('work.2.title', 'Design 2 title', 'Café website — Example design', 'Example designs'),
    A('work.2.text', 'Design 2 text', 'A warm, inviting website for a local café, showcasing the menu, story and location, with clear options to order or get in touch.', 'Example designs'),
    T('work.2.link', 'Design 2 link (optional)', '', 'Example designs'),
    T('demos.title', 'Live sites heading', 'Live client websites', 'Live demos'),
    T('demos.cta', 'Live site button', 'View live site', 'Live demos'),
    A('how.title', 'Heading', 'From first conversation to launch day.', 'How it works'),
    T('how.1.title', 'Step 1 title', 'Tell us where you want to go', 'How it works'),
    A('how.1.text', 'Step 1 text', 'We start with a relaxed, practical conversation about your business, your customers and what you want your website to do. You can share ideas, existing materials and any challenges you’re facing online.', 'How it works'),
    T('how.2.title', 'Step 2 title', 'We shape your website together', 'How it works'),
    A('how.2.text', 'Step 2 text', 'We turn your goals into a clear plan, design and refine it with your input. You’ll see how it comes together, with a focus on clear content, a great user experience and the right features for your needs.', 'How it works'),
    T('how.3.title', 'Step 3 title', 'Launch with confidence', 'How it works'),
    A('how.3.text', 'Step 3 text', 'Once you’re happy, we get everything live and make sure it’s working as expected. We’ll show you how to use it, handle any final adjustments and keep in touch for ongoing support, updates and future improvements.', 'How it works'),
    T('about.letter', 'Big letter', '', 'About'),
    T('about.kicker', 'Small heading', 'Meet {firstName} • Your {region} partner', 'About'),
    A('about.title', 'Heading', 'A real person behind your website.', 'About'),
    T('about.sub', 'Sub-heading', 'Hi, I’m {firstName}. Your local {region} partner.', 'About'),
    A('about.text1', 'Text column 1', 'I work directly with business owners in {region} and the surrounding region to create websites that are practical, professional and true to what they do. You’ll deal with me from the first conversation through to launch and beyond, with clear communication and a straightforward, no-nonsense approach.', 'About'),
    A('about.text2', 'Text column 2', 'My focus is on understanding your business, your customers and what makes your offering valuable, then translating that into a website that works for you. That means a design that looks the part, content that speaks to the right people and the right tools to help you get enquiries, bookings or sales, depending on what your business needs.', 'About'),
    T('price.kicker', 'Small heading', 'Investment', 'Pricing'),
    A('price.title', 'Heading', 'A clear starting point.', 'Pricing'),
    A('price.text', 'Text', 'Flexible website packages to suit different business needs, with clear inclusions and no surprises. We’ll confirm the final scope and ongoing costs before any work begins.', 'Pricing'),
    T('price.1.name', 'Package 1 name', 'Website Launch', 'Pricing'),
    T('price.1.price', 'Package 1 price', 'From $2,500', 'Pricing'),
    A('price.1.text', 'Package 1 text', 'A professional, great-looking website that gives your business a strong and credible online presence.', 'Pricing'),
    A('price.1.points', 'Package 1 ticks (one per line)', 'Custom design to suit your brand and goals.\nMobile-friendly and easy to use.\nKey pages (e.g. home, about, services, contact).\nEnquiry form to capture customer interest.', 'Pricing'),
    T('price.2.name', 'Package 2 name', 'Website Growth', 'Pricing'),
    T('price.2.price', 'Package 2 price', 'From $3,500', 'Pricing'),
    A('price.2.text', 'Package 2 text', 'A more feature-rich website with extra functionality to help you generate enquiries, take bookings or sell online, depending on your business needs.', 'Pricing'),
    A('price.2.points', 'Package 2 ticks (one per line)', 'Everything in Website Launch.\nBookings, online sales or other key features.\nHelpful integrations (e.g. email, enquiries, tools).\nGuidance on content and structure.', 'Pricing'),
    T('price.3.name', 'Package 3 name', 'Something Custom', 'Pricing'),
    T('price.3.price', 'Package 3 price', 'Let’s scope it together', 'Pricing'),
    A('price.3.text', 'Package 3 text', 'A tailored solution for businesses with specific requirements, more complex features or a larger scope.', 'Pricing'),
    A('price.3.points', 'Package 3 ticks (one per line)', 'A solution designed around your unique needs.\nFlexible features and integrations as required.\nA clear plan and staged approach.\nOngoing support options to suit your business.', 'Pricing'),
    T('price.note', 'Note under packages', 'Final scope and ongoing costs confirmed before work begins.', 'Pricing'),
    T('faq.kicker', 'Small heading', 'FAQs', 'FAQs'),
    A('faq.title', 'Heading', 'Common questions, answered.', 'FAQs'),
    A('faq.text', 'Text', 'A few of the most common questions about working with {brand}.', 'FAQs'),
    T('faq.1.q', 'Question 1', 'Can you refresh my existing website?', 'FAQs'),
    A('faq.1.a', 'Answer 1', 'Yes, in many cases we can give your existing site a new look, improve the content and make it work better for your customers. We’ll review what you already have, discuss what’s working (and what isn’t) and recommend the best approach based on your goals, platform and budget.', 'FAQs'),
    T('faq.2.q', 'Question 2', 'Can I update the content myself?', 'FAQs'),
    A('faq.2.a', 'Answer 2', 'Most websites we build are set up so you can easily update key content, such as text, images and basic information, through a simple, user-friendly editor. We’ll show you how it works and make sure you’re comfortable using it.', 'FAQs'),
    T('faq.3.q', 'Question 3', 'Can we add bookings or online orders?', 'FAQs'),
    A('faq.3.a', 'Answer 3', 'Yes, where it’s suitable for your business. We can add bookings (such as appointments or table reservations) and online ordering or sales (such as products, services or vouchers), using the right tools for your needs and within the agreed scope of the project.', 'FAQs'),
    T('faq.4.q', 'Question 4', 'What happens after launch?', 'FAQs'),
    A('faq.4.a', 'Answer 4', 'We don’t just disappear once your site goes live. We can provide ongoing support, such as helping with updates, small changes, advice and general troubleshooting, so your website keeps working well as your business evolves.', 'FAQs'),
    A('cta.title', 'Heading', 'Let’s build a website your business can grow with.', 'Contact'),
    A('cta.text', 'Text', 'Tell me a bit about your business and what you’d like your website to do. I’ll get back to you, usually within a business day, to discuss your goals, answer any questions and suggest a practical next step. It’s a no-pressure conversation, just a chance to see what’s possible.', 'Contact'),
    T('cta.button', 'Form button', 'Start the conversation', 'Contact'),
    T('footer.place', 'Footer line', '{region} & Surrounds  •  Your Local LeadPages Partner', 'Footer')
  ],

  presence: [
    T('nav.work', 'Menu: work', 'Work', 'Menu'),
    T('nav.services', 'Menu: services', 'Services', 'Menu'),
    T('nav.about', 'Menu: about', 'About', 'Menu'),
    T('nav.cta', 'Menu button', 'Let’s talk', 'Menu'),
    T('hero.title1', 'Headline line 1', 'Small business.', 'Hero'),
    T('hero.title2', 'Headline line 2 (accent colour)', 'Big presence.', 'Hero'),
    A('hero.sub', 'Supporting text', 'Distinctive websites and smart digital tools, built around your business. Local expertise. Personal support.', 'Hero'),
    T('hero.cta', 'Button', 'Find your new direction', 'Hero'),
    T('hero.kicker', 'Small print', '{region} • Your local LeadPages partner', 'Hero'),
    I('hero.image', 'Hero artwork', IMG + 'hero-presence.webp', 'Hero'),
    T('pill.title', 'Pill heading', 'Good design opens doors.', 'Pill'),
    A('pill.text', 'Pill text', 'Make the right first impression, then make it easy for customers to take the next step.', 'Pill'),
    A('work.title', 'Heading', 'Different businesses.\nDistinctive websites.', 'Example designs'),
    T('work.tag', 'Card tag', 'Example design', 'Example designs'),
    I('work.1.image', 'Design 1 image', IMG + 'example-bakery.webp', 'Example designs'),
    T('work.1.title', 'Design 1 title', 'The Flourhouse Bakery', 'Example designs'),
    A('work.1.text', 'Design 1 text', 'A warm, modern site that brings a local bakery’s story to life.', 'Example designs'),
    T('work.1.link', 'Design 1 link (optional)', '', 'Example designs'),
    I('work.2.image', 'Design 2 image', IMG + 'example-interiors.webp', 'Example designs'),
    T('work.2.title', 'Design 2 title', 'Ridgeview Interiors', 'Example designs'),
    A('work.2.text', 'Design 2 text', 'A refined, image-led site that showcases design and craftsmanship.', 'Example designs'),
    T('work.2.link', 'Design 2 link (optional)', '', 'Example designs'),
    T('demos.title', 'Live sites heading', 'Live client websites', 'Live demos'),
    T('demos.cta', 'Live site button', 'View live site', 'Live demos'),
    A('smart.title', 'Heading', 'Looks sharp.\nWorks smarter.', 'Services'),
    A('smart.text', 'Text', 'Professional website design and practical tools that help your business run smoothly.', 'Services'),
    T('smart.1.title', 'Row 1 title', 'Website design', 'Services'),
    A('smart.1.text', 'Row 1 text', 'A clear story, thoughtful layout and a smooth experience on every screen.', 'Services'),
    T('smart.2.title', 'Row 2 title', 'Business tools', 'Services'),
    A('smart.2.text', 'Row 2 text', 'Connect enquiries, bookings and online sales where your business needs them.', 'Services'),
    T('smart.3.title', 'Row 3 title', 'Local support', 'Services'),
    A('smart.3.text', 'Row 3 text', 'A real person to help with updates, questions and your next idea.', 'Services'),
    I('partner.image', 'Partner photo', IMG + 'canberra-dusk.webp', 'Partner'),
    T('partner.caption', 'Photo caption', 'Local knowledge. Shared ambition.', 'Partner'),
    A('partner.title', 'Heading', 'Your business deserves\na partner, not a ticket number.', 'Partner'),
    A('partner.text', 'Text', 'I’m {firstName}, your local {region} partner. We’ll turn what makes your business different into a website that feels like you and helps customers take action.', 'Partner'),
    T('partner.link', 'Link', 'Meet your partner', 'Partner'),
    T('steps.1.title', 'Step 1 title', 'Let’s talk', 'Steps'),
    A('steps.1.text', 'Step 1 text', 'Tell us about your business and where you want to go.', 'Steps'),
    T('steps.2.title', 'Step 2 title', 'Shape your site', 'Steps'),
    A('steps.2.text', 'Step 2 text', 'We bring the design, content and useful tools together.', 'Steps'),
    T('steps.3.title', 'Step 3 title', 'Launch and grow', 'Steps'),
    A('steps.3.text', 'Step 3 text', 'Go live with guidance and support for what comes next.', 'Steps'),
    A('cta.title', 'Heading', 'Ready for a website\nyou’re proud to share?', 'Call to action'),
    T('cta.text', 'Text', 'Let’s work out what’s right for your business.', 'Call to action'),
    T('cta.button', 'Button', 'Start a conversation', 'Call to action'),
    T('cta.note', 'Small print', 'New websites from $2,500  •  Scope confirmed before we begin', 'Call to action')
  ]
};

const META = {
  localwebsiteco: { id: 'localwebsiteco', short: 'Studio', label: 'Studio (orange, portfolio)', tagline: 'Bold orange, portfolio-led', description: 'Big confident headline, example designs front and centre, a dark “big ideas” band and a personal partner section. Best for showing work.', mood: 'Bold & visual', fonts: 'Plus Jakarta Sans', preview: 'linear-gradient(160deg,#f6f1ea 0%,#f2610c 55%,#141414 100%)' },
  studioplus: { id: 'studioplus', short: 'Studio Plus', label: 'Studio Plus (orange, more content)', tagline: 'Orange, content-rich', description: 'Everything in Studio plus services with ticks, how it works, packages from $2,500, FAQs and an enquiry form at the bottom. Best for explaining the offer.', mood: 'Bold & informative', fonts: 'Plus Jakarta Sans', preview: 'linear-gradient(160deg,#fbf7f1 0%,#f2610c 50%,#161616 100%)' },
  presence: { id: 'presence', short: 'Presence', label: 'Presence (navy & lime)', tagline: 'Navy and lime, modern', description: 'Deep navy hero with a lime accent, staggered example designs, numbered services, a partner band with a local photo and a lime call to action.', mood: 'Modern & confident', fonts: 'Plus Jakarta Sans', preview: 'linear-gradient(160deg,#0e1a3a 0%,#1d2e5c 50%,#d7f56b 100%)' }
};

const THEME = {
  localwebsiteco: { accent: '#F2610C', dark: '#141414', bg: '#F6F1EA', ink: '#141414', muted: '#5E574F', line: '#D9D1C6', surface: '#EFE8DE' },
  studioplus: { accent: '#F2610C', dark: '#161616', bg: '#FBF7F1', ink: '#161616', muted: '#5C564F', line: '#DDD5CA', surface: '#F3EDE4' },
  presence: { accent: '#D7F56B', dark: '#0E1A3A', bg: '#EAF2FB', ink: '#0E1A3A', muted: '#4B5872', line: '#C9D6E8', surface: '#DDE9F7' }
};

/* ---------------------------------------------------------------- helpers */
function slotDefaults(id) {
  const out = {};
  (SLOTS[id] || []).forEach(function(s) { out[s.k] = s.def; });
  return out;
}

function makeText(c, id) {
  const wpCopy = (c && c.designCopy && c.designCopy[id]) || {};
  const defs = slotDefaults(id);
  const p = c.partner || {};
  const area = c.serviceArea || {};
  const tokens = {
    firstName: p.firstName || p.publicName || 'your partner',
    brand: p.agencyName || p.displayName || 'We',
    region: area.primaryRegion || 'your area',
    state: area.state || '',
    name: p.publicName || p.firstName || ''
  };
  function raw(k) {
    const v = Object.prototype.hasOwnProperty.call(wpCopy, k) && wpCopy[k] != null && String(wpCopy[k]).trim() !== '' ? wpCopy[k] : defs[k];
    return String(v == null ? '' : v).replace(/\{(\w+)\}/g, function(m, t) { return tokens[t] != null ? tokens[t] : m; });
  }
  return {
    raw: raw,
    /** escaped, new lines become <br> */
    t: function(k) { return esc(raw(k)).replace(/\s*\n\s*/g, '<br>'); },
    /** escaped single line */
    s: function(k) { return esc(raw(k).replace(/\s*\n\s*/g, ' ')); },
    lines: function(k) { return raw(k).split(/\n+/).map(function(x) { return x.trim(); }).filter(Boolean); },
    has: function(k) { return raw(k).trim() !== ''; },
    url: function(k) {
      const v = raw(k).trim();
      return /^(https?:\/\/|\/)[^\s"'<>]+$/.test(v) ? esc(v) : '';
    },
    tokens: tokens
  };
}

const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_UP = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.6 3.6 7.4-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  headset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="13" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="17" y="13" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 19c0 1.5-2 2.5-5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

function brandMark(ctx, c, extraClass) {
  const p = c.partner || {};
  const name = p.agencyName || p.displayName || 'Web studio';
  if (ctx.logoUrl) {
    const scale = Math.max(0.5, Math.min(3, Number(p.logoSize || 1) || 1));
    return '<a class="st-brand st-brand-img ' + (extraClass || '') + '" href="#top" style="--st-logo-scale:' + scale + '"><img src="' + ctx.logoUrl + '" alt="' + esc(name) + '"></a>';
  }
  const word = String(name).replace(/[^A-Za-z0-9 &'.-]/g, '').trim().toLowerCase().replace(/\s+/g, '');
  return '<a class="st-brand st-brand-word ' + (extraClass || '') + '" href="#top" aria-label="' + esc(name) + '"><span class="st-brand-glyph" aria-hidden="true">&lt;/&gt;</span><span>' + esc(word || name) + '</span></a>';
}

function leadpagesMark() {
  return '<a class="st-powered" href="https://www.leadpages.com.au" target="_blank" rel="noopener"><span>Powered by</span> <strong>LeadPages</strong></a>';
}

function bigLetter(text, c) {
  const v = text && text.trim() ? text.trim() : String((c.partner && (c.partner.agencyName || c.partner.displayName)) || 'W').trim();
  return esc(v.charAt(0).toUpperCase() || 'W');
}

function demoList(c) {
  if (c.visibility && c.visibility.demos === false) return [];
  return (c.demos || []).filter(function(d) { return d && d.url; }).slice(0, 6);
}

function demosStrip(c, T, cls) {
  // Nov 2026: the partner's own live sites now lead the "Built on LeadPages" gallery below.
  if (c.library && c.library.studio) return '';
  const list = demoList(c);
  if (!list.length) return '';
  return '<div class="st-demos ' + (cls || '') + '">'
    + '<div class="st-demos-head"><h3>' + T.t('demos.title') + '</h3><span class="st-rule" aria-hidden="true"></span></div>'
    + '<div class="st-demos-grid">' + list.map(function(d) {
      const thumb = d.thumbnail ? '<img src="' + esc(d.thumbnail) + '" alt="" loading="lazy" style="object-fit:' + (d.thumbnailFit === 'contain' ? 'contain' : 'cover') + '">' : '<span class="st-demo-mono">' + esc(String(d.name || '?').charAt(0)) + '</span>';
      return '<a class="st-demo" href="' + esc(d.url) + '" target="_blank" rel="noopener">'
        + '<span class="st-demo-thumb"' + (d.thumbnailColor ? ' style="background:' + esc(d.thumbnailColor) + '"' : '') + '>' + thumb + '</span>'
        + '<span class="st-demo-body"><strong>' + esc(d.name) + '</strong><small>' + esc(d.industry || '') + '</small>'
        + '<span class="st-demo-cta">' + T.s('demos.cta') + ' ' + ARROW_UP + '</span></span></a>';
    }).join('') + '</div></div>';
}

function gallery(c, T, id) {
  const lib = c.library || {};
  // A heading the partner typed for "Live sites" in Design text carries over to the gallery.
  const own = (c.designCopy && c.designCopy[id] && c.designCopy[id]['demos.title']) || '';
  const title = lib.title || String(own).trim();
  return librarySection(Object.assign({}, c, { library: Object.assign({}, lib, { title: title, view: T.raw('demos.cta') }) }), 'studio');
}

function exampleCard(T, n, opts) {
  opts = opts || {};
  const img = T.url('work.' + n + '.image');
  const link = T.url('work.' + n + '.link');
  const tag = opts.tag ? '<span class="st-card-tag">' + T.s(opts.tag) + '</span>' : '';
  const media = '<span class="st-card-media' + (opts.mediaClass ? ' ' + opts.mediaClass : '') + '">' + (img ? '<img src="' + img + '" alt="' + T.s('work.' + n + '.title') + '" loading="lazy">' : '') + '</span>';
  const wrapOpen = link ? '<a class="st-card-link" href="' + link + '" target="_blank" rel="noopener">' : '<div class="st-card-link">';
  const wrapClose = link ? '</a>' : '</div>';
  return { media: wrapOpen + media + wrapClose, tag: tag };
}

function contactDialog(ctx, c, T, opts) {
  opts = opts || {};
  const p = c.partner || {};
  const first = esc((p.firstName || p.publicName || '').trim());
  return '<dialog class="st-dialog" id="st-contact" aria-labelledby="st-contact-title">'
    + '<form method="dialog" class="st-dialog-x"><button type="submit" aria-label="Close">&times;</button></form>'
    + '<form class="st-form" data-pl-lead-form data-pl-kind="partner-enquiry" data-pl-extended="1" method="post" action="#" novalidate>'
    + '<h2 id="st-contact-title">' + (first ? 'Talk to ' + first : 'Start a conversation') + '</h2>'
    + '<p class="st-form-sub">' + esc((c.contact && c.contact.responseTime) || 'Usually within one business day') + '. No pressure, just a chance to see what’s possible.</p>'
    + formFields()
    + '<button class="st-btn st-btn-accent" type="submit">Send</button>'
    + '<p class="pl-form-err" role="alert"></p><p class="pl-form-ok" hidden>Thanks — we’ll be in touch shortly.</p>'
    + contactLines(c)
    + '</form></dialog>';
}

function formFields(placeholdersOnly) {
  const ph = !!placeholdersOnly;
  function f(name, label, type, half, req) {
    return '<label class="st-f st-f-' + name + (half ? ' st-f-half' : '') + '"><span' + (ph ? ' class="st-sr"' : '') + '>' + label + '</span>'
      + (type === 'area'
        ? '<textarea name="' + name + '" rows="3" placeholder="' + (ph ? label : '') + '"></textarea>'
        : '<input name="' + name + '" type="' + type + '" placeholder="' + (ph ? label : '') + '"' + (req ? ' required' : '') + ' autocomplete="' + (name === 'businessName' ? 'organization' : name) + '">')
      + '</label>';
  }
  return '<div class="lp-hp" aria-hidden="true"><label>Company website<input type="text" name="lp_hp" value="" tabindex="-1" autocomplete="off"></label></div>'
    + '<div class="st-fields">'
    + f('name', 'Name', 'text', true, true)
    + f('businessName', 'Business', 'text', true)
    + f('email', 'Email', 'email', false, true)
    + f('phone', 'Phone (optional)', 'tel', false)
    + f('message', 'Tell us about your project', 'area', false)
    + '</div>';
}

function contactLines(c) {
  const ct = c.contact || {};
  const out = [];
  if (ct.phone) out.push('<a href="tel:' + esc(String(ct.phone).replace(/[^+0-9]/g, '')) + '">' + esc(ct.phone) + '</a>');
  if (ct.email) out.push('<a href="mailto:' + esc(ct.email) + '">' + esc(ct.email) + '</a>');
  return out.length ? '<p class="st-form-alt">Prefer to call or email? ' + out.join(' · ') + '</p>' : '';
}

function openBtn(cls, label, icon) {
  return '<button type="button" class="' + cls + '" data-st-open="contact">' + label + (icon || '') + '</button>';
}

function navBlock(ctx, c, links, ctaHtml, cls) {
  return '<header class="st-nav ' + (cls || '') + '" id="top"><div class="st-wrap st-nav-in">'
    + brandMark(ctx, c)
    + '<nav class="st-links" aria-label="Main">' + links.map(function(l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join('') + '</nav>'
    + (ctaHtml || '')
    + '<button type="button" class="st-menu-btn" data-st-menu aria-expanded="false" aria-label="Menu">' + ICON.menu + '</button>'
    + '</div></header>';
}

/* ---------------------------------------------------------------- Studio */
function studioBody(ctx, c) {
  const T = makeText(c, 'localwebsiteco');
  const c1 = exampleCard(T, 1), c2 = exampleCard(T, 2), c3 = exampleCard(T, 3);
  function caption(n) {
    if (!T.has('work.' + n + '.title')) return '';
    return '<div class="st-caption"><strong>' + T.t('work.' + n + '.title') + '</strong><span class="st-rule" aria-hidden="true"></span><span class="st-kicker">' + T.s('work.tag') + '</span></div>';
  }
  const heroImg = T.url('hero.image');
  return navBlock(ctx, c, [['#work', T.s('nav.work')], ['#what', T.s('nav.services')], ['#partner', T.s('nav.partner')]], openBtn('st-btn st-btn-accent st-btn-sm st-nav-cta', T.s('nav.cta')))
    + '<main>'
    + '<section class="st-hero"><div class="st-wrap st-hero-in">'
    + '<div class="st-hero-copy">'
    + '<h1 class="st-h-hero">' + T.t('hero.title') + '</h1>'
    + '<p class="st-hero-sub">' + T.t('hero.sub') + '</p>'
    + '<div class="st-btns"><a class="st-btn st-btn-accent" href="#work">' + T.s('hero.cta1') + ARROW + '</a>' + openBtn('st-btn st-btn-outline', T.s('hero.cta2')) + '</div>'
    + '<p class="st-kicker st-hero-kicker">' + T.s('hero.kicker') + '</p>'
    + '</div>'
    + (heroImg ? '<div class="st-hero-art"><img src="' + heroImg + '" alt="" fetchpriority="high"></div>' : '')
    + '</div></section>'
    + '<div class="st-band"><p>' + T.s('band.text') + '</p></div>'
    + '<section class="st-work" id="work"><div class="st-wrap">'
    + '<div class="st-work-head"><h2 class="st-h2">' + T.t('work.title') + '</h2><span class="st-rule" aria-hidden="true"></span><span class="st-kicker">' + T.s('work.label') + '</span></div>'
    + '<div class="st-work-grid">'
    + '<figure class="st-card">' + c1.media + caption(1) + '</figure>'
    + '<figure class="st-card">' + c2.media + caption(2) + '</figure>'
    + '<figure class="st-card st-card-wide">' + c3.media + caption(3) + '</figure>'
    + '</div>'
    + demosStrip(c, T)
    + '</div></section>'
    + gallery(c, T, 'localwebsiteco')
    + '<section class="st-ideas st-dark" id="what"><div class="st-wrap st-ideas-in">'
    + '<h2 class="st-h-ideas">' + T.t('ideas.title') + '</h2>'
    + [1, 2, 3].map(function(n) {
      return '<div class="st-idea"><span class="st-num">0' + n + '</span><h3>' + T.t('ideas.' + n + '.title') + '</h3><p>' + T.t('ideas.' + n + '.text') + '</p></div>';
    }).join('')
    + '</div></section>'
    + '<section class="st-partner" id="partner"><div class="st-wrap st-partner-in">'
    + '<div class="st-letter" aria-hidden="true">' + bigLetter(T.raw('partner.letter'), c) + '</div>'
    + '<div class="st-partner-copy">'
    + '<p class="st-kicker st-kicker-accent">' + T.s('partner.kicker') + '</p>'
    + '<h2 class="st-h3">' + T.t('partner.title') + '</h2>'
    + '<p>' + T.t('partner.text') + '</p>'
    + openBtn('st-link', T.s('partner.link'), ARROW_UP)
    + '</div></div></section>'
    + '<section class="st-cta"><div class="st-wrap st-cta-in">'
    + '<h2>' + T.t('cta.title') + '</h2>'
    + openBtn('st-btn st-btn-dark', T.s('cta.button'), ARROW_UP)
    + '</div></section>'
    + '</main>'
    + '<footer class="st-footer"><div class="st-wrap st-footer-in">'
    + brandMark(ctx, c, 'st-brand-light')
    + '<span class="st-footer-mid">' + T.s('footer.place') + '</span>'
    + leadpagesMark()
    + '</div></footer>'
    + contactDialog(ctx, c, T);
}

/* ---------------------------------------------------------------- Studio Plus */
function studioPlusBody(ctx, c) {
  const T = makeText(c, 'studioplus');
  const heroImg = T.url('hero.image');
  const stripIcons = [ICON.pin, ICON.layers, ICON.bolt];
  const svcIcons = [ICON.monitor, ICON.layers, ICON.headset];
  function ticks(k) { return '<ul class="st-ticks">' + T.lines(k).map(function(l) { return '<li>' + TICK + '<span>' + esc(l) + '</span></li>'; }).join('') + '</ul>'; }
  return navBlock(ctx, c, [['#work', T.s('nav.work')], ['#services', T.s('nav.services')], ['#how', T.s('nav.how')], ['#about', T.s('nav.about')], ['#contact', T.s('nav.contact')]], '', 'st-nav-plain')
    + '<main>'
    + '<section class="st-hero st-hero-plus"><div class="st-wrap st-hero-in">'
    + '<div class="st-hero-copy">'
    + '<h1 class="st-h-hero">' + T.t('hero.title') + '</h1>'
    + '<p class="st-hero-sub">' + T.t('hero.sub') + '</p>'
    + '<div class="st-btns"><a class="st-btn st-btn-accent" href="#contact">' + T.s('hero.cta1') + ARROW + '</a><a class="st-btn st-btn-outline" href="#work">' + T.s('hero.cta2') + '</a></div>'
    + '<p class="st-kicker st-hero-kicker">' + T.s('hero.kicker') + '</p>'
    + '</div>'
    + (heroImg ? '<div class="st-hero-art"><img src="' + heroImg + '" alt="" fetchpriority="high"></div>' : '')
    + '</div></section>'
    + '<div class="st-strip"><div class="st-wrap st-strip-in">' + [1, 2, 3].map(function(n, i) { return '<span>' + stripIcons[i] + T.s('strip.' + n) + '</span>'; }).join('') + '</div></div>'
    + '<section class="st-intro"><div class="st-wrap st-intro-in">'
    + '<h2 class="st-h2">' + T.t('intro.title') + '</h2><p>' + T.t('intro.text1') + '</p><p>' + T.t('intro.text2') + '</p>'
    + '</div></section>'
    + '<section class="st-svc" id="services"><div class="st-wrap st-svc-in">'
    + '<div class="st-side"><p class="st-kicker st-kicker-accent">' + T.s('svc.kicker') + '</p><h2 class="st-h3">' + T.t('svc.title') + '</h2><p>' + T.t('svc.text') + '</p></div>'
    + [1, 2, 3].map(function(n, i) {
      return '<article class="st-svc-col"><h3><span class="st-ic">' + svcIcons[i] + '</span>' + T.t('svc.' + n + '.title') + '</h3><p>' + T.t('svc.' + n + '.text') + '</p>' + ticks('svc.' + n + '.points') + '</article>';
    }).join('')
    + '</div></section>'
    + '<section class="st-work st-work-plus" id="work"><div class="st-wrap st-work-plus-in">'
    + '<div class="st-side"><p class="st-kicker st-kicker-accent">' + T.s('work.kicker') + '</p><h2 class="st-h3">' + T.t('work.title') + '</h2><p>' + T.t('work.text') + '</p></div>'
    + [1, 2].map(function(n) {
      const cd = exampleCard(T, n);
      return '<figure class="st-card">' + cd.media + '<figcaption><strong>' + T.t('work.' + n + '.title') + '</strong><span>' + T.t('work.' + n + '.text') + '</span></figcaption></figure>';
    }).join('')
    + '</div><div class="st-wrap">' + demosStrip(c, T) + '</div></section>'
    + gallery(c, T, 'studioplus')
    + '<section class="st-how st-dark" id="how"><div class="st-wrap st-ideas-in">'
    + '<h2 class="st-h-ideas">' + T.t('how.title') + '</h2>'
    + [1, 2, 3].map(function(n) {
      return '<div class="st-idea"><span class="st-num st-num-lg">0' + n + '</span><h3>' + T.t('how.' + n + '.title') + '</h3><p>' + T.t('how.' + n + '.text') + '</p></div>';
    }).join('')
    + '</div></section>'
    + '<section class="st-partner st-about" id="about"><div class="st-wrap st-partner-in">'
    + '<div class="st-letter" aria-hidden="true">' + bigLetter(T.raw('about.letter'), c) + '</div>'
    + '<div class="st-partner-copy">'
    + '<p class="st-kicker st-kicker-accent">' + T.s('about.kicker') + '</p>'
    + '<h2 class="st-h2 st-h2-tight">' + T.t('about.title') + '</h2>'
    + '<p class="st-about-sub">' + T.t('about.sub') + '</p>'
    + '<div class="st-two"><p>' + T.t('about.text1') + '</p><p>' + T.t('about.text2') + '</p></div>'
    + '</div></div></section>'
    + '<section class="st-price"><div class="st-wrap st-price-in">'
    + '<div class="st-side"><p class="st-kicker st-kicker-accent">' + T.s('price.kicker') + '</p><h2 class="st-h3">' + T.t('price.title') + '</h2><p>' + T.t('price.text') + '</p></div>'
    + '<div class="st-price-grid">' + [1, 2, 3].map(function(n) {
      return '<article class="st-pack"><h3>' + T.t('price.' + n + '.name') + '</h3><p class="st-pack-price">' + T.t('price.' + n + '.price') + '</p><p>' + T.t('price.' + n + '.text') + '</p>' + ticks('price.' + n + '.points') + '</article>';
    }).join('') + '<p class="st-price-note">' + T.t('price.note') + '</p></div>'
    + '</div></section>'
    + '<section class="st-faq"><div class="st-wrap st-faq-in">'
    + '<div class="st-side"><p class="st-kicker st-kicker-accent">' + T.s('faq.kicker') + '</p><h2 class="st-h3">' + T.t('faq.title') + '</h2><p>' + T.t('faq.text') + '</p></div>'
    + '<dl class="st-faq-list">' + [1, 2, 3, 4].filter(function(n) { return T.has('faq.' + n + '.q'); }).map(function(n) {
      return '<div class="st-faq-row"><dt>' + T.t('faq.' + n + '.q') + '</dt><dd>' + T.t('faq.' + n + '.a') + '</dd></div>';
    }).join('') + '</dl>'
    + '</div></section>'
    + '<section class="st-cta st-cta-form" id="contact"><div class="st-wrap st-cta-form-in">'
    + '<h2>' + T.t('cta.title') + '</h2>'
    + '<p class="st-cta-text">' + T.t('cta.text') + '</p>'
    + '<form class="st-form st-form-inline" data-pl-lead-form data-pl-kind="partner-enquiry" data-pl-extended="1" method="post" action="#" novalidate>'
    + formFields(true)
    + '<button class="st-btn st-btn-dark st-btn-block" type="submit">' + T.s('cta.button') + ARROW + '</button>'
    + '<p class="pl-form-err" role="alert"></p><p class="pl-form-ok" hidden>Thanks — we’ll be in touch shortly.</p>'
    + '</form>'
    + '</div></section>'
    + '</main>'
    + '<footer class="st-footer"><div class="st-wrap st-footer-in">'
    + brandMark(ctx, c, 'st-brand-light')
    + '<span class="st-footer-mid">' + T.s('footer.place') + '</span>'
    + leadpagesMark()
    + '</div></footer>';
}

/* ---------------------------------------------------------------- Presence */
function presenceBody(ctx, c) {
  const T = makeText(c, 'presence');
  const heroImg = T.url('hero.image');
  const pImg = T.url('partner.image');
  function card(n, cls) {
    const cd = exampleCard(T, n);
    return '<figure class="st-card ' + cls + '">' + cd.media
      + '<figcaption><span class="st-kicker">' + T.s('work.tag') + '</span><strong>' + T.t('work.' + n + '.title') + '</strong><span>' + T.t('work.' + n + '.text') + '</span></figcaption></figure>';
  }
  return navBlock(ctx, c, [['#work', T.s('nav.work')], ['#services', T.s('nav.services')], ['#about', T.s('nav.about')]], openBtn('st-btn st-btn-accent st-btn-sm st-btn-pill st-nav-cta', T.s('nav.cta'), ARROW_UP), 'st-nav-dark')
    + '<main>'
    + '<section class="pr-hero st-dark"><div class="st-wrap pr-hero-in">'
    + '<div class="pr-hero-copy">'
    + '<h1 class="st-h-hero"><span>' + T.s('hero.title1') + '</span><span class="pr-accent">' + T.s('hero.title2') + '</span></h1>'
    + '<p class="st-hero-sub">' + T.t('hero.sub') + '</p>'
    + openBtn('st-btn st-btn-accent st-btn-pill', T.s('hero.cta'), ARROW_UP)
    + '<p class="st-kicker st-hero-kicker">' + T.s('hero.kicker') + '</p>'
    + '</div>'
    + (heroImg ? '<div class="pr-hero-art"><img src="' + heroImg + '" alt="" fetchpriority="high"></div>' : '')
    + '</div></section>'
    + '<div class="st-wrap pr-pill-wrap"><div class="pr-pill"><h2>' + T.t('pill.title') + '</h2><span class="pr-vr" aria-hidden="true"></span><p>' + T.t('pill.text') + '</p></div></div>'
    + '<section class="pr-work" id="work"><div class="st-wrap">'
    + '<h2 class="st-h2 pr-h2">' + T.t('work.title') + '</h2>'
    + '<div class="pr-work-grid">' + card(1, 'pr-card-1') + card(2, 'pr-card-2') + '</div>'
    + demosStrip(c, T)
    + '</div></section>'
    + gallery(c, T, 'presence')
    + '<section class="pr-smart" id="services"><div class="st-wrap pr-smart-in">'
    + '<div class="pr-smart-head"><h2 class="st-h2">' + T.t('smart.title') + '</h2><p>' + T.t('smart.text') + '</p></div>'
    + '<ol class="pr-rows">' + [1, 2, 3].map(function(n) {
      return '<li><span class="pr-dot">0' + n + '</span><strong>' + T.t('smart.' + n + '.title') + '</strong><span class="pr-vr" aria-hidden="true"></span><p>' + T.t('smart.' + n + '.text') + '</p></li>';
    }).join('') + '</ol>'
    + '</div></section>'
    + '<section class="pr-partner st-dark" id="about"><div class="st-wrap pr-partner-in">'
    + '<figure class="pr-photo">' + (pImg ? '<img src="' + pImg + '" alt="" loading="lazy">' : '') + (T.has('partner.caption') ? '<figcaption>' + T.s('partner.caption') + '</figcaption>' : '') + '</figure>'
    + '<div class="pr-partner-copy"><h2>' + T.t('partner.title') + '</h2><p>' + T.t('partner.text') + '</p>' + openBtn('st-link st-link-accent', T.s('partner.link'), ARROW_UP) + '</div>'
    + '</div></section>'
    + '<section class="pr-steps"><div class="st-wrap pr-steps-in">' + [1, 2, 3].map(function(n) {
      return '<div class="pr-step"><h3><span>0' + n + '</span> ' + T.t('steps.' + n + '.title') + '</h3><p>' + T.t('steps.' + n + '.text') + '</p></div>';
    }).join('') + '</div></section>'
    + '<section class="pr-cta"><div class="st-wrap pr-cta-in">'
    + '<h2>' + T.t('cta.title') + '</h2><span class="pr-vr" aria-hidden="true"></span>'
    + '<div class="pr-cta-side"><p>' + T.t('cta.text') + '</p>' + openBtn('st-btn st-btn-dark st-btn-pill', T.s('cta.button'), ARROW_UP) + '<p class="st-kicker">' + T.s('cta.note') + '</p></div>'
    + '</div></section>'
    + '</main>'
    + '<footer class="st-footer"><div class="st-wrap st-footer-in">'
    + brandMark(ctx, c, 'st-brand-light')
    + '<span class="st-footer-mid"></span>'
    + leadpagesMark()
    + '</div></footer>'
    + contactDialog(ctx, c, T);
}

/* ---------------------------------------------------------------- shell */
function tryColoursHead(id) {
  const th = THEME[id];
  // Try colours reads the site's own colours from SITE_CONFIG.theme (for "Site colours" and for
  // swapping any inline colours); the page itself is drawn from the CSS tokens below.
  const siteConfig = { slug: 'partner-' + id, theme: { hivis: th.accent, pipe: th.accent, steel: th.dark, lightBg: th.bg, safety: th.accent } };
  return '<script>window.SITE_CONFIG=' + JSON.stringify(siteConfig) + ';window.__LP_TRY_COLOURS__={label:"Try colours"};</script>'
    + '<link rel="stylesheet" href="/assets/lp-try-colours.css?v=3">'
    + '<script src="/assets/lp-try-colours.js?v=3" defer></script>';
}

function tokenVars(id) {
  const th = THEME[id];
  return {
    hivis: th.accent, 'hivis-600': th.accent, pipe: id === 'presence' ? '#4C6A12' : th.accent, safety: th.accent,
    'steel-900': th.dark, 'steel-950': th.dark, 'steel-800': th.dark,
    light: th.bg, ink: th.ink, muted: th.muted, line: th.line,
    'lp-btn-fg': id === 'presence' ? th.dark : '#FFFFFF', 'lptc-on-primary': id === 'presence' ? th.dark : '#FFFFFF',
    'st-surface': th.surface
  };
}

function buildVariant(id, bodyFn) {
  return function build(prof, partner, demos, base, opts) {
    const ctx = buildContext(prof, partner, demos, base, opts);
    const c = ctx.content;
    if (!c) throw new Error('themeContent required');
    const vars = tokenVars(id);
    return pageShell(ctx, bodyFn(ctx, c), {
      templateId: id,
      css: '/assets/partner-templates/studio.css?v=2',
      bodyClass: 'st-body st-' + id,
      themeContent: c,
      fonts: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
      templateSwitcher: opts && opts.templateSwitcher === true,
      extraVars: vars,
      extraHead: tryColoursHead(id) + '<script src="/assets/partner-templates/studio.js?v=1" defer></script>'
    });
  };
}

module.exports = {
  SLOTS,
  META,
  THEME,
  slotDefaults,
  makeText,
  builders: {
    localwebsiteco: buildVariant('localwebsiteco', studioBody),
    studioplus: buildVariant('studioplus', studioPlusBody),
    presence: buildVariant('presence', presenceBody)
  }
};
