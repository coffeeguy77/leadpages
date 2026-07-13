/**
 * Partner Website content resolver — single source of truth for all themes.
 */

const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('./validate');
const { extractLogoValue, normalizeLogoForStorage } = require('./logo');
const { normaliseDemos } = require('./demo-cards');
const {
  firstName, primaryRegion, serviceRegionLabel,
  buildDefaultPositioning, buildDefaultBiography, applyTemplate
} = require('./defaults');
const {
  publicFirstName, publicPartnerIntro, publicPartnerLabel
} = require('./public-identity');
const {
  PLATFORM_SERVICES, PLATFORM_FAQS, PLATFORM_PROCESS,
  PLATFORM_TESTIMONIALS, PLATFORM_BENEFITS, ENQUIRY_GOALS, ENQUIRY_FEATURES
} = require('./platform-defaults');
const { buildSeoMeta } = require('./seo');
const { resolvePartnerLogo } = require('./logo');

function resolveShowcaseLogo(cfg) {
  return resolvePartnerLogo({ showcaseConfig: cfg || {} });
}

function pickPositioning(raw, defaults) {
  const out = Object.assign({}, defaults);
  if (!raw) return out;
  Object.keys(out).forEach(function(k) {
    if (raw[k]) out[k] = raw[k];
  });
  return out;
}

function resolveServices(selections) {
  const map = {};
  (selections || []).forEach(function(s) { map[s.serviceKey] = s; });
  const hasExplicit = (selections || []).length > 0;
  return PLATFORM_SERVICES.map(function(def, i) {
    const sel = map[def.key];
    let enabled;
    if (hasExplicit) {
      if (!sel) return null;
      enabled = sel.enabled !== false;
    } else {
      enabled = def.featured !== false;
    }
    if (!enabled) return null;
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      personalNote: (sel && sel.personalNote) || '',
      featured: !!(sel && sel.featured) || !!def.featured,
      priceLabel: (sel && sel.priceLabel) || 'Quote required',
      ctaTarget: (sel && sel.ctaTarget) || 'contact',
      sortOrder: sel && sel.sortOrder != null ? sel.sortOrder : i
    };
  }).filter(Boolean).sort(function(a, b) { return a.sortOrder - b.sortOrder; });
}

function resolveFaqs(partnerFaqs, enabledPlatform) {
  const out = [];
  const pf = (partnerFaqs || []).filter(function(f) { return f.enabled !== false; });
  pf.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
  pf.forEach(function(f) {
    out.push({ question: f.question, answer: f.answer, isPartner: true });
  });
  PLATFORM_FAQS.forEach(function(f, i) {
    if (enabledPlatform === false) return;
    out.push({ question: f.question, answer: f.answer, isPartner: false, locked: f.locked });
  });
  return out;
}

function resolveTestimonials(partnerTestimonials) {
  const approved = (partnerTestimonials || [])
    .filter(function(t) { return t.status === 'approved' && t.text; })
    .sort(function(a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.sortOrder || 0) - (b.sortOrder || 0); });
  if (approved.length) {
    return approved.map(function(t) {
      const platformClient = t.isPlatform === true
        || /leadpages\s+platform/i.test(String(t.businessName || ''))
        || /^wc-platform-/i.test(String(t.id || ''));
      return {
        customerName: t.customerName,
        businessName: t.businessName,
        role: t.role,
        location: t.location,
        text: t.text,
        photoUrl: t.photoUrl,
        logoUrl: t.logoUrl,
        isPlatform: platformClient,
        featured: !!t.featured
      };
    });
  }
  return PLATFORM_TESTIMONIALS.map(function(t, i) {
    return {
      customerName: t.customerName,
      businessName: t.businessName,
      role: t.role,
      location: t.location,
      text: t.text,
      isPlatform: true,
      attribution: t.attribution,
      featured: i === 0
    };
  });
}

function resolveCaseStudies(list) {
  return (list || [])
    .filter(function(c) { return c.status === 'approved'; })
    .sort(function(a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.sortOrder || 0) - (b.sortOrder || 0); });
}

function resolveMetrics(raw, demos) {
  const m = {};
  if (raw && raw.partnerProjectsCompleted) m.partnerProjectsCompleted = raw.partnerProjectsCompleted;
  if (raw && raw.partnerBusinessesSupported) m.partnerBusinessesSupported = raw.partnerBusinessesSupported;
  if (raw && raw.typicalResponseTime) m.typicalResponseTime = raw.typicalResponseTime;
  else if (raw && raw.responseTime) m.typicalResponseTime = raw.responseTime;
  if (!m.partnerProjectsCompleted && demos.length) m.partnerProjectsCompleted = String(demos.length) + '+';
  return m;
}

