'use strict';

/**
 * Future Brain task contracts for Theme Studio (typed documentation only).
 * Phases 1–2 do NOT register these tasks or call providers.
 *
 * When implemented (Phase 3+), each task must:
 * - Use getPlatformBrain() / generateStructured
 * - Return JSON matching the response schema below
 * - Never write to sites.config (draft concepts only)
 */

/**
 * @typedef {object} ThemeStudioBrief
 * @property {string} businessName
 * @property {string} industry
 * @property {string} [specialisation]
 * @property {string} [location]
 * @property {string} [audience]
 * @property {string} [desiredStyle]
 * @property {string} [conversionGoal]
 * @property {string} [notes]
 */

/**
 * @typedef {object} BrainTaskContract
 * @property {string} taskId
 * @property {string} purpose
 * @property {string} inputDescription
 * @property {object} responseSchema
 * @property {boolean} writesSites
 * @property {boolean} draftOnly
 */

/** @type {ReadonlyArray<BrainTaskContract>} */
const THEME_STUDIO_BRAIN_TASKS = Object.freeze([
  Object.freeze({
    taskId: 'theme_studio.business_analysis',
    purpose: 'Normalize a free-text / guided brief into a structured business profile.',
    inputDescription: 'ThemeStudioBrief + optional existing site summary (non-protected fields only).',
    responseSchema: {
      type: 'object',
      required: ['businessProfile', 'industrySignals', 'riskFlags'],
      properties: {
        businessProfile: { type: 'object' },
        industrySignals: { type: 'array', items: { type: 'string' } },
        riskFlags: { type: 'array', items: { type: 'string' } },
        suggestedFoundationCategories: { type: 'array', items: { type: 'string' } }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.foundation_selection',
    purpose: 'Rank curated foundations for the business profile (AI advisory; registry scores are authoritative).',
    inputDescription: 'businessProfile + list of foundation summaries from the registry.',
    responseSchema: {
      type: 'object',
      required: ['candidates'],
      properties: {
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['foundationId', 'score', 'rationale'],
            properties: {
              foundationId: { type: 'string' },
              score: { type: 'number' },
              rationale: { type: 'string' }
            }
          }
        }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.concept_generation',
    purpose: 'Produce one theme_studio.concept.v1 object for a chosen foundation.',
    inputDescription: 'businessProfile + foundationId + differentiation seed (A/B/C).',
    responseSchema: {
      type: 'object',
      required: ['concept'],
      properties: {
        concept: { type: 'object' }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.content_generation',
    purpose: 'Fill section copy / services / CTAs for an existing concept skeleton.',
    inputDescription: 'Partial concept + foundation constraints.',
    responseSchema: {
      type: 'object',
      required: ['sections', 'services', 'callsToAction'],
      properties: {
        sections: { type: 'object' },
        services: { type: 'array' },
        callsToAction: { type: 'object' },
        placeholderFields: { type: 'array' }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.image_direction',
    purpose: 'Produce imagery direction notes per section (no binary assets in V1).',
    inputDescription: 'concept summary + foundation imageDirectionProfile.',
    responseSchema: {
      type: 'object',
      required: ['imagery'],
      properties: {
        imagery: { type: 'array' }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.refinement',
    purpose: 'Return a structured patch against theme_studio.concept.v1 (not sites.config).',
    inputDescription: 'current concept + natural language refinement request.',
    responseSchema: {
      type: 'object',
      required: ['patch', 'rationale'],
      properties: {
        patch: { type: 'object' },
        rationale: { type: 'string' },
        warnings: { type: 'array' }
      }
    },
    writesSites: false,
    draftOnly: true
  }),
  Object.freeze({
    taskId: 'theme_studio.quality_review',
    purpose: 'Advisory quality notes; deterministic validator remains authoritative.',
    inputDescription: 'validated concept + adapter warnings.',
    responseSchema: {
      type: 'object',
      required: ['score', 'notes'],
      properties: {
        score: { type: 'number' },
        notes: { type: 'array', items: { type: 'string' } },
        leakageRisks: { type: 'array', items: { type: 'string' } }
      }
    },
    writesSites: false,
    draftOnly: true
  })
]);

/**
 * @param {string} taskId
 * @returns {BrainTaskContract|null}
 */
function getBrainTaskContract(taskId) {
  return THEME_STUDIO_BRAIN_TASKS.find((t) => t.taskId === taskId) || null;
}

module.exports = {
  THEME_STUDIO_BRAIN_TASKS,
  getBrainTaskContract
};
