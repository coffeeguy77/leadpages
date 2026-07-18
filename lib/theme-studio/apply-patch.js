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
  const text = String(feedback || '').trim();
  /** @type {Record<string, unknown>} */
  const set = {};
  if (/darker|more contrast|bolder/i.test(text)) {
    set['theme.hivis'] = '#E11D48';
    set['theme.pipe'] = '#111827';
  }
  if (/softer|lighter|feminine|luxury/i.test(text)) {
    set['theme.hivis'] = '#C4A1A8';
    set['theme.lightBg'] = '#FBF7F8';
  }
  if (/cta|button|call to action/i.test(text)) {
    const labelMatch = text.match(/cta[:\s]+[“"']?([^“"'\n.]+)[“"']?/i);
    const label = labelMatch ? labelMatch[1].trim() : 'Get in touch';
    set['callsToAction.primary.label'] = label;
    set['sections.hero.cta'] = label;
    set['sections.hero.content.cta'] = label;
    set['header.ctaLabel'] = label;
  }
  if (/heading|headline|title/i.test(text)) {
    const m = text.match(/(?:heading|headline|title)[:\s]+[“"']([^“"']+)[“"']/i);
    if (m) {
      set['sections.hero.heading'] = m[1].trim();
      set['sections.hero.title'] = m[1].trim();
      set['sections.hero.content.heading'] = m[1].trim();
    }
  }
  if (!Object.keys(set).length && text) {
    set['rationale'] = (concept.rationale || '') + ' Refined: ' + text.slice(0, 240);
  }
  return { set, unset: [], rationale: text.slice(0, 500) };
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
