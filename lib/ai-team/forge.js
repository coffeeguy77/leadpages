'use strict';

/**
 * Forge — Phase 2 draft mutations through real editor config paths.
 * Merges into sites.config only. Never publishes.
 */

const { getCapability } = require('./capability-registry');
const { getField } = require('./site-knowledge-fields');

/** Phase 2: limited executable operations */
const EXECUTABLE_OPERATIONS = Object.freeze({
  hero_cta: { capabilityId: 'hero', sectionKey: 'hero' },
  enable_section: { capabilityId: null, sectionKey: null }
});

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function factValue(f) {
  if (f == null) return '';
  if (typeof f === 'object' && 'value' in f) return f.value == null ? '' : f.value;
  return f;
}

function defaultSectionPayload(sectionKey) {
  if (sectionKey === 'faq') {
    return {
      on: true,
      eyebrow: 'FAQ',
      heading: 'Frequently asked questions',
      items: []
    };
  }
  return { on: true };
}

/**
 * Build a Forge draft patch from an approved recommendation + Site Brain snapshot.
 */
function buildDraftFromRecommendation(recommendation, snapshot) {
  const rec = recommendation || {};
  const change = rec.proposed_change || rec.proposedChange || {};
  const snap = snapshot || {};

  if (change.type === 'site_brain_update' && change.fieldKey) {
    const field = getField(change.fieldKey);
    return {
      ok: true,
      kind: 'site_knowledge',
      executable: false,
      title: field ? 'Answer: ' + field.label : 'Complete Site Knowledge',
      fieldKey: change.fieldKey,
      editorTab: 'ai-team',
      editorSection: null,
      message: 'Use Answer with Atlas or edit Site Knowledge — this does not change the live page.'
    };
  }

  const capId = change.capabilityId || change.sectionKey;
  const cap = capId ? getCapability(capId) : null;
  if (!cap) {
    return {
      ok: true,
      kind: 'manual',
      executable: false,
      title: rec.title || 'Manual follow-up',
      editorTab: 'details',
      editorSection: change.sectionKey || null,
      message: 'Apply this in Page editor, then Publish Live Site.'
    };
  }

  if (capId === 'hero' || change.sectionKey === 'hero' || change.field === 'cta') {
    const cta = String(factValue(snap.goals && snap.goals.preferredCta) || '').trim();
    if (!cta) {
      return {
        ok: false,
        error: 'cta_not_set',
        message:
          'Set your preferred call to action in Site Knowledge first (or use Answer with Atlas on the CTA recommendation).'
      };
    }
    if (/^(get in touch|contact us|learn more)$/i.test(cta)) {
      return {
        ok: false,
        error: 'cta_too_generic',
        message: 'Choose a more specific button phrase in Site Knowledge before applying to the hero.'
      };
    }
    return {
      ok: true,
      kind: 'forge_draft',
      executable: true,
      capabilityId: 'hero',
      sectionKey: 'hero',
      operation: 'hero_cta',
      title: 'Apply hero button: “' + cta + '”',
      editorTab: 'details',
      editorSection: 'hero',
      patch: {
        operation: 'hero_cta',
        paths: ['sections.hero.cta'],
        after: { cta }
      },
      message:
        'Writes the hero button text in your site config (draft). Review in Page editor → Hero, then Publish Live Site.'
    };
  }

  if (capId === 'faq' || change.sectionKey === 'faq') {
    return {
      ok: true,
      kind: 'forge_draft',
      executable: true,
      capabilityId: 'faq',
      sectionKey: 'faq',
      operation: 'enable_section',
      title: 'Turn on FAQ section',
      editorTab: 'details',
      editorSection: 'faq',
      patch: {
        operation: 'enable_section',
        sectionKey: 'faq',
        paths: ['sections.faq.on', 'sectionOrder']
      },
      message:
        'Enables the FAQ section with starter headings. Add questions in Page editor → FAQ, then Publish Live Site.'
    };
  }

  return {
    ok: true,
    kind: 'manual',
    executable: false,
    title: rec.title || 'Manual follow-up',
    editorTab: 'details',
    editorSection: change.sectionKey || null,
    message: 'Phase 2 Forge does not automate this yet. Use Page editor, then Publish Live Site.'
  };
}

/**
 * Apply a Forge patch to a sites.config object (merge only).
 */
function applyPatchToConfig(config, patch) {
  const cfg = deepClone(config || {});
  if (!cfg.sections || typeof cfg.sections !== 'object') cfg.sections = {};
  const p = patch || {};

  if (p.operation === 'hero_cta') {
    const cta = p.after && p.after.cta != null ? String(p.after.cta).trim() : '';
    if (!cta) return { ok: false, error: 'cta_required' };
    if (!cfg.sections.hero || typeof cfg.sections.hero !== 'object') cfg.sections.hero = {};
    cfg.sections.hero.on = cfg.sections.hero.on !== false;
    cfg.sections.hero.cta = cta;
    return {
      ok: true,
      config: cfg,
      summary: 'Hero button set to “' + cta + '”',
      paths: ['sections.hero.cta']
    };
  }

  if (p.operation === 'enable_section') {
    const key = String(p.sectionKey || '').trim();
    if (!key) return { ok: false, error: 'section_key_required' };
    const cap = getCapability(key);
    if (!cap) return { ok: false, error: 'capability_not_allowlisted' };
    const existing =
      cfg.sections[key] && typeof cfg.sections[key] === 'object'
        ? cfg.sections[key]
        : {};
    cfg.sections[key] = Object.assign({}, defaultSectionPayload(key), existing, { on: true });
    if (!Array.isArray(cfg.sectionOrder)) cfg.sectionOrder = Object.keys(cfg.sections);
    if (cfg.sectionOrder.indexOf(key) < 0) {
      const quoteIdx = cfg.sectionOrder.indexOf('quote');
      if (quoteIdx >= 0) cfg.sectionOrder.splice(quoteIdx, 0, key);
      else cfg.sectionOrder.push(key);
    }
    return {
      ok: true,
      config: cfg,
      summary: 'Enabled ' + key + ' section',
      paths: ['sections.' + key, 'sectionOrder']
    };
  }

  return { ok: false, error: 'unknown_operation' };
}

function isForgeOperationAllowed(operation) {
  return Object.prototype.hasOwnProperty.call(EXECUTABLE_OPERATIONS, operation);
}

module.exports = {
  EXECUTABLE_OPERATIONS,
  buildDraftFromRecommendation,
  applyPatchToConfig,
  isForgeOperationAllowed,
  factValue
};