function migrateLegacyToProfile(prof, partner, directory) {
  const cfg = (prof && prof.showcase_config) || {};
  const wp = (prof && prof.website_profile) || cfg.websiteProfile || {};
  const merged = validateWebsiteProfile(wp);

  if (!merged.biography.shortIntro && cfg.intro) merged.biography.shortIntro = String(cfg.intro).slice(0, 240);
  if (!merged.biography.shortIntro && prof.bio) merged.biography.shortIntro = String(prof.bio).slice(0, 240);
  if (!merged.biography.fullBio && prof.bio) merged.biography.fullBio = String(prof.bio).slice(0, 1200);
  if (!merged.identity.agencyName && directory && directory.business_name) merged.identity.agencyName = directory.business_name;
  if (!merged.identity.headshotUrl && directory && directory.photo_url) merged.identity.headshotUrl = directory.photo_url;
  if (!merged.identity.logoUrl) {
    const fromShowcase = extractLogoValue(cfg.logo);
    if (fromShowcase) merged.identity.logoUrl = fromShowcase;
  }
  if (!merged.location.primarySuburb && directory && directory.suburb) merged.location.primarySuburb = directory.suburb;
  if (!merged.location.state && directory && directory.state) merged.location.state = directory.state;
  if (!merged.location.serviceAreas.length && directory && directory.suburb) {
    merged.location.serviceAreas = [{ label: directory.suburb }];
  }
  if (!merged.location.serviceAreas.length && prof.region) {
    prof.region.split(/[,&]/).forEach(function(part) {
      const label = part.trim();
      if (label) merged.location.serviceAreas.push({ label: label });
    });
  }
  if (!merged.experience.industrySpecialisations.length && directory && directory.specialties) {
    merged.experience.industrySpecialisations = directory.specialties.slice(0, 8);
  }
  if (!merged.positioning.heroHeadline && prof.showcase_headline) {
    merged.positioning.heroHeadline = prof.showcase_headline;
  }
  if (!merged.positioning.heroSupporting && cfg.intro) {
    merged.positioning.heroSupporting = String(cfg.intro).slice(0, 400);
  }

  return merged;
}

