/**
 * Culture partner page starter content — pre-fills the edit panel from
 * current Culture demo copy, personalised to the partner's name/region.
 * Powered-by LeadPages trust/footer stays platform-locked (not toggleable).
 */
const { applyTemplate, firstName } = require('./defaults');

function isSparseWebsiteProfile(wp) {
  wp = wp || {};
  const pos = wp.positioning || {};
  const bio = wp.biography || {};
  const hasHero = !!(pos.heroHeadline || pos.heroSupporting);
  const hasBio = !!(bio.shortIntro || bio.fullBio);
  const hasServices = Array.isArray(wp.serviceSelections) && wp.serviceSelections.some(function(s) { return s && s.enabled; });
  const hasFaqs = Array.isArray(wp.partnerFaqs) && wp.partnerFaqs.length > 0;
  return !hasHero && !hasBio && !hasServices && !hasFaqs;
}

function buildCultureStarterProfile(partner, directory) {
  partner = partner || {};
  directory = directory || {};
  const agency = String(partner.display_name || directory.business_name || 'Your Agency').trim() || 'Your Agency';
  const first = firstName(agency) || agency.split(/\s+/)[0] || 'your partner';
  const region = String(directory.region || directory.suburb || directory.service_area || 'your area').trim() || 'your area';
  const phone = String(partner.phone || directory.phone || '').trim();
  const email = String(partner.email || directory.email || '').trim();

  return {
    identity: {
      agencyName: agency,
      badgeStatus: 'leadpages-partner'
    },
    contact: {
      phonePublic: phone,
      emailPublic: email,
      ctaLabel: 'Plan My Website',
      responseTime: 'Usually within one business day',
      contactHours: 'Weekdays'
    },
    location: {
      serviceRegionHeadline: region,
      primarySuburb: region.split(/[,&]/)[0].trim() || region,
      serviceAreas: [{ label: region }],
      remoteAvailable: true,
      inPersonAvailable: true
    },
    positioning: {
      heroEyebrow: 'YOUR LOCAL LEADPAGES PARTNER',
      heroHeadline: 'Websites that work harder for your business.',
      heroHighlight: 'work harder',
      heroSupporting: applyTemplate(
        '{{agencyName}} creates a professional website that generates enquiries, with live demos on the LeadPages platform and local support every step of the way.',
        { agencyName: agency }
      ),
      primaryCta: 'Explore Live Demos',
      secondaryCta: 'Plan My Website',
      partnerPromise: 'Clear advice, a practical build, and a website designed around how your business actually wins customers.',
      localCredibilityStatement: applyTemplate(
        'Work directly with {{firstName}} — local planning and personal guidance across {{serviceRegion}}.',
        { firstName: first, serviceRegion: region }
      ),
      platformBackingStatement: applyTemplate(
        'Every {{agencyName}} website is powered by LeadPages — website, hosting, lead capture, CRM, analytics and ongoing platform support in one connected system.',
        { agencyName: agency }
      )
    },
    biography: {
      shortIntro: applyTemplate(
        '{{agencyName}} helps local businesses launch LeadPages websites that look sharp and capture real enquiries.',
        { agencyName: agency }
      ),
      fullBio: applyTemplate(
        '{{agencyName}} works with business owners who need more than a good-looking website. We plan each build around the questions customers ask, the services they need, and the actions that lead to a genuine enquiry.\n\nYou work directly with {{firstName}} from the first conversation to launch. Backed by the LeadPages platform, your site sits inside one connected system — hosting, lead capture, CRM, analytics and ongoing tools designed to grow with your business.',
        { agencyName: agency, firstName: first }
      ),
      yearsExperience: '',
      professionalBackground: 'Local LeadPages partner',
      whyPartner: 'Practical messaging, strong presentation, and a customer journey that makes it easier for people to choose your business.',
      workingStyle: 'Straightforward, practical and collaborative.',
      industriesWorked: 'Trades, hospitality, local services'
    },
    experience: {
      yearsInBusiness: '',
      yearsInWeb: '',
      industrySpecialisations: ['Trades', 'Local services']
    },
    leadOffer: {
      enabled: true,
      title: 'Free website review',
      description: 'A quick look at what’s working, what’s missing, and a clear next step for your site.'
    },
    enquiryForm: {
      showExtended: true
    },
    social: {},
    seo: {},
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
      { serviceKey: 'new-websites', enabled: true, featured: true, personalNote: 'A polished site built around how you actually win work.' },
      { serviceKey: 'lead-gen', enabled: true, featured: true, personalNote: 'Forms and flows that turn visitors into booked conversations.' },
      { serviceKey: 'crm', enabled: true, featured: false, personalNote: 'Keep enquiries organised so nothing slips.' },
      { serviceKey: 'seo-content', enabled: true, featured: false, personalNote: 'Clear service and location content without stuffing.' },
      { serviceKey: 'care-support', enabled: true, featured: false, personalNote: 'Ongoing updates and partner support after launch.' }
    ],
    testimonials: [
      {
        customerName: 'Sam P.',
        businessName: 'Local trade',
        role: 'Owner',
        location: region,
        text: 'The process gave us a clearer way to present our services and capture enquiries. Having the website and lead system connected made the finished result far more useful.',
        featured: true,
        status: 'approved'
      }
    ],
    caseStudies: [],
    partnerFaqs: [
      {
        question: 'Can this website be customised for my business?',
        answer: applyTemplate(
          'Yes. {{agencyName}} adapts layout, copy, colours and services so the site matches how you win customers in {{serviceRegion}}.',
          { agencyName: agency, serviceRegion: region }
        ),
        enabled: true
      },
      {
        question: 'Is this powered by LeadPages?',
        answer: 'Yes — every partner website sits on the LeadPages platform for hosting, lead capture, CRM tools and ongoing support.',
        enabled: true
      }
    ],
    metrics: []
  };
}

module.exports = {
  isSparseWebsiteProfile,
  buildCultureStarterProfile
};
