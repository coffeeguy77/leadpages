/**
 * Partner Website profile validation and normalisation.
 */

function cleanStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max || 500);
}

function cleanUrl(v) {
  const s = cleanStr(v, 400);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
  return null;
}

function cleanEmail(v) {
  const s = cleanStr(v, 200);
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function cleanPhone(v) {
  const s = cleanStr(v, 60);
  if (!s) return null;
  return s;
}

function cleanHex(v) {
  return /^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : null;
}

function cleanBool(v) {
  return !!v;
}

function cleanArray(arr, max, mapper) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max || 50).map(mapper).filter(Boolean);
}

function cleanServiceAreas(areas) {
  return cleanArray(areas, 24, function(a) {
    if (typeof a === 'string') {
      const label = cleanStr(a, 80);
      return label ? { label } : null;
    }
    if (a && typeof a === 'object') {
      const label = cleanStr(a.label || a.name, 80);
      return label ? { label } : null;
    }
    return null;
  });
}

function cleanServiceSelections(list) {
  return cleanArray(list, 30, function(s) {
    if (!s || !s.serviceKey) return null;
    return {
      serviceKey: cleanStr(s.serviceKey, 60),
      enabled: s.enabled !== false,
      featured: !!s.featured,
      sortOrder: Number(s.sortOrder) || 0,
      personalNote: cleanStr(s.personalNote, 200),
      priceLabel: cleanStr(s.priceLabel, 80),
      ctaTarget: cleanStr(s.ctaTarget, 40) || 'contact'
    };
  });
}

function cleanTestimonials(list) {
  return cleanArray(list, 20, function(t) {
    if (!t || !cleanStr(t.text, 800)) return null;
    return {
      id: cleanStr(t.id, 40) || ('t-' + Math.random().toString(36).slice(2, 10)),
      customerName: cleanStr(t.customerName, 120),
      businessName: cleanStr(t.businessName, 160),
      role: cleanStr(t.role, 80),
      location: cleanStr(t.location, 80),
      text: cleanStr(t.text, 800),
      photoUrl: cleanUrl(t.photoUrl),
      logoUrl: cleanUrl(t.logoUrl),
      websiteUrl: cleanUrl(t.websiteUrl),
      relatedProject: cleanStr(t.relatedProject, 120),
      status: ['draft', 'approved', 'rejected'].indexOf(t.status) >= 0 ? t.status : 'draft',
      featured: !!t.featured,
      sortOrder: Number(t.sortOrder) || 0
    };
  });
}

function cleanCaseStudies(list) {
  return cleanArray(list, 12, function(c) {
    if (!c || !cleanStr(c.clientName || c.projectName, 160)) return null;
    return {
      id: cleanStr(c.id, 40) || ('c-' + Math.random().toString(36).slice(2, 10)),
      clientName: cleanStr(c.clientName || c.projectName, 160),
      industry: cleanStr(c.industry, 80),
      challenge: cleanStr(c.challenge, 600),
      solution: cleanStr(c.solution, 600),
      features: cleanStr(c.features, 400),
      result: cleanStr(c.result, 400),
      beforeImage: cleanUrl(c.beforeImage),
      afterImage: cleanUrl(c.afterImage),
      websiteUrl: cleanUrl(c.websiteUrl),
      featured: !!c.featured,
      status: ['draft', 'approved', 'rejected'].indexOf(c.status) >= 0 ? c.status : 'draft',
      sortOrder: Number(c.sortOrder) || 0
    };
  });
}

function cleanFaqs(list) {
  return cleanArray(list, 30, function(f) {
    if (!f || !cleanStr(f.question, 200) || !cleanStr(f.answer, 1200)) return null;
    return {
      id: cleanStr(f.id, 40) || ('f-' + Math.random().toString(36).slice(2, 10)),
      question: cleanStr(f.question, 200),
      answer: cleanStr(f.answer, 1200),
      enabled: f.enabled !== false,
      sortOrder: Number(f.sortOrder) || 0,
      isPartner: !!f.isPartner
    };
  });
}