function resolvePartnerThemeContent(input) {
  input = input || {};
  const prof = input.prof || {};
  const partner = input.partner || {};
  const directory = input.directory || null;
  const demos = input.demos || [];
  const base = input.base || 'leadpages.com.au';
  const home = input.home || null;
  const cfg = prof.showcase_config || {};

  const wp = migrateLegacyToProfile(prof, partner, directory);
  const displayName = String(partner.display_name || prof.support_name || 'Your local partner').trim();
  const agencyName = wp.identity.agencyName || displayName;
  const fn = publicFirstName(displayName, wp.identity);
  const publicIntro = publicPartnerIntro(agencyName, displayName, wp.identity);
  const publicName = publicPartnerLabel(displayName, agencyName, wp.identity);
  const region = primaryRegion(wp.location, prof, directory);
  const serviceRegion = serviceRegionLabel(wp.location) || region;
  const suburb = (wp.location && wp.location.primarySuburb) || (directory && directory.suburb) || region;

  const vars = {
    partnerDisplayName: publicName,
    firstName: fn || 'your partner',
    agencyName: agencyName,
    primaryRegion: region,
    primarySuburb: suburb,
    serviceRegion: serviceRegion
  };

  const defaultPos = buildDefaultPositioning(vars);
  const positioning = pickPositioning(wp.positioning, defaultPos);

  const heroHeadline = positioning.heroHeadline || prof.showcase_headline || defaultPos.heroHeadline;
  const heroSupporting = applyTemplate(
    positioning.heroSupporting || cfg.intro || defaultPos.heroSupporting,
    vars
  );

  const email = prof.support_email || (directory && directory.email) || partner.email || '';
  const phone = prof.support_phone || (directory && directory.phone) || partner.phone || '';

  const demoCards = normaliseDemos(demos, base);
  const services = resolveServices(wp.serviceSelections);
  const testimonials = resolveTestimonials(wp.testimonials);
  const caseStudies = resolveCaseStudies(wp.caseStudies);
  const faqs = resolveFaqs(wp.partnerFaqs, wp.visibility.faqs !== false);
  const metrics = resolveMetrics(Object.assign({}, wp.metrics, wp.contact), demoCards);

  const industries = (wp.experience.industrySpecialisations || []).slice(0, 12);
  if (!industries.length && directory && directory.specialties) {
    directory.specialties.forEach(function(s) { industries.push(s); });
  }

  const biography = {
    shortIntro: wp.biography.shortIntro || heroSupporting.slice(0, 240),
    fullBio: wp.biography.fullBio || buildDefaultBiography(vars, wp.experience),
    yearsExperience: wp.biography.yearsExperience,
    professionalBackground: wp.biography.professionalBackground,
    industriesWorked: wp.biography.industriesWorked,
    whyPartner: wp.biography.whyPartner,
    enjoyHelping: wp.biography.enjoyHelping,
    workingStyle: wp.biography.workingStyle,
    languages: wp.biography.languages,
    qualifications: wp.biography.qualifications,
    memberships: wp.biography.memberships,
    personalFact: wp.biography.personalFact
  };

  const content = {
    partner: {
      displayName: displayName,
      publicName: publicName,
      agencyName: agencyName,
      firstName: fn || 'your partner',
      publicIntro: publicIntro,
      displaySurnamePublicly: wp.identity.displaySurnamePublicly === true,
      headshotUrl: wp.identity.headshotUrl || null,
      logoUrl: resolvePartnerLogo({ showcaseConfig: cfg, identity: wp.identity }),
      logoSize: cfg.logoSize || 1,
      badgeStatus: wp.identity.badgeStatus || 'leadpages-partner'
    },
    hero: {
      eyebrow: positioning.heroEyebrow || defaultPos.heroEyebrow,
      headline: heroHeadline,
      highlightedPhrase: positioning.heroHighlight || defaultPos.heroHighlight,
      supportingText: heroSupporting,
      primaryCta: positioning.primaryCta || defaultPos.primaryCta,
      secondaryCta: positioning.secondaryCta || defaultPos.secondaryCta,
      primaryCtaHref: wp.contact.bookingUrl || '#contact',
      secondaryCtaHref: demoCards.length ? '#demos' : '#contact'
    },
    trust: [
      { label: 'Local partner', value: publicName },
      { label: 'Live website demos', value: demoCards.length ? demoCards.length + '+ sites' : 'Available' },
      { label: 'LeadPages-backed platform', value: 'Secure hosting' },
      { label: 'Direct personal support', value: wp.contact.responseTime || 'Personal contact' }
    ].filter(function(t) { return t.value; }),
    biography: biography,
    contact: {
      email: email,
      phone: phone,
      primaryMethod: wp.contact.primaryMethod || 'form',
      ctaLabel: wp.contact.ctaLabel || positioning.primaryCta || 'Plan my website',
      contactHours: wp.contact.contactHours,
      responseTime: wp.contact.responseTime,
      bookingUrl: wp.contact.bookingUrl
    },
    serviceArea: {
      headline: wp.location.serviceRegionHeadline || ('Serving ' + serviceRegion),
      primaryRegion: region,
      primarySuburb: suburb,
      areas: wp.location.serviceAreas || [],
      state: wp.location.state,
      country: wp.location.country || 'Australia',
      remoteAvailable: wp.location.remoteAvailable,
      inPersonAvailable: wp.location.inPersonAvailable,
      showMap: wp.location.showMap
    },
    industries: industries,
    services: services,
    demos: demoCards,
    testimonials: testimonials,
    caseStudies: caseStudies,
    process: PLATFORM_PROCESS.map(function(p, i) {
      return { step: p.step, title: p.title, description: p.description };
    }),
    platformBacking: {
      heading: 'Local service. Platform-backed delivery.',
      copy: positioning.platformBackingStatement || defaultPos.platformBackingStatement,
      bullets: [
        'Your partner is your main contact for strategy, content, and website setup.',
        'LeadPages provides hosting, security, backups, and platform support.',
        'Your business account and data remain attached to your business.',
        'Website infrastructure continues on LeadPages if partner circumstances change.'
      ],
      personalStatement: positioning.personalServiceStatement || defaultPos.personalServiceStatement,
      localStatement: positioning.localCredibilityStatement || defaultPos.localCredibilityStatement
    },
    benefits: PLATFORM_BENEFITS,
    faqs: faqs,
    leadOffer: wp.leadOffer,
    enquiryForm: {
      showExtended: wp.enquiryForm.showExtended !== false,
      goals: (wp.enquiryForm.goals && wp.enquiryForm.goals.length) ? wp.enquiryForm.goals : ENQUIRY_GOALS,
      features: (wp.enquiryForm.features && wp.enquiryForm.features.length) ? wp.enquiryForm.features : ENQUIRY_FEATURES
    },
    social: wp.social,
    metrics: metrics,
    visibility: wp.visibility,
    positioning: positioning,
    experience: wp.experience,
    meta: {
      partnerId: prof.partner_id || partner.id,
      templateKey: cfg.templateKey || 'converge',
      websiteSlug: prof.showcase_slug || null,
      siteId: home && home.id ? home.id : null,
      siteSlug: home && home.slug ? home.slug : null,
      siteName: home && home.business_name ? home.business_name : agencyName
    },
    profileSeo: wp.seo || {},
    pal: null
  };

  content.seo = buildSeoMeta(content, base);
  return content;
}

module.exports = {
  resolvePartnerThemeContent,
  migrateLegacyToProfile,
  PLATFORM_SERVICES,
  ENQUIRY_GOALS,
  ENQUIRY_FEATURES
};
