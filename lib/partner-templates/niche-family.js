'use strict';

/**
 * Industry partner pages (Nov 2026). Ten designs that share one layout — hero, an interactive
 * "example experience" the partner can demo in a sales conversation, example designs for the
 * industry (plus real LeadPages sites in that industry behind "Show more"), four reasons,
 * and an enquiry form. Each has its own colours, fonts and pictures.
 *
 * They work as main-page designs (design picker) and as extra industry pages every partner
 * gets: /<partner>?industry=<id>.
 *
 * This file is data only. studio-family.js turns it into design-text slots and pages, and
 * niche-widgets.js draws each industry's example experience.
 */

const IMG = '/assets/partner-templates/niche/';

const FEATURE_TITLES = ['Sector-specific search landing pages', 'Relevant tracking', 'Mobile actions', 'Local ongoing support'];

const NICHES = [
  {
    id: 'professional-services', img: 'professional', short: 'Professional services', industry: 'Accounting, legal & advisory',
    tagline: 'Navy and gold, trusted', preview: 'linear-gradient(160deg,#f7f4ee 0%,#c9a45c 50%,#13233f 100%)',
    theme: { accent: '#C9A45C', dark: '#13233F', bg: '#F7F4EE', ink: '#16233A', muted: '#55607A', line: '#DCD6CB', surface: '#E3ECF6', pipe: '#8A6A2C', btnFg: '#16233A', font: 'serif', hero: 'dark' },
    keywords: 'account|legal|law|lawyer|solicitor|conveyanc|advis|finance|broker|tax|bookkeep',
    copy: {
      'nav.niche': 'Professional services websites', 'nav.cta': 'Plan my firm’s website',
      'hero.kicker': 'Professional services websites',
      'hero.title': 'Turn specialist knowledge into new client enquiries.',
      'hero.sub': 'Bespoke website design for professional services firms across accounting, legal and business advisory — credible, clear and built to generate new enquiries from the right clients.',
      'exp.kicker': 'Example experience',
      'exp.title': 'Get the right enquiry to the right adviser.',
      'exp.text': 'We design enquiry experiences that guide prospects to the right service and route new business enquiries to the right adviser on your team.',
      'ex.title': 'Website design for professional services.',
      'ex.sub': 'Tailored, high-quality websites for specialist firms — designed to build trust, explain your services and generate new business enquiries.',
      'ex.1.title': 'Accounting', 'ex.1.text': '', 'ex.2.title': 'Legal practices', 'ex.2.text': '', 'ex.3.title': 'Business advisory', 'ex.3.text': '',
      'band.title': 'A website partner for professional services firms.',
      'band.1': 'Target the services your clients search for, such as tax advice, commercial law or business strategy.',
      'band.2': 'See what’s working with clear tracking of key actions, including CTA clicks and submitted enquiries.',
      'band.3': 'Make it easy for prospects to call, enquire or book a meeting from their phone.',
      'band.4': 'A {region}-based team for updates, improvements and ongoing website support as your firm grows.',
      'cta.title': 'Plan your professional services website.',
      'cta.text': 'Tell us about your firm and what you want to achieve, and we’ll be in touch to plan the right website for you.',
      'cta.button': 'Plan my firm’s website'
    },
    goals: ['More new client enquiries', 'Explain our services clearly', 'Route enquiries to the right adviser', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'tourism', img: 'tourism', short: 'Tourism & stays', industry: 'Tourism & accommodation',
    tagline: 'Coastal teal, inviting', preview: 'linear-gradient(160deg,#f6efe4 0%,#e7b26f 45%,#0e5560 100%)',
    theme: { accent: '#0E5560', dark: '#0E4A53', bg: '#F7F0E6', ink: '#14302F', muted: '#4F6463', line: '#E2D6C4', surface: '#FFFFFF', pipe: '#0E5560', btnFg: '#FFFFFF', font: 'serif', hero: 'light' },
    keywords: 'tour|travel|accommodation|stay|cabin|holiday|park|bnb|motel|hotel|retreat|caravan|camp',
    copy: {
      'nav.niche': 'Tourism & accommodation', 'nav.cta': 'Get a quote',
      'hero.kicker': 'Tourism & accommodation websites',
      'hero.title': 'Give travellers a reason to book direct.',
      'hero.sub': 'Bespoke website design for tourism and accommodation businesses — from boutique stays and tour operators to holiday parks — built to showcase your destination, convert more enquiries and drive direct bookings.',
      'exp.kicker': 'Plan · Experience · Book direct',
      'exp.title': 'A stay planner built for your visitors.',
      'exp.text': 'Give travellers a simple, inspiring way to plan their stay, explore local experiences and send a direct booking enquiry — all through a website tailored to your business.',
      'ex.title': 'Tailored websites for your type of business.',
      'ex.sub': '',
      'ex.1.title': 'Boutique stays', 'ex.1.text': 'Distinctive accommodation websites that showcase your place and drive direct bookings.',
      'ex.2.title': 'Tour operators', 'ex.2.text': 'Engaging, enquiry-focused websites for tours, activities and local experiences.',
      'ex.3.title': 'Holiday parks', 'ex.3.text': 'Welcoming, easy-to-use websites that highlight your park, facilities and location.',
      'band.title': 'More than a beautiful website — built for the tourism industry.',
      'band.1': 'Target high-intent travellers with landing pages for your stays, tours or experiences.',
      'band.2': 'See what’s working with tracking for key actions like CTA clicks and submitted enquiries.',
      'band.3': 'Make it easy for visitors to call, get directions, check availability or send an enquiry on mobile.',
      'band.4': 'Friendly, {region}-based support to keep your website running smoothly and ready for seasonal campaigns.',
      'cta.title': 'Tell us about your business.',
      'cta.text': 'Get a quick, no-obligation plan for a bespoke website for your tourism or accommodation business.',
      'cta.button': 'Plan my tourism website'
    },
    goals: ['More direct bookings', 'Show off our place and area', 'Fewer booking-site fees', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'childcare', img: 'childcare', short: 'Childcare', industry: 'Childcare & early learning',
    tagline: 'Warm and playful', preview: 'linear-gradient(160deg,#fbf6ee 0%,#f07d53 45%,#3e63d8 100%)',
    theme: { accent: '#F07D53', dark: '#22306B', bg: '#FBF6EE', ink: '#22306B', muted: '#4F5A80', line: '#E9DFD0', surface: '#FFFFFF', pipe: '#3E63D8', btnFg: '#FFFFFF', font: 'rounded', hero: 'card' },
    keywords: 'child|early learning|preschool|kinder|daycare|school|oshc|nanny|family',
    copy: {
      'nav.niche': 'Childcare & early learning websites', 'nav.cta': 'Plan my centre website',
      'hero.kicker': 'Childcare & early learning websites',
      'hero.title': 'Help families take the first step through your door.',
      'hero.sub': 'Bespoke website design for childcare and early learning centres — thoughtfully built to showcase your program, build trust with families and generate enrolment enquiries.',
      'exp.kicker': 'Example experience',
      'exp.title': 'Make it easy for families to find a place and book a tour.',
      'exp.text': 'Give families a clear, helpful way to check availability and request a tour — tailored to how childcare and early learning centres work.',
      'ex.title': 'Childcare website designs built for your sector.',
      'ex.sub': '',
      'ex.1.title': 'Early learning', 'ex.1.text': '', 'ex.2.title': 'Preschool', 'ex.2.text': '', 'ex.3.title': 'Outside school hours care', 'ex.3.text': '',
      'band.title': 'A website that’s designed for childcare and early learning.',
      'band.1': 'Attract local families with pages for your centre, programs and location.',
      'band.2': 'See what’s working with tracking for key actions like CTA clicks and submitted enquiries.',
      'band.3': 'Make it simple for busy families to call, enquire or request a tour on their phone.',
      'band.4': 'A {region}-based team who understand your sector and are here for the long term.',
      'cta.title': 'Plan your centre website.',
      'cta.text': 'Tell us a little about your business and what you’d like your website to achieve, and we’ll help you plan the right approach.',
      'cta.button': 'Plan my centre website'
    },
    goals: ['More tour requests', 'More enrolment enquiries', 'Show our program and centre', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'manufacturing', img: 'manufacturing', short: 'Manufacturing', industry: 'Manufacturing & wholesale',
    tagline: 'Industrial and technical', preview: 'linear-gradient(160deg,#eeece8 0%,#c2541e 45%,#1e2a33 100%)',
    theme: { accent: '#C2541E', dark: '#1E2A33', bg: '#EFEDEA', ink: '#1E2A33', muted: '#56606A', line: '#D4D0CA', surface: '#FFFFFF', pipe: '#A5461A', btnFg: '#FFFFFF', font: 'industrial', hero: 'dark' },
    keywords: 'manufactur|wholesale|distribut|engineer|fabricat|steel|supply|industrial|machin|trade supplies',
    copy: {
      'nav.niche': 'Manufacturing & wholesale websites', 'nav.cta': 'Get a plan',
      'hero.kicker': 'Manufacturing & wholesale websites',
      'hero.title': 'Turn product searches into qualified trade enquiries.',
      'hero.sub': 'Bespoke website design for Australian manufacturers, distributors and wholesale suppliers — built to showcase your products, specifications and capabilities, and generate qualified trade enquiries from the right buyers.',
      'exp.kicker': 'Example experience',
      'exp.title': 'A searchable specification catalogue that makes it easy to enquire.',
      'exp.text': 'Showcase your product range with technical details, drawings and clear enquiry actions — so trade customers can find what they need, shortlist items, add quantities and send a request for quote (RFQ) with their drawings or requirements.',
      'ex.title': 'Website solutions built for your part of the supply chain.',
      'ex.sub': '',
      'ex.1.title': 'Manufacturers', 'ex.1.text': 'Showcase your capabilities, product range and technical specifications.',
      'ex.2.title': 'Distributors', 'ex.2.text': 'Present a broad product range, by brand or application, with fast enquiry options.',
      'ex.3.title': 'Wholesale suppliers', 'ex.3.text': 'Make it easy for trade buyers to find, shortlist and enquire in volume.',
      'band.title': 'A website that works for your industrial business.',
      'band.1': 'Target high-intent buyers with product, capability and application landing pages built for your market.',
      'band.2': 'See what’s working with tracking for key actions like CTA clicks and submitted enquiries.',
      'band.3': 'Make it easy for trade customers to call, request a quote or send an enquiry from any device.',
      'band.4': '{region}-based support for updates, new pages and ongoing website improvements as your business grows.',
      'cta.title': 'Plan your industrial website.',
      'cta.text': 'Tell us a little about your business and your website goal, and we’ll get in touch to plan the right approach for you.',
      'cta.button': 'Plan my industrial website'
    },
    goals: ['Generate more trade enquiries', 'Show our product catalogue', 'Take quote requests online', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'retail', img: 'retail', short: 'Retail', industry: 'Independent retail & ecommerce',
    tagline: 'Bold red and lilac', preview: 'linear-gradient(160deg,#fbf3ec 0%,#d9c9f2 45%,#e0352b 100%)',
    theme: { accent: '#E0352B', dark: '#1D1D22', bg: '#FBF4EE', ink: '#1D1D22', muted: '#5B5560', line: '#EADFE0', surface: '#E8DDF6', pipe: '#C82A21', btnFg: '#FFFFFF', font: 'bold', hero: 'dark' },
    keywords: 'retail|shop|store|boutique|homewares|apparel|fashion|gift|florist|ecommerce|bakery|deli|grocer',
    copy: {
      'nav.niche': 'Retail & ecommerce websites', 'nav.cta': 'Plan my retail website',
      'hero.kicker': 'Retail & ecommerce websites',
      'hero.title': 'Bring your shopfront to the screen.',
      'hero.sub': 'Bespoke website design for independent retailers and ecommerce stores. We create beautiful, easy-to-manage websites that showcase your products, drive sales and bring more customers through your door.',
      'exp.kicker': 'Example experience',
      'exp.title': 'A shoppable collection for your customers.',
      'exp.text': 'Showcase your range online, let customers choose options, and offer convenient click-and-collect from your store.',
      'exp.ticks': 'Product options (e.g. size, colour)\nAdd to cart and checkout\nClick-and-collect at your store\nA smooth, on-brand experience',
      'ex.title': 'Retail website design for your store.',
      'ex.sub': 'Tailored designs for the way you sell — from homewares and fashion to specialty retail.',
      'ex.1.title': 'Homewares', 'ex.1.text': 'Stylish, product-led websites that turn browsing into sales.',
      'ex.2.title': 'Apparel', 'ex.2.text': 'Showcase your collections, new arrivals and seasonal ranges with ease.',
      'ex.3.title': 'Specialty retail', 'ex.3.text': 'Perfect for gift stores, food and beverage, lifestyle and niche retail.',
      'band.title': 'A retail-focused web partner that gets your business.',
      'band.1': 'Attract local shoppers with targeted pages for what you sell, like homewares, fashion or gifts.',
      'band.2': 'See what’s working with tracking for key actions, including CTA clicks and submitted enquiries.',
      'band.3': 'Make it easy for customers to call, get directions, check store hours and click-and-collect on mobile.',
      'band.4': 'A {region}-based team who understand your market and are here for updates, seasonal changes and ongoing support.',
      'cta.title': 'Plan your retail website today.',
      'cta.text': 'Tell us a little about your business and what you’d like your website to achieve, and we’ll be in touch to plan the right approach for you.',
      'cta.button': 'Plan my retail website'
    },
    goals: ['Sell online', 'Offer click-and-collect', 'Bring more people into the store', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'automotive', img: 'automotive', short: 'Automotive', industry: 'Automotive workshops & dealerships',
    tagline: 'Orange and black, high-energy', preview: 'linear-gradient(160deg,#f2f2f2 0%,#ff7a1a 45%,#16181b 100%)',
    theme: { accent: '#FF7A1A', dark: '#16181B', bg: '#F1F1F1', ink: '#16181B', muted: '#585B60', line: '#D6D6D6', surface: '#FFFFFF', pipe: '#D45E06', btnFg: '#16181B', font: 'condensed', hero: 'dark' },
    keywords: 'auto|mechanic|motor|car|vehicle|tyre|truck|diesel|panel|smash|dealer|workshop|service centre',
    copy: {
      'nav.niche': 'Automotive websites', 'nav.cta': 'Get a plan',
      'hero.kicker': 'Automotive workshops & dealerships websites',
      'hero.title': 'Put your next booking in the workshop diary.',
      'hero.sub': 'Bespoke website design for automotive workshops and dealerships — built to get more service bookings, enquiries and vehicle interest from local drivers.',
      'exp.kicker': 'Example experience',
      'exp.title': 'A better experience for your customers.',
      'exp.text': 'Make it easy for drivers to request a service, send vehicle details and photos, and get on your workshop diary — all from your website.',
      'ex.title': 'Automotive website designs that fit your business.',
      'ex.sub': 'Purpose-built layouts and messaging for automotive workshops and dealerships.',
      'ex.1.title': 'Mechanical servicing', 'ex.1.text': 'Drive more service bookings with a clear, trust-building website.',
      'ex.2.title': 'Tyres & wheels', 'ex.2.text': 'Showcase brands, sizes and fitment services with a high-converting website.',
      'ex.3.title': 'Vehicle sales', 'ex.3.text': 'Present your stock, capture enquiries and make it easy to get in touch.',
      'band.title': 'More than a website — a local partner for your automotive business.',
      'band.1': 'Target local drivers searching for services like logbook servicing, tyres, brakes and more.',
      'band.2': 'See what’s working with clear tracking of CTA clicks and submitted enquiries.',
      'band.3': 'Make it simple to book a service, call your workshop or send an enquiry from any device.',
      'band.4': 'Ongoing website care and updates from a {region}-based team that understands local business.',
      'cta.title': 'Get a plan for your business.',
      'cta.text': 'Tell us a little about your business and what you want your website to do, and we’ll come back with a clear plan.',
      'cta.button': 'Plan my automotive website'
    },
    goals: ['More service bookings', 'More vehicle enquiries', 'Show our services and brands', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'beauty', img: 'beauty', short: 'Hair & beauty', industry: 'Hair, beauty & aesthetics',
    tagline: 'Burgundy and blush, editorial', preview: 'linear-gradient(160deg,#f8eeec 0%,#d8a7a7 45%,#6e1a30 100%)',
    theme: { accent: '#7A1F35', dark: '#5E1729', bg: '#F8EFEC', ink: '#3A1620', muted: '#6E5459', line: '#E6D2CF', surface: '#FFFFFF', pipe: '#7A1F35', btnFg: '#FFFFFF', font: 'serif-light', hero: 'dark' },
    keywords: 'hair|beauty|salon|barber|skin|aesthetic|nail|lash|brow|spa|makeup|cosmetic',
    copy: {
      'nav.niche': 'Beauty, hair & aesthetics websites', 'nav.cta': 'Enquire',
      'hero.kicker': 'Beauty, hair & aesthetics websites',
      'hero.title': 'Turn a saved look into a salon booking.',
      'hero.sub': 'Bespoke website design for hair studios, beauty salons and skin clinics — beautifully branded, easy to manage and built to turn interest into bookings and enquiries.',
      'exp.kicker': 'The lookbook experience',
      'exp.title': 'Turn your style, services and team into bookings.',
      'exp.text': 'A curated, Instagram-style lookbook that lets clients explore a look, see the service, meet the stylist and send a booking enquiry — all in one smooth website experience.',
      'ex.title': 'Website design for your industry.',
      'ex.sub': '',
      'ex.1.title': 'Hair studios', 'ex.1.text': '', 'ex.2.title': 'Beauty salons', 'ex.2.text': '', 'ex.3.title': 'Skin clinics', 'ex.3.text': '',
      'band.title': 'Websites that work for beauty, hair & aesthetics.',
      'band.1': 'Target local clients with service-focused landing pages (e.g. hair colour, facials, skin treatments).',
      'band.2': 'See what’s working with tracking for key actions like CTA clicks and submitted enquiries.',
      'band.3': 'A seamless mobile experience to call, book or send an enquiry in just a tap.',
      'band.4': 'Friendly, ongoing support from a local {region} team to keep your site running smoothly as your business grows.',
      'cta.title': 'Let’s plan your salon website.',
      'cta.text': 'Tell us a little about your business and what you want your website to achieve. We’ll come back with a tailored next step for your salon, beauty or skin clinic.',
      'cta.button': 'Plan my salon website'
    },
    goals: ['More booking enquiries', 'Show our work and team', 'Promote services and offers', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'allied-health', img: 'allied', short: 'Allied health', industry: 'Allied health & psychology',
    tagline: 'Sage green, calm', preview: 'linear-gradient(160deg,#f7f4ee 0%,#a9b89a 45%,#4b5f3e 100%)',
    theme: { accent: '#4E6440', dark: '#4E6440', bg: '#F7F4EE', ink: '#1F2A1C', muted: '#59624F', line: '#DCD9CF', surface: '#E3E8DA', pipe: '#4E6440', btnFg: '#FFFFFF', font: 'serif', hero: 'dark' },
    keywords: 'psych|physio|health|clinic|therap|allied|counsel|chiro|osteo|dietit|podiat|medical|dental|occupational',
    copy: {
      'nav.niche': 'Allied health & psychology websites', 'nav.cta': 'Contact',
      'hero.kicker': 'Allied health & psychology websites',
      'hero.title': 'Help the right patients find your practice.',
      'hero.sub': 'Bespoke website design for allied health and psychology practices — professional, trustworthy and built around how your patients search, choose and book care.',
      'exp.kicker': 'Example experience',
      'exp.title': 'Make it easy for people to find the right support.',
      'exp.text': 'Include a clear practitioner finder so people can search your team by service, location and age group — then a simple, guided booking enquiry.',
      'ex.title': 'Allied health website design examples.',
      'ex.sub': '',
      'ex.1.title': 'Psychology', 'ex.1.text': '', 'ex.2.title': 'Physiotherapy', 'ex.2.text': '', 'ex.3.title': 'Occupational therapy', 'ex.3.text': '',
      'band.title': 'Why allied health practices choose {brand}.',
      'band.1': 'Target what people are searching for, such as ‘psychology in {region}’ or your key services.',
      'band.2': 'See what’s working with the metrics that matter: CTA clicks and submitted enquiries.',
      'band.3': 'A seamless experience on phone, with clear call, enquiry and location actions.',
      'band.4': 'Friendly, consistent support from our {region} team, so your website keeps working for your practice.',
      'cta.title': 'Let’s plan your practice website.',
      'cta.text': 'Tell us a little about your practice and what you’d like your website to achieve, and we’ll be in touch to plan the next steps.',
      'cta.button': 'Plan my practice website'
    },
    goals: ['More appointment enquiries', 'Help people find the right practitioner', 'Explain our services', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'fitness', img: 'fitness', short: 'Fitness & sport', industry: 'Fitness studios & sports clubs',
    tagline: 'Electric blue and yellow', preview: 'linear-gradient(160deg,#f3f4f8 0%,#eaf422 45%,#1a23c8 100%)',
    theme: { accent: '#EAF422', dark: '#14151C', bg: '#F4F5F9', ink: '#14151C', muted: '#545866', line: '#D9DCE5', surface: '#FFFFFF', pipe: '#1A23C8', btnFg: '#14151C', blue: '#1A23C8', font: 'heavy', hero: 'dark' },
    keywords: 'fitness|gym|pilates|yoga|crossfit|sport|club|training|personal train|martial|dance|swim',
    copy: {
      'nav.niche': 'Website designs', 'nav.cta': 'Get a website',
      'hero.kicker': 'Fitness & sport websites',
      'hero.title': 'Fill the next class with the right members.',
      'hero.sub': 'Bespoke website design for gyms, Pilates studios, training studios and sports clubs — built with LeadPages to attract local members, showcase your classes and turn interest into enquiries and bookings.',
      'exp.kicker': 'Example experience',
      'exp.title': 'Let members view classes and request their first session.',
      'exp.text': 'A clear, simple website experience that shows your timetable, highlights each class and makes it easy to request a first-session trial.',
      'ex.title': 'Website designs for your industry',
      'ex.sub': 'Professional, high-converting websites tailored to the fitness & sport sector.',
      'ex.1.title': 'Gyms', 'ex.1.text': '', 'ex.2.title': 'Pilates studios', 'ex.2.text': '', 'ex.3.title': 'Sports clubs', 'ex.3.text': '',
      'band.title': 'A local web partner for fitness & sport',
      'band.1': 'Target local searches for your classes, programs and memberships.',
      'band.2': 'See what’s working with tracking for key actions like CTA clicks and submitted enquiries.',
      'band.3': 'Make it easy for people on mobile to view classes, request a trial or send an enquiry.',
      'band.4': 'A {region}-based team for updates, improvements and long-term support as your business grows.',
      'cta.title': 'Plan your fitness website',
      'cta.text': 'Tell us about your business and what you want your website to do, and we’ll help you plan the right approach.',
      'cta.button': 'Plan my fitness website'
    },
    goals: ['More class enquiries', 'More trial sign-ups', 'Show our timetable', 'Replace an outdated website', 'Something else']
  },
  {
    id: 'real-estate', img: 'realestate', short: 'Real estate', industry: 'Real estate & property management',
    tagline: 'Charcoal and sand, refined', preview: 'linear-gradient(160deg,#f4eee5 0%,#e8d5b5 45%,#1c1a18 100%)',
    theme: { accent: '#E9D6B4', dark: '#1C1A18', bg: '#F4EEE5', ink: '#1C1A18', muted: '#5D564E', line: '#DDD3C4', surface: '#FFFFFF', pipe: '#7A6136', btnFg: '#1C1A18', font: 'serif', hero: 'dark' },
    keywords: 'real estate|property|realty|agent|appraisal|strata|rental|conveyanc|buyers agent|mortgage',
    copy: {
      'nav.niche': 'Real estate & property management websites', 'nav.cta': 'Plan my agency website',
      'hero.kicker': 'Real estate & property management websites',
      'hero.title': 'Turn local property searches into appraisal enquiries.',
      'hero.sub': 'Bespoke website design for real estate and property management businesses — built to attract local buyers, tenants and landlords, and convert them into appraisal enquiries for your agency.',
      'exp.kicker': 'Example experience',
      'exp.title': 'From local search to appraisal enquiry.',
      'exp.text': 'A simple, streamlined experience that helps people explore your local market and request a property appraisal, right from your website.',
      'ex.title': 'Real estate website design for every part of your business.',
      'ex.sub': '',
      'ex.1.title': 'Residential sales', 'ex.1.text': 'Showcase your listings, build local demand and generate more appraisal enquiries.',
      'ex.2.title': 'Property management', 'ex.2.text': 'Attract quality landlords and tenants with a clear, professional online presence.',
      'ex.3.title': 'Buyers agents', 'ex.3.text': 'Build trust with buyers, showcase your approach and capture qualified enquiries.',
      'band.title': 'More than a website — a local growth partner.',
      'band.1': 'Suburb and service pages tailored to real estate and property management searches in your local area.',
      'band.2': 'See what’s working with clear tracking for key actions, including CTA clicks (e.g. Request appraisal) and submitted enquiries.',
      'band.3': 'Make it easy for people to call, email or request an appraisal on the go.',
      'band.4': 'A responsive {region}-based team to keep your website running smoothly and aligned with your business needs.',
      'cta.title': 'Tell us about your business.',
      'cta.text': 'A quick enquiry to start a conversation about your new real estate or property management website.',
      'cta.button': 'Plan my agency website'
    },
    goals: ['More appraisal enquiries', 'Win more landlords', 'Show our listings and suburbs', 'Replace an outdated website', 'Something else']
  }
];

const NICHE_IDS = NICHES.map(function(n) { return n.id; });
function getNiche(id) { return NICHES.find(function(n) { return n.id === id; }) || null; }

module.exports = { NICHES, NICHE_IDS, getNiche, IMG, FEATURE_TITLES };
