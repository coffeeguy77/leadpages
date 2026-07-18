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
 * Optional Brain acknowledgement with a hard timeout so generation never hangs.
 * Composer remains the source of truth for draft concepts.
 * @param {object} brain
 * @param {object} brief
 * @param {object} [opts]
 * @param {number} [timeoutMs]
 */
async function acknowledgeWithBrain(brain, brief, opts, timeoutMs) {
  if (!brain || typeof brain.generateStructured !== 'function') return null;
  const ms = typeof timeoutMs === 'number' ? timeoutMs : 2500;
  const call = brain.generateStructured({
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

  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve(call).catch(function () {
        return null;
      }),
      new Promise(function (resolve) {
        timer = setTimeout(function () {
          resolve({ timedOut: true });
        }, ms);
      })
    ]);
    if (result && result.ok) return 'website_composer+brain_acknowledged';
    if (result && result.timedOut) return 'website_composer_brain_timeout';
  } catch (_e) {
    /* fall through */
  } finally {
    if (timer) clearTimeout(timer);
  }
  return 'website_composer_fallback';
}

/**
 * Build concepts via Website Composer; optionally acknowledge via Brain.
 * Brain is off the critical path by default (`useBrain: false`) so Generate
 * cannot 500/timeout when a provider is slow — Composer is source of truth.
 *
 * @param {object} brain
 * @param {object} brief
 * @param {object} [opts]
 */
async function generateConceptsWithBrain(brain, brief, opts) {
  const options = opts || {};
  const deterministic = await buildDeterministicConcepts(brief, options);
  if (!deterministic.ok) return deterministic;

  if (options.useBrain === true) {
    const source = await acknowledgeWithBrain(brain, brief, options, options.brainTimeoutMs);
    return { ...deterministic, source: source || 'website_composer' };
  }

  return { ...deterministic, source: 'website_composer' };
}

module.exports = {
  normalizeBrief,
  buildDeterministicConcepts,
  generateConceptsWithBrain
};