function validateWebsiteProfile(input) {
  input = input && typeof input === 'object' ? input : {};
  const identity = input.identity || {};
  const contact = input.contact || {};
  const location = input.location || {};
  const biography = input.biography || {};
  const experience = input.experience || {};
  const positioning = input.positioning || {};
  const social = input.social || {};
  const seo = input.seo || {};
  const leadOffer = input.leadOffer || {};
  const enquiryForm = input.enquiryForm || {};
  const visibility = input.visibility || {};
  const metrics = input.metrics || {};

  return {
    identity: {
      agencyName: cleanStr(identity.agencyName, 160),
      headshotUrl: cleanUrl(identity.headshotUrl),
      badgeStatus: cleanStr(identity.badgeStatus, 40) || 'leadpages-partner'
    },
    contact: {
      primaryMethod: ['email', 'phone', 'form', 'booking'].indexOf(contact.primaryMethod) >= 0 ? contact.primaryMethod : 'form',
      ctaLabel: cleanStr(contact.ctaLabel, 60),
      contactHours: cleanStr(contact.contactHours, 120),
      responseTime: cleanStr(contact.responseTime, 80),
      bookingUrl: cleanUrl(contact.bookingUrl)
    },
    location: {
      primarySuburb: cleanStr(location.primarySuburb, 80),
      state: cleanStr(location.state, 10),
      country: cleanStr(location.country, 60) || 'Australia',
      serviceRegionHeadline: cleanStr(location.serviceRegionHeadline, 120),
      serviceAreas: cleanServiceAreas(location.serviceAreas),
      remoteAvailable: cleanBool(location.remoteAvailable),
      inPersonAvailable: location.inPersonAvailable !== false,
      showMap: cleanBool(location.showMap)
    },
    biography: {
      shortIntro: cleanStr(biography.shortIntro, 240),
      fullBio: cleanStr(biography.fullBio, 1200),
      yearsExperience: cleanStr(biography.yearsExperience, 40),
      professionalBackground: cleanStr(biography.professionalBackground, 400),
      industriesWorked: cleanStr(biography.industriesWorked, 300),
      whyPartner: cleanStr(biography.whyPartner, 600),
      enjoyHelping: cleanStr(biography.enjoyHelping, 400),
      workingStyle: cleanStr(biography.workingStyle, 500),
      languages: cleanStr(biography.languages, 120),
      qualifications: cleanStr(biography.qualifications, 300),
      memberships: cleanStr(biography.memberships, 300),
      personalFact: cleanStr(biography.personalFact, 200)
    },
    experience: {
      yearsInBusiness: cleanStr(experience.yearsInBusiness, 40),
      yearsInWeb: cleanStr(experience.yearsInWeb, 40),
      projectsCompleted: cleanStr(experience.projectsCompleted, 20),
      businessesSupported: cleanStr(experience.businessesSupported, 20),
      keySkills: cleanStr(experience.keySkills, 300),
      industrySpecialisations: cleanArray(experience.industrySpecialisations, 12, function(x) { return cleanStr(x, 80); }),
      preferredClientTypes: cleanStr(experience.preferredClientTypes, 200),
      businessSizes: cleanStr(experience.businessSizes, 120)
    },
    positioning: {
      heroEyebrow: cleanStr(positioning.heroEyebrow, 80),
      heroHeadline: cleanStr(positioning.heroHeadline, 120),
      heroHighlight: cleanStr(positioning.heroHighlight, 80),
      heroSupporting: cleanStr(positioning.heroSupporting, 400),
      primaryCta: cleanStr(positioning.primaryCta, 40),
      secondaryCta: cleanStr(positioning.secondaryCta, 40),
      partnerPromise: cleanStr(positioning.partnerPromise, 200),
      personalServiceStatement: cleanStr(positioning.personalServiceStatement, 300),
      localCredibilityStatement: cleanStr(positioning.localCredibilityStatement, 300),
      platformBackingStatement: cleanStr(positioning.platformBackingStatement, 400)
    },
    social: {
      googleBusiness: cleanUrl(social.googleBusiness),
      linkedin: cleanUrl(social.linkedin),
      facebook: cleanUrl(social.facebook),
      instagram: cleanUrl(social.instagram)
    },
    seo: {
      titleOverride: cleanStr(seo.titleOverride, 80),
      descriptionOverride: cleanStr(seo.descriptionOverride, 200),
      ogImage: cleanUrl(seo.ogImage)
    },
    leadOffer: {
      enabled: cleanBool(leadOffer.enabled),
      title: cleanStr(leadOffer.title, 80) || 'Free website review',
      description: cleanStr(leadOffer.description, 400),
      ctaLabel: cleanStr(leadOffer.ctaLabel, 40) || 'Request review',
      formSubject: cleanStr(leadOffer.formSubject, 80) || 'Free website review',
      confirmationMessage: cleanStr(leadOffer.confirmationMessage, 200)
    },
    enquiryForm: {
      showExtended: enquiryForm.showExtended !== false,
      goals: cleanArray(enquiryForm.goals, 12, function(x) { return cleanStr(x, 80); }),
      features: cleanArray(enquiryForm.features, 12, function(x) { return cleanStr(x, 80); })
    },
    visibility: {
      hero: visibility.hero !== false,
      trust: visibility.trust !== false,
      industries: visibility.industries !== false,
      demos: visibility.demos !== false,
      services: visibility.services !== false,
      included: visibility.included !== false,
      process: visibility.process !== false,
      caseStudies: visibility.caseStudies !== false,
      biography: visibility.biography !== false,
      serviceArea: visibility.serviceArea !== false,
      platformBacking: visibility.platformBacking !== false,
      testimonials: visibility.testimonials !== false,
      faqs: visibility.faqs !== false,
      leadOffer: visibility.leadOffer !== false,
      contact: visibility.contact !== false
    },
    serviceSelections: cleanServiceSelections(input.serviceSelections),
    testimonials: cleanTestimonials(input.testimonials),
    caseStudies: cleanCaseStudies(input.caseStudies),
    partnerFaqs: cleanFaqs(input.partnerFaqs),
    metrics: {
      partnerProjectsCompleted: cleanStr(metrics.partnerProjectsCompleted, 20),
      partnerBusinessesSupported: cleanStr(metrics.partnerBusinessesSupported, 20),
      typicalResponseTime: cleanStr(metrics.typicalResponseTime, 40)
    }
  };
}

function mergeWebsiteProfilePatch(existing, patch) {
  existing = existing && typeof existing === 'object' ? existing : {};
  const validated = validateWebsiteProfile(Object.assign({}, existing, patch));
  return validated;
}

module.exports = {
  validateWebsiteProfile,
  mergeWebsiteProfilePatch,
  cleanStr,
  cleanUrl,
  cleanEmail,
  cleanPhone
};
