'use strict';

/**
 * Role-specific Site Brain context selectors.
 * Never dump the full Site Brain into specialist prompts.
 */

function factValue(f) {
  if (f && typeof f === 'object' && 'value' in f) return f.value;
  return f;
}

function pickFacts(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) {
    if (obj[k] != null) out[k] = obj[k];
  }
  return out;
}

/**
 * @param {object} snapshot
 * @param {string} specialistId
 * @param {{ editorContext?: object }} [opts]
 */
function getRelevantContext(snapshot, specialistId, opts) {
  const o = opts || {};
  const id = String(specialistId || '').toLowerCase();
  const snap = snapshot || {};
  const editorContext = sanitizeEditorContext(o.editorContext);

  const base = {
    specialistId: id,
    siteId: snap.siteId,
    business: pickFacts(snap.business, ['name', 'industry', 'phone', 'email', 'description']),
    editorContext
  };

  switch (id) {
    case 'atlas':
      return {
        ...base,
        audience: pickFacts(snap.audience, ['primary']),
        offers: pickFacts(snap.offers, ['mainServices']),
        goals: pickFacts(snap.goals, ['primary', 'preferredCta']),
        locations: pickFacts(snap.locations, ['primary', 'serviceAreas']),
        websiteState: pickFacts(snap.websiteState, ['template', 'slug', 'sectionOrder']),
        marketplace: pickFacts(snap.marketplace, ['activeSections', 'layout']),
        constraints: Array.isArray(snap.constraints) ? snap.constraints.slice(0, 20) : [],
        decisions: Array.isArray(snap.decisions) ? snap.decisions.slice(0, 10) : [],
        brand: pickFacts(snap.brand, ['tone'])
      };
    case 'nova':
      return {
        ...base,
        audience: pickFacts(snap.audience, ['primary']),
        brand: pickFacts(snap.brand, ['tone', 'theme', 'logo', 'typography']),
        imagery: snap.imagery || {},
        marketplace: pickFacts(snap.marketplace, ['layout', 'activeSections']),
        agentMemory: (snap.agentMemory && snap.agentMemory.nova) || {}
      };
    case 'scout':
      return {
        ...base,
        offers: pickFacts(snap.offers, ['mainServices']),
        locations: pickFacts(snap.locations, ['primary', 'serviceAreas']),
        seo: snap.seo || {},
        content: pickFacts(snap.content, ['restrictions']),
        agentMemory: (snap.agentMemory && snap.agentMemory.scout) || {}
      };
    case 'pulse':
      return {
        ...base,
        goals: pickFacts(snap.goals, ['primary', 'preferredCta']),
        conversion: snap.conversion || {},
        websiteState: pickFacts(snap.websiteState, ['sectionOrder']),
        marketplace: pickFacts(snap.marketplace, ['activeSections']),
        agentMemory: (snap.agentMemory && snap.agentMemory.pulse) || {}
      };
    case 'forge':
      return {
        ...base,
        marketplace: snap.marketplace || {},
        websiteState: snap.websiteState || {},
        approvedPlan: o.approvedPlan || null
      };
    case 'guardian':
      return {
        ...base,
        constraints: snap.constraints || [],
        proposedChange: o.proposedChange || null,
        permissions: o.permissions || null
      };
    default:
      return {
        ...base,
        goals: pickFacts(snap.goals, ['primary']),
        offers: pickFacts(snap.offers, ['mainServices'])
      };
  }
}

function sanitizeEditorContext(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return {
    siteId: c.siteId ? String(c.siteId) : null,
    pageId: c.pageId ? String(c.pageId) : null,
    pageSlug: c.pageSlug ? String(c.pageSlug).slice(0, 120) : null,
    pageTitle: c.pageTitle ? String(c.pageTitle).slice(0, 160) : null,
    pagePurpose: c.pagePurpose ? String(c.pagePurpose).slice(0, 80) : null,
    editorTab: c.editorTab ? String(c.editorTab).slice(0, 80) : null,
    selectedSection: c.selectedSection ? String(c.selectedSection).slice(0, 80) : null,
    selectedApp: c.selectedApp ? String(c.selectedApp).slice(0, 80) : null,
    userRole: c.userRole ? String(c.userRole).slice(0, 40) : null
  };
}

function summarizeForUi(snapshot) {
  const s = snapshot || {};
  return {
    businessName: factValue(s.business && s.business.name) || '',
    industry: factValue(s.business && s.business.industry) || '',
    primaryGoal: factValue(s.goals && s.goals.primary) || '',
    preferredCta: factValue(s.goals && s.goals.preferredCta) || '',
    mainServices: factValue(s.offers && s.offers.mainServices) || [],
    audience: factValue(s.audience && s.audience.primary) || '',
    activeSections: factValue(s.marketplace && s.marketplace.activeSections) || []
  };
}

module.exports = {
  getRelevantContext,
  sanitizeEditorContext,
  summarizeForUi,
  factValue
};
