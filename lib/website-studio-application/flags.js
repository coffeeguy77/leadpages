'use strict';

/**
 * Website Studio Phase 5 application feature flags.
 * All application modes default OFF. Website Studio access remains THEME_STUDIO_V2.
 */

function envOn(name) {
  const env = String(process.env[name] || '0').toLowerCase();
  return env === '1' || env === 'true' || env === 'on';
}

function envOffUnlessUnset(name) {
  // Default ON when unset (legacy Theme Studio V2 access pattern)
  const raw = process.env[name];
  if (raw == null || raw === '') return true;
  const env = String(raw).toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/** Master switch for any Website Studio → site application. Default OFF. */
function isApplicationEnabled() {
  return envOn('WEBSITE_STUDIO_APPLICATION');
}

/** Mode 1 — create new draft site. Default OFF. */
function isCreateSiteEnabled() {
  return isApplicationEnabled() && envOn('WEBSITE_STUDIO_CREATE_SITE');
}

/** Mode 2 — replacement draft (never live overwrite). Default OFF. */
function isReplacementDraftEnabled() {
  return isApplicationEnabled() && envOn('WEBSITE_STUDIO_REPLACEMENT_DRAFT');
}

/** Mode 3 — save private template. Default OFF. */
function isPrivateTemplateEnabled() {
  return isApplicationEnabled() && envOn('WEBSITE_STUDIO_PRIVATE_TEMPLATE');
}

/**
 * Staged audience for application (separate from Studio access).
 * Values: superuser | selected_partners | partners | selected_clients | wider
 * Default: superuser
 */
function applicationAudience() {
  const v = String(process.env.WEBSITE_STUDIO_APPLICATION_AUDIENCE || 'superuser')
    .toLowerCase()
    .trim();
  return v || 'superuser';
}

function isAudienceAllowed(actor) {
  const audience = applicationAudience();
  if (!actor) return false;
  if (actor.isSuperuser) return true;
  if (audience === 'superuser') return false;
  if (audience === 'selected_partners' || audience === 'partners' || audience === 'all_partners') {
    return !!actor.isPartner;
  }
  if (audience === 'selected_clients' || audience === 'wider') {
    return !!(actor.isPartner || actor.isClient || actor.isSuperuser);
  }
  return false;
}

module.exports = {
  isApplicationEnabled,
  isCreateSiteEnabled,
  isReplacementDraftEnabled,
  isPrivateTemplateEnabled,
  applicationAudience,
  isAudienceAllowed,
  envOn,
  envOffUnlessUnset
};
