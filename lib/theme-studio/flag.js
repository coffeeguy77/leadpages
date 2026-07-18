'use strict';

/**
 * Theme Studio V2 / Website Studio feature flags.
 * Studio access default ON. Application modes default OFF (Phase 5).
 */

const applicationFlags = require('../website-studio-application/flags');

function isThemeStudioV2Enabled() {
  const env = String(process.env.THEME_STUDIO_V2 || '1').toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/** Live site overwrite apply is off unless explicitly enabled. Phase 5 does not use this for replacement drafts. */
function isThemeStudioLiveApplyEnabled() {
  const env = String(process.env.THEME_STUDIO_ALLOW_LIVE_APPLY || '0').toLowerCase();
  return env === '1' || env === 'true' || env === 'on';
}

module.exports = {
  isThemeStudioV2Enabled,
  isThemeStudioLiveApplyEnabled,
  isWebsiteStudioApplicationEnabled: applicationFlags.isApplicationEnabled,
  isWebsiteStudioCreateSiteEnabled: applicationFlags.isCreateSiteEnabled,
  isWebsiteStudioReplacementDraftEnabled: applicationFlags.isReplacementDraftEnabled,
  isWebsiteStudioPrivateTemplateEnabled: applicationFlags.isPrivateTemplateEnabled,
  websiteStudioApplicationAudience: applicationFlags.applicationAudience
};
