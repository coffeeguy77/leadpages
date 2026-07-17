'use strict';

const {
  requireUser,
  isSuperAdmin,
  partnerIdForUser,
  assertSiteAccess,
  json,
  readBody,
  admin
} = require('../brain/http');
const { canAccessThemeStudio } = require('./access');
const { isThemeStudioV2Enabled } = require('./flag');

/**
 * Resolve Theme Studio actor + enforce V1 audience (super + partner).
 * @param {import('http').IncomingMessage} req
 * @param {{ siteId?: string }} [opts]
 */
async function requireThemeStudioActor(req, opts) {
  if (!isThemeStudioV2Enabled()) {
    return {
      ok: false,
      code: 503,
      error: 'theme_studio_v2_disabled',
      message: 'Set THEME_STUDIO_V2=1 (default) or remove =0 to enable Theme Studio V2.'
    };
  }

  const user = await requireUser(req);
  if (!user) return { ok: false, code: 401, error: 'unauthorized' };

  const superuser = await isSuperAdmin(user.id);
  const partnerId = await partnerIdForUser(user.id);
  const actor = {
    userId: user.id,
    isSuperuser: superuser,
    isPartner: !!partnerId,
    isClient: !superuser && !partnerId,
    partnerId: partnerId || undefined,
    role: superuser ? 'superuser' : partnerId ? 'partner' : 'client'
  };

  const gate = canAccessThemeStudio(actor);
  if (!gate.allowed) {
    return {
      ok: false,
      code: 403,
      error: 'forbidden',
      reason: gate.reason,
      message: 'Theme Studio V2 is limited to superusers and partners during initial testing.'
    };
  }

  let siteAccess = null;
  const siteId = opts && opts.siteId;
  if (siteId) {
    siteAccess = await assertSiteAccess(user, siteId);
    if (!siteAccess.ok) {
      return { ok: false, code: siteAccess.code, error: siteAccess.error };
    }
    // Clients with site ownership still cannot use Theme Studio V2
    if (siteAccess.role === 'client' && !superuser && !partnerId) {
      return {
        ok: false,
        code: 403,
        error: 'forbidden',
        reason: 'client_disabled_in_v1'
      };
    }
  }

  return { ok: true, user, actor, siteAccess };
}

/**
 * Ensure the actor owns the draft (or is super).
 * @param {object} draft
 * @param {object} actor
 */
function assertDraftAccess(draft, actor) {
  if (!draft) return { ok: false, code: 404, error: 'draft_not_found' };
  if (actor.isSuperuser) return { ok: true };
  if (draft.owner_user_id === actor.userId) return { ok: true };
  if (actor.partnerId && draft.partner_id === actor.partnerId) return { ok: true };
  return { ok: false, code: 403, error: 'not_your_draft' };
}

module.exports = {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody,
  admin,
  requireUser
};
