'use strict';

/**
 * Image Service role permissions.
 * AI image generation: superuser only (server-enforced).
 */

function normalizeActor(actor) {
  const a = actor || {};
  return {
    userId: a.userId || a.id || null,
    isSuperuser: !!(a.isSuperuser || a.is_superuser || a.role === 'super'),
    isPartner: !!(a.isPartner || a.is_partner || a.role === 'partner'),
    isClient: !!(a.isClient || a.is_client || a.role === 'client')
  };
}

function canSearchPexels(actor) {
  const a = normalizeActor(actor);
  return a.isSuperuser || a.isPartner || a.isClient;
}

function canUseCloudinary(actor) {
  const a = normalizeActor(actor);
  return a.isSuperuser || a.isPartner || a.isClient;
}

function canUseAiImages(actor) {
  return normalizeActor(actor).isSuperuser === true;
}

function assertAiImageAccess(actor) {
  if (!canUseAiImages(actor)) {
    return {
      ok: false,
      code: 403,
      error: 'ai_image_forbidden',
      message: 'AI image generation is limited to superusers'
    };
  }
  return { ok: true };
}

function assertPexelsAccess(actor) {
  if (!canSearchPexels(actor)) {
    return { ok: false, code: 403, error: 'pexels_forbidden', message: 'Pexels search not permitted' };
  }
  return { ok: true };
}

module.exports = {
  normalizeActor,
  canSearchPexels,
  canUseCloudinary,
  canUseAiImages,
  assertAiImageAccess,
  assertPexelsAccess
};
