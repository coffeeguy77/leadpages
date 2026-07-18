'use strict';

const { validateConcept } = require('./validate-concept');
const { adaptConceptToSiteConfig } = require('./adapt-to-site-config');
const { buildDraftConfig } = require('../website-composer/build-draft');
const { getFoundation } = require('../website-composer/foundations');
const { getRecipe } = require('../website-composer/recipes');
const { PROTECTED_FIELDS } = require('./constants');

/**
 * Apply a structured refinement patch to a concept (never sites.config directly).
 * Patch shape: { set?: Record<path, value>, unset?: string[] }
 *
 * @param {object} concept
 * @param {object} patch
 * @param {object|null} [sourceConfig]
 */
function applyConceptPatch(concept, patch, sourceConfig) {
  if (!concept || typeof concept !== 'object') {
    return { ok: false, errors: [{ code: 'concept_missing', message: 'Concept required' }] };
  }
  if (!patch || typeof patch !== 'object') {
    return { ok: false, errors: [{ code: 'patch_missing', message: 'Patch required' }] };
  }

  const next = JSON.parse(JSON.stringify(concept));
  /** @type {Array<{ code: string, message: string, path?: string }>} */
  const errors = [];
  /** @type {string[]} */
  const applied = [];

  const sets = patch.set && typeof patch.set === 'object' ? patch.set : {};
  for (const [path, value] of Object.entries(sets)) {
    if (isProtectedPath(path)) {
      errors.push({
        code: 'protected_field_attempt',
        message: 'Patch cannot set protected path: ' + path,
        path
      });
      continue;
    }
    try {
      setByPath(next, path, value);
      applied.push(path);
    } catch (e) {
      errors.push({
        code: 'patch_set_failed',
        message: (e && e.message) || 'Failed to set path',
        path
      });
    }
  }

  const unsets = Array.isArray(patch.unset) ? patch.unset : [];
  for (const path of unsets) {
    if (isProtectedPath(path)) {
      errors.push({
        code: 'protected_field_attempt',
        message: 'Patch cannot unset protected path: ' + path,
        path
      });
      continue;
    }
    unsetByPath(next, path);
    applied.push('-' + path);
  }

  if (errors.length) {
    return { ok: false, errors, applied };
  }

  next.provenance = {
    ...(next.provenance || {}),
    lastPatchAt: new Date().toISOString(),
    generatedBy: (next.provenance && next.provenance.generatedBy) || 'refine'
  };

  // When refinement adds apps to sectionOrder, ensure adapter-backed section payloads exist
  if (Array.isArray(next.sectionOrder)) {
    const { adaptApp, hasAdapter } = require('../website-composer/adapters/registry');
    const { PROVENANCE } = require('../website-composer/constants');
    next.sections = next.sections || {};
    for (const key of next.sectionOrder) {
      if (key === 'footer') continue;
      if (next.sections[key] && next.sections[key].on !== false) continue;
      if (!hasAdapter(key)) continue;
      const name =
        (next.businessProfile && next.businessProfile.businessName) ||
        'Your business';
      const adapted = adaptApp(key, {
        title: name,
        heading: name,
        sub: (next.businessProfile && next.businessProfile.specialisation) || '',
        body: (next.businessProfile && next.businessProfile.specialisation) || name,
        text: (next.businessProfile && next.businessProfile.specialisation) || name,
        cta: (next.callsToAction && next.callsToAction.primary && next.callsToAction.primary.label) || 'Get in touch',
        items: [
          { title: 'Option one', text: 'Details for ' + name },
          { title: 'Option two', text: 'Details for ' + name },
          { title: 'Option three', text: 'Details for ' + name }
        ],
        packages: [
          { title: 'Package A', text: 'Included essentials', inclusions: ['One', 'Two'] },
          { title: 'Package B', text: 'Expanded inclusions', inclusions: ['One', 'Two', 'Three'] }
        ],
        logos: [{ label: 'Partner one' }, { label: 'Partner two' }, { label: 'Partner three' }],
        projects: [
          { title: 'Featured work', text: 'A highlight for ' + name },
          { title: 'Another highlight', text: 'More proof for ' + name }
        ],
        steps: [
          { title: 'Step one', text: 'Begin' },
          { title: 'Step two', text: 'Plan' },
          { title: 'Step three', text: 'Deliver' }
        ],
        slides: [
          { heading: name, subText: 'Slide one', cta: 'Learn more' },
          { heading: name, subText: 'Slide two', cta: 'Learn more' }
        ],
        provenance: PROVENANCE.AI_GENERATED
      });
      if (adapted.ok) next.sections[key] = adapted.config;
    }
  }

  const validated = validateConcept(next);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors, warnings: validated.warnings, applied };
  }

  // Prefer explicit Website Composer draft build (no trade shallow merge).
  let adapted;
  if (next.recipeId || next.rendererShellId || (next.provenance && next.provenance.generatedBy === 'website_composer')) {
    adapted = buildDraftConfig({
      concept: next,
      foundation: getFoundation(next.foundationId) || {},
      recipe: getRecipe(next.recipeId) || { id: next.recipeId || null },
      provenanceMap: (next.provenance && next.provenance.sectionProvenance) || {},
      imageBriefs: next.imageBriefs || {}
    });
  } else {
    adapted = adaptConceptToSiteConfig(next, sourceConfig || null);
  }
  if (!adapted.ok) {
    return { ok: false, errors: adapted.errors, warnings: adapted.warnings, applied };
  }

  return {
    ok: true,
    concept: { ...next, validationStatus: 'valid', warnings: validated.warnings },
    draftConfig: adapted.draftConfig,
    adapterWarnings: [...(adapted.warnings || []), ...(adapted.ignoredFields || [])],
    applied,
    rationale: patch.rationale || ''
  };
}

/**
 * Build a simple patch from natural-language-ish structured feedback (deterministic).
 * @param {object} concept
 * @param {string} feedback
 */
function buildDeterministicRefinePatch(concept, feedback) {
  const { planRefinement } = require('../website-composer/refine');
  const plan = planRefinement(concept, feedback);
  return {
    set: plan.set,
    unset: plan.unset,
    rationale: plan.rationale,
    changeSummary: plan.changeSummary
  };
}

function isProtectedPath(path) {
  const root = String(path).split('.')[0];
  return PROTECTED_FIELDS.includes(root) || PROTECTED_FIELDS.includes(path);
}

function setByPath(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetByPath(obj, path) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object') return;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === 'object') delete cur[parts[parts.length - 1]];
}

module.exports = {
  applyConceptPatch,
  buildDeterministicRefinePatch
};
