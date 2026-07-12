/**
 * Web Culture test partner — Partner Website profile payload.
 * Applied via scripts/seed-web-culture-partner-profile.js (not hardcoded in theme).
 */

function buildWebCultureWebsiteProfile() {
  return {
    identity: {
      agencyName: 'Web Culture',
      headshotUrl: null,
      badgeStatus: 'leadpages-partner'
    },
    positioning: {
      heroEyebrow: 'YOUR CANBERRA WEBSITE PARTNER',
      heroHeadline: 'Websites for Canberra businesses, built to win business.',
      heroHighlight: 'built to win business',
      heroSupporting: 'Work directly with Web Culture to create a professional website that explains what you do, earns trust and turns visitors into genuine enquiries. Explore live demos before you commit, then launch on the complete LeadPages platform.',
      primaryCta: 'Plan my website',
      secondaryCta: 'Explore live demos',
      partnerPromise: 'Clear advice, a practical build process and a website designed around how your business actually wins customers.',
      localCredibilityStatement: 'Canberra-based support for local businesses, trades, service providers and growing teams across the ACT and surrounding region.',
      platformBackingStatement: 'Every Web Culture website is powered by LeadPages, bringing your website, hosting, lead capture, CRM, analytics and ongoing platform support together in one connected system.'
    },
    biography: {
      shortIntro: 'I help Canberra businesses turn their services, experience and reputation into websites that are clear, credible and built to generate enquiries.',
      fullBio: 'Web Culture works with Canberra business owners who need more than a good-looking website. We plan each website around the questions customers ask, the services they need and the actions that lead to a genuine enquiry.\n\nYou work directly with Shaun Matthews throughout the process. From the first conversation to launch, the focus stays on practical messaging, strong presentation and a customer journey that makes it easier for people to choose your business.\n\nWeb Culture is backed by the LeadPages platform, so your website is not an isolated one-off build. Your hosting, lead capture, CRM, analytics, backups and ongoing website tools form part of one connected system designed to grow with your business.',
      yearsExperience: '10+',
      professionalBackground: 'Business ownership, digital product development, local marketing, customer experience and practical lead-generation systems.',
      industriesWorked: 'Hospitality, trades, construction, professional services, events, training, retail, tourism and local service businesses.',
      whyPartner: 'I became a LeadPages Partner because small businesses should not have to coordinate a designer, developer, hosting company, form provider and CRM just to run an effective website. The platform gives clients one connected system, while I remain their local point of contact.',
      workingStyle: 'Straightforward, practical and collaborative. I explain the options clearly, focus on what will genuinely help the business and keep the process moving without unnecessary technical language.'
    },
    experience: {
      yearsInBusiness: '10+',
      industrySpecialisations: [
        'Trades', 'Hospitality', 'Professional services', 'Events and hire',
        'Construction', 'Local services', 'Tourism', 'Training', 'Small business'
      ]
    },
    location: {
      primarySuburb: 'Mitchell',
      state: 'ACT',
      country: 'Australia',
      serviceRegionHeadline: 'Serving Canberra and the surrounding region.',
      serviceAreas: [
        { label: 'Canberra' }, { label: 'Mitchell' }, { label: 'Gungahlin' },
        { label: 'Belconnen' }, { label: 'City and Inner North' }, { label: 'Woden' },
        { label: 'Weston Creek' }, { label: 'Tuggeranong' }, { label: 'Queanbeyan' },
        { label: 'Surrounding ACT and NSW region' }
      ],
      remoteAvailable: true,
      inPersonAvailable: true
    },
    contact: {
      primaryMethod: 'form',
      ctaLabel: 'Plan my website',
      responseTime: 'Usually within one business day',
      contactHours: 'Monday to Friday, 9:00am–5:00pm',
      bookingUrl: null
    },
    leadOffer: {
      enabled: true,
      title: 'Free website opportunity review',
      description: 'Share your current website and tell us what you would like to improve. We will review the messaging, mobile experience, calls to action and the opportunities to generate more enquiries.',
      ctaLabel: 'Request review'
    },
    enquiryForm: {
      showExtended: true
    },
    social: {
      googleBusiness: null,
      linkedin: null,
      facebook: null,
      instagram: null
    },
    seo: {
      titleOverride: 'Web Design Canberra | Web Culture — LeadPages Partner',
      descriptionOverride: 'Work directly with Web Culture to plan and launch a professional website for your Canberra business. Explore live demos, generate more enquiries and access the complete LeadPages platform.',
      ogImage: null
    },
    visibility: {
      hero: true,
      trust: true,
      industries: true,
      demos: true,
      services: true,
      included: true,
      process: true,
      caseStudies: false,
      biography: true,
      serviceArea: true,
      platformBacking: true,
      testimonials: true,
      faqs: true,
      leadOffer: true,
      contact: true
    },
    serviceSelections: [
      { serviceKey: 'new-websites', enabled: true, featured: true, personalNote: 'Professional websites for new businesses that need a strong foundation, clear services and a credible online presence.' },
      { serviceKey: 'redesigns', enabled: true, featured: true, personalNote: 'Replace an outdated or confusing website with a modern design, clearer messaging and a better customer journey.' },
      { serviceKey: 'landing-pages', enabled: true, featured: true, personalNote: 'Focused campaign pages designed around one audience, one offer and one clear action.' },
      { serviceKey: 'lead-gen', enabled: true, featured: true, personalNote: 'Service-area websites structured to explain what you do, build local trust and generate enquiries.' },
      { serviceKey: 'ecommerce', enabled: false, featured: false },
      { serviceKey: 'booking', enabled: true, featured: true, personalNote: 'Let customers request appointments, consultations, events or services without relying on back-and-forth messages.' },
      { serviceKey: 'quote-forms', enabled: true, featured: true, personalNote: 'Collect the information needed to qualify a potential customer and respond with greater speed and accuracy.' },
      { serviceKey: 'crm', enabled: true, featured: true, personalNote: 'Send website leads into a connected CRM so enquiries, follow-ups and customer activity are easier to manage.' },
      { serviceKey: 'calculators', enabled: false, featured: false },
      { serviceKey: 'seo-content', enabled: true, featured: true, personalNote: 'Clear service and location content designed for search visibility without stuffing pages with repetitive keywords.' },
      { serviceKey: 'care-support', enabled: true, featured: true, personalNote: 'Ongoing updates, platform support, backups and practical help after launch.' },
      { serviceKey: 'branding', enabled: false, featured: false }
    ],
    testimonials: [
      {
        id: 'wc-platform-1',
        customerName: 'LeadPages business owner',
        businessName: 'LeadPages platform client',
        role: 'Small business owner',
        location: 'Australia',
        text: 'The process gave us a much clearer way to present our services and capture enquiries. Having the website and lead system connected made the finished result far more useful than a standalone website.',
        status: 'approved',
        featured: true,
        isPlatform: true
      },
      {
        id: 'wc-platform-2',
        customerName: 'LeadPages customer',
        businessName: 'Local service business',
        role: 'Business owner',
        location: 'Australia',
        text: 'We could see the website direction before launch, understand how customers would move through it and work with one contact throughout the build.',
        status: 'approved',
        featured: false,
        isPlatform: true
      }
    ],
    caseStudies: [],
    partnerFaqs: [
      { question: 'How much does a business website cost?', answer: 'The right investment depends on the number of pages, required content, integrations and whether your business needs features such as bookings, ecommerce, calculators or advanced quote forms. We begin with a short conversation and recommend a practical scope based on what the website needs to achieve.', enabled: true, sortOrder: 1 },
      { question: 'How long does a website take to build?', answer: 'A standard business website can often be ready for review within two to four weeks after the required content and approvals are supplied. Larger websites, custom systems and ecommerce projects may take longer. We confirm the expected timeframe before work begins.', enabled: true, sortOrder: 2 },
      { question: 'Can you rebuild my existing website?', answer: 'Yes. We can review your current website, retain useful content and rebuild the experience with clearer messaging, better mobile presentation and stronger enquiry pathways.', enabled: true, sortOrder: 3 },
      { question: 'Can I use my existing domain?', answer: 'Yes. Your existing domain can normally be connected to the new website. We will confirm how it is currently managed and guide you through any required DNS changes.', enabled: true, sortOrder: 4 },
      { question: 'Is hosting included?', answer: 'LeadPages hosting and platform infrastructure form part of the ongoing website service. Your proposal will clearly explain the build cost, ongoing fees and what is included.', enabled: true, sortOrder: 5 },
      { question: 'Will the website work on mobile?', answer: 'Yes. Every website is designed and tested for desktop, tablet and mobile use. Mobile layouts are treated as a core part of the build, not an optional extra.', enabled: true, sortOrder: 6 },
      { question: 'Can I update the website myself?', answer: 'The available editing tools depend on your account and website configuration. We can explain what you can manage directly and what you may prefer Web Culture to update for you.', enabled: true, sortOrder: 7 },
      { question: 'Do you help write the content?', answer: 'Yes. We can help structure your messaging, improve supplied copy and identify missing information. Larger copywriting requirements can be included in the project scope.', enabled: true, sortOrder: 8 },
      { question: 'Is SEO included?', answer: 'Every website includes a sound technical and structural foundation. Broader SEO work, ongoing content and competitive local search campaigns may require an additional strategy.', enabled: true, sortOrder: 9 },
      { question: 'Can the website collect quote requests?', answer: 'Yes. We can create simple contact forms or more detailed quote forms that collect the information your business needs before following up.', enabled: true, sortOrder: 10 },
      { question: 'Can you add bookings or ecommerce?', answer: 'Yes, where the business and project are suitable. Booking, payment and ecommerce requirements are reviewed during planning so the correct system can be recommended.', enabled: true, sortOrder: 11 },
      { question: 'What happens after launch?', answer: 'Web Culture remains your local point of contact, while LeadPages provides the platform, hosting infrastructure, backups and central technical support behind the website.', enabled: true, sortOrder: 12 },
      { question: 'Who owns my business content?', answer: 'Your business retains ownership of the content and assets it supplies, subject to any third-party licensing arrangements. Your proposal and service terms will explain platform access, hosting and cancellation conditions.', enabled: true, sortOrder: 13 },
      { question: 'What happens if my partner is unavailable?', answer: 'LeadPages provides central platform support and can assist with continuity or reassignment where required under the partner program.', enabled: true, sortOrder: 14 },
      { question: 'Can my website grow later?', answer: 'Yes. The platform is designed to support additional pages, campaigns, forms and connected systems as your business requirements expand.', enabled: true, sortOrder: 15 }
    ],
    metrics: {}
  };
}

function buildWebCultureShowcasePatch() {
  return {
    showcase_headline: 'Websites for Canberra businesses, built to win business.',
    showcase_config: {
      intro: 'Work directly with Web Culture to create a professional website that explains what you do, earns trust and turns visitors into genuine enquiries.',
      templateKey: 'causehouse',
      accent: '#bfea4b',
      theme: { hivis: '#bfea4b', pipe: '#bfea4b', steel: '#183525', lightBg: '#f4ebdd' }
    }
  };
}

module.exports = {
  buildWebCultureWebsiteProfile,
  buildWebCultureShowcasePatch
};
