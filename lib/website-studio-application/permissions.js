'use strict';

const {
  isApplicationEnabled,
  isCreateSiteEnabled,
  isReplacementDraftEnabled,
  isPrivateTemplateEnabled,
  isAudienceAllowed
} = require('./flags');

const MODES = Object.freeze({
  CREATE_SITE: 'create_site',
  REPLACEMENT_DRAFT: 'replacement_draft',
  PRIVATE_TEMPLATE: 'private_template'
});

/**
 * @param {object} actor
 * @param {string} mode
 * @param {{ targetAccountId?: string, targetSite?: object, templateVisibility?: string }} [ctx]
 */
function assertApplicationPermission(actor, mode, ctx) {
  const context = ctx || {};
  if (!actor || !actor.userId) {
    return { ok: false, code: 401, error: 'unauthenticated' };
  }
  if (!isApplicationEnabled()) {
    return {
      ok: false,
      code: 403,
      error: 'application_disabled',
      message: 'Website Studio application is disabled. Set WEBSITE_STUDIO_APPLICATION=1.'
    };
  }
  if (!isAudienceAllowed(actor)) {
    return {
      ok: false,
      code: 403,
      error: 'audience_denied',
      message: 'Actor not in WEBSITE_STUDIO_APPLICATION_AUDIENCE stage.'
    };
  }

  if (mode === MODES.CREATE_SITE) {
    if (!isCreateSiteEnabled()) {
      return {
        ok: false,
        code: 403,
        error: 'create_site_disabled',
        message: 'Set WEBSITE_STUDIO_CREATE_SITE=1 to enable new-site application.'
      };
    }
    if (actor.isClient && !actor.isSuperuser && !actor.isPartner) {
      return {
        ok: false,
        code: 403,
        error: 'client_create_denied',
        message: 'Clients cannot create sites via Website Studio in this rollout stage.'
      };
    }
    return { ok: true, mode };
  }

  if (mode === MODES.REPLACEMENT_DRAFT) {
    if (!isReplacementDraftEnabled()) {
      return {
        ok: false,
        code: 403,
        error: 'replacement_draft_disabled',
        message: 'Set WEBSITE_STUDIO_REPLACEMENT_DRAFT=1 to enable replacement drafts.'
      };
    }
    const site = context.targetSite;
    if (!site) {
      return { ok: false, code: 400, error: 'target_site_required' };
    }
    if (!canManageTargetSite(actor, site)) {
      return {
        ok: false,
        code: 403,
        error: 'cross_tenant_denied',
        message: 'Cannot create a replacement draft for an unauthorised site.'
      };
    }
    return { ok: true, mode };
  }

  if (mode === MODES.PRIVATE_TEMPLATE) {
    if (!isPrivateTemplateEnabled()) {
      return {
        ok: false,
        code: 403,
        error: 'private_template_disabled',
        message: 'Set WEBSITE_STUDIO_PRIVATE_TEMPLATE=1 to enable private templates.'
      };
    }
    if (actor.isClient && !actor.isSuperuser && !actor.isPartner) {
      return {
        ok: false,
        code: 403,
        error: 'client_template_denied',
        message: 'Clients cannot create Marketplace or Website Studio templates.'
      };
    }
    const visibility = String(context.templateVisibility || 'private');
    if (visibility === 'platform' || visibility === 'submitted' || visibility === 'public') {
      if (!actor.isSuperuser) {
        return {
          ok: false,
          code: 403,
          error: 'platform_template_denied',
          message: 'Only superusers may create platform-level or Marketplace-review templates.'
        };
      }
    }
    return { ok: true, mode };
  }

  return { ok: false, code: 400, error: 'invalid_mode', message: 'Unknown application mode' };
}

function canManageTargetSite(actor, site) {
  if (!site) return false;
  if (actor.isSuperuser) return true;
  if (actor.userId && site.owner_user_id && site.owner_user_id === actor.userId) return true;
  if (
    actor.partnerId &&
    (site.servicing_partner_id === actor.partnerId || site.referring_partner_id === actor.partnerId)
  ) {
    return true;
  }
  return false;
}

module.exports = {
  MODES,
  assertApplicationPermission,
  canManageTargetSite
};
