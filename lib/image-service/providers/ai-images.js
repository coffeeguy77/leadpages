'use strict';

/**
 * AI image provider interface — superuser only.
 * No new paid provider is implemented in Phase 3.
 * If a future provider exists, wire it here behind assertAiImageAccess.
 */

const { assertAiImageAccess } = require('../permissions');

function isImplemented() {
  return false;
}

/**
 * @param {object} brief
 * @param {object} actor
 */
async function generateAiImage(brief, actor, opts) {
  const gate = assertAiImageAccess(actor);
  if (!gate.ok) return gate;

  if (!isImplemented()) {
    return {
      ok: false,
      error: 'ai_image_not_implemented',
      message:
        'AI image generation interface is available to superusers but no paid provider is configured in Phase 3',
      results: []
    };
  }

  // Placeholder for future provider wiring
  void brief;
  void opts;
  return { ok: false, error: 'ai_image_not_implemented', results: [] };
}

module.exports = {
  isImplemented,
  generateAiImage
};
