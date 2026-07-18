'use strict';

/**
 * Website Studio generation entry (legacy module path).
 * Delegates to Website Composer — no trade-template shallow clone.
 */

const {
  normalizeBrief,
  composeWebsiteConcepts
} = require('../website-composer');

/**
 * Build three deterministic website concepts from a brief.
 * @param {object} briefInput
 * @param {{ foundationId?: string, recipeId?: string, sourceConfig?: object|null, count?: number }} [opts]
 */
async function buildDeterministicConcepts(briefInput, opts) {
  const result = await composeWebsiteConcepts(briefInput, opts);
  if (!result.ok) return result;
  return {
    ...result,
    // Back-compat fields expected by Theme Studio V2 API/UI
    source: result.source || 'website_composer'
  };
}

/**
 * Try Brain structured generation; always fall back to Website Composer.
 * @param {object} brain
 * @param {object} brief
 * @param {object} [opts]
 */
async function generateConceptsWithBrain(brain, brief, opts) {
  const deterministic = await buildDeterministicConcepts(brief, opts);
  if (!brain || typeof brain.generateStructured !== 'function') {
    return { ...deterministic, source: 'website_composer' };
  }

  try {
    const result = await brain.generateStructured({
      taskId: 'theme_studio.concept_generation',
      promptId: 'theme_studio.concept_generation',
      temperature: 0.55,
      input: {
        briefJson: JSON.stringify(normalizeBrief(brief)),
        foundationId: (opts && opts.foundationId) || '',
        slot: 'A'
      },
      responseSchema: {
        type: 'object',
        required: ['concept'],
        properties: { concept: { type: 'object' } }
      }
    });
    // Brain output is advisory only in Phase 2 — Composer remains source of truth
    // for complete, non-trade-inherited drafts. Keep deterministic concepts.
    if (result && result.ok) {
      return { ...deterministic, source: 'website_composer+brain_acknowledged' };
    }
  } catch (_e) {
    /* fall through */
  }

  return { ...deterministic, source: 'website_composer_fallback' };
}

module.exports = {
  normalizeBrief,
  buildDeterministicConcepts,
  generateConceptsWithBrain
};
