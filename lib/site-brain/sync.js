'use strict';

/**
 * Initialise / refresh Site Brain from an existing website (sites.config).
 * Interpretive fields stay needs-confirmation or inferred until bootstrap review.
 */

const { makeFact, emptySnapshot, emptySearchIntelligence } = require('./schema');
const service = require('./service');

function factFromConfig(value, status) {
  return makeFact(value, {
    source: 'site_config',
    status: status || 'verified',
    confidence: status === 'verified' ? 1 : 0.55
  });
}

function inferIndustry(cfg, site) {
  const trade = (cfg && cfg.trade) || (site && site.template) || '';
  const name = (site && site.business_name) || (cfg && cfg.name) || '';
  if (trade && String(trade).toLowerCase() !== String(name).toLowerCase()) return String(trade);
  return String(trade || name || '');
}

function servicesList(cfg) {
  if (Array.isArray(cfg.services) && cfg.services.length) {
    return cfg.services
      .map((s) => (s && (s.title || s.name)) || '')
      .map(String)
      .filter(Boolean)
      .slice(0, 12);
  }
  const items = cfg.sections && cfg.sections.services && cfg.sections.services.items;
  if (Array.isArray(items)) {
    return items
      .map((s) => (s && (s.title || s.name)) || '')
      .map(String)
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function sectionKeysOn(cfg) {
  const sections = (cfg && cfg.sections) || {};
  const order = Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : Object.keys(sections);
  return order.filter((k) => sections[k] && sections[k].on !== false);
}

function pagesInventory(cfg) {
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  return pages.map((p) => ({
    id: p.id || p.slug || null,
    title: p.title || p.h1 || '',
    slug: p.slug || p.path || '',
    seoTitle: p.seoTitle || p.title || '',
    metaDescription: p.metaDescription || p.description || ''
  }));
}

/**
 * Build a bootstrap snapshot from site row + config.
 */
function buildSnapshotFromSite(site) {
  const cfg = (site && site.config) || {};
  const siteId = String(site.id);
  const snap = emptySnapshot(siteId, site.owner_user_id || null);
  const businessName = site.business_name || cfg.name || cfg.business || '';
  const phone = cfg.phone || cfg.phoneText || '';
  const email = cfg.email || '';
  const region = cfg.region || '';
  const services = servicesList(cfg);
  const industry = inferIndustry(cfg, site);

  snap.business = {
    name: factFromConfig(businessName, 'verified'),
    industry: factFromConfig(industry, industry ? 'needs-confirmation' : 'inferred'),
    phone: factFromConfig(phone, phone ? 'verified' : 'needs-confirmation'),
    email: factFromConfig(email, email ? 'verified' : 'needs-confirmation'),
    description: makeFact('', {
      source: 'site_config',
      status: 'needs-confirmation',
      confidence: 0.3
    })
  };

  snap.brand = {
    tone: makeFact('', { source: 'imported', status: 'needs-confirmation', confidence: 0.3 }),
    theme: factFromConfig(cfg.theme || {}, 'verified'),
    logo: factFromConfig((cfg.logo && (cfg.logo.imageUrl || cfg.logo.mode)) || null, 'verified'),
    typography: factFromConfig((cfg.theme && cfg.theme.fonts) || {}, 'verified')
  };

  snap.audience = {
    primary: makeFact('', { source: 'imported', status: 'needs-confirmation', confidence: 0.3 })
  };

  snap.offers = {
    mainServices: factFromConfig(services, services.length ? 'needs-confirmation' : 'inferred')
  };

  snap.goals = {
    primary: makeFact('', { source: 'imported', status: 'needs-confirmation', confidence: 0.3 }),
    preferredCta: makeFact(
      (cfg.sections && cfg.sections.hero && (cfg.sections.hero.cta || cfg.sections.hero.callText)) ||
        '',
      { source: 'site_config', status: 'needs-confirmation', confidence: 0.5 }
    )
  };

  snap.locations = {
    primary: factFromConfig(region, region ? 'needs-confirmation' : 'inferred'),
    serviceAreas: makeFact([], {
      source: 'imported',
      status: 'needs-confirmation',
      confidence: 0.3
    })
  };

  snap.seo = {
    siteTitle: factFromConfig(cfg.seoTitle || businessName, 'verified'),
    siteDescription: factFromConfig(cfg.seoDescription || '', 'needs-confirmation'),
    pages: factFromConfig(pagesInventory(cfg), 'verified')
  };

  const twin = emptySearchIntelligence();
  const areas =
    (cfg.sections &&
      cfg.sections.serviceAreas &&
      Array.isArray(cfg.sections.serviceAreas.areas) &&
      cfg.sections.serviceAreas.areas) ||
    [];
  twin.serviceAreas = areas.map(function (a) {
    return typeof a === 'string' ? a : (a && (a.name || a.suburb || a.slug)) || '';
  }).filter(Boolean);
  twin.services = services;
  snap.searchIntelligence = twin;

  snap.conversion = {
    hasQuoteForm: factFromConfig(!!(cfg.sections && cfg.sections.quote && cfg.sections.quote.on !== false), 'verified'),
    preferredCta: snap.goals.preferredCta
  };

  snap.content = {
    restrictions: makeFact('', {
      source: 'imported',
      status: 'needs-confirmation',
      confidence: 0.2
    })
  };

  snap.imagery = {
    hasLogo: factFromConfig(!!(cfg.logo && cfg.logo.imageUrl), 'verified')
  };

  snap.marketplace = {
    activeSections: factFromConfig(sectionKeysOn(cfg), 'verified'),
    layout: factFromConfig(cfg.layout || '', 'verified')
  };

  snap.websiteState = {
    template: factFromConfig(site.template || cfg.template || '', 'verified'),
    slug: factFromConfig(site.slug || '', 'verified'),
    sectionOrder: factFromConfig(cfg.sectionOrder || [], 'verified')
  };

  return snap;
}

/**
 * Fields shown on bootstrap review UI.
 */
function bootstrapReviewFields(snapshot) {
  const s = snapshot || {};
  function val(f) {
    if (f && typeof f === 'object' && 'value' in f) return f.value;
    return f == null ? '' : f;
  }
  return {
    businessName: val(s.business && s.business.name),
    industry: val(s.business && s.business.industry),
    mainServices: val(s.offers && s.offers.mainServices) || [],
    targetAudience: val(s.audience && s.audience.primary),
    primaryGoal: val(s.goals && s.goals.primary),
    serviceAreas: val(s.locations && s.locations.serviceAreas) || [],
    preferredCta: val(s.goals && s.goals.preferredCta),
    brandTone: val(s.brand && s.brand.tone),
    contentRestrictions: val(s.content && s.content.restrictions)
  };
}

async function syncSiteBrainFromSite(site, opts) {
  const o = opts || {};
  const siteId = String(site.id);
  const snapshot = buildSnapshotFromSite(site);
  const created = await service.createSiteBrain({
    siteId,
    accountId: site.owner_user_id || null,
    snapshot,
    bootstrapStatus: 'awaiting_review',
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: 'site_config',
    requestId: o.requestId
  });
  if (!created.ok) return created;

  // If brain already existed and forceResync, overwrite pending interpretive fields carefully
  if (!created.created && o.forceResync) {
    const saved = await service.saveSnapshot(siteId, snapshot, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      source: 'site_config',
      bootstrapStatus: created.brain.bootstrap_status === 'reviewed' ? 'reviewed' : 'awaiting_review',
      eventType: 'resync',
      expectedVersion: created.brain.version
    });
    if (!saved.ok) return saved;
    return {
      ok: true,
      brain: saved.brain,
      created: false,
      review: bootstrapReviewFields(snapshot),
      needsBootstrapReview: saved.brain.bootstrap_status !== 'reviewed',
      persisted: true
    };
  }

  return {
    ok: true,
    brain: created.brain,
    created: created.created,
    review: bootstrapReviewFields(created.brain.snapshot),
    needsBootstrapReview: created.brain.bootstrap_status !== 'reviewed',
    persisted: true
  };
}

/**
 * Apply user bootstrap review answers — promotes reviewed fields to verified.
 */
async function applyBootstrapReview(siteId, answers, opts) {
  const o = opts || {};
  const got = await service.getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = JSON.parse(JSON.stringify(got.brain.snapshot));
  const a = answers || {};

  function setVerified(pathParts, value) {
    let cur = snap;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!cur[pathParts[i]]) cur[pathParts[i]] = {};
      cur = cur[pathParts[i]];
    }
    const key = pathParts[pathParts.length - 1];
    cur[key] = makeFact(value, {
      source: o.source || 'user',
      status: 'verified',
      confidence: 1,
      createdBy: o.actorUserId,
      updatedBy: o.actorUserId
    });
  }

  if (a.businessName != null) setVerified(['business', 'name'], String(a.businessName).trim());
  if (a.industry != null) setVerified(['business', 'industry'], String(a.industry).trim());
  if (a.mainServices != null) {
    const services = Array.isArray(a.mainServices)
      ? a.mainServices
      : String(a.mainServices)
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    setVerified(['offers', 'mainServices'], services);
  }
  if (a.targetAudience != null) setVerified(['audience', 'primary'], String(a.targetAudience).trim());
  if (a.primaryGoal != null) setVerified(['goals', 'primary'], String(a.primaryGoal).trim());
  if (a.serviceAreas != null) {
    const areas = Array.isArray(a.serviceAreas)
      ? a.serviceAreas
      : String(a.serviceAreas)
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    setVerified(['locations', 'serviceAreas'], areas);
  }
  if (a.preferredCta != null) setVerified(['goals', 'preferredCta'], String(a.preferredCta).trim());
  if (a.brandTone != null) setVerified(['brand', 'tone'], String(a.brandTone).trim());
  if (a.contentRestrictions != null) {
    setVerified(['content', 'restrictions'], String(a.contentRestrictions).trim());
  }

  return service.saveSnapshot(siteId, snap, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: o.source || 'user',
    bootstrapStatus: 'reviewed',
    expectedVersion: got.brain.version,
    eventType: 'bootstrap_review',
    requestId: o.requestId
  });
}

module.exports = {
  buildSnapshotFromSite,
  bootstrapReviewFields,
  syncSiteBrainFromSite,
  applyBootstrapReview
};
