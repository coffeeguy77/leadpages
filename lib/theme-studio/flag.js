'use strict';

/**
 * Theme Studio V2 feature flag.
 * Default ON (unset). Set THEME_STUDIO_V2=0 to disable.
 */

function isThemeStudioV2Enabled() {
  const env = String(process.env.THEME_STUDIO_V2 || '1').toLowerCase();
  return env !== '0' && env !== 'false' && env !== 'off';
}

/** Live site apply is off unless explicitly enabled. */
function isThemeStudioLiveApplyEnabled() {
  const env = String(process.env.THEME_STUDIO_ALLOW_LIVE_APPLY || '0').toLowerCase();
  return env === '1' || env === 'true' || env === 'on';
}

module.exports = {
  isThemeStudioV2Enabled,
  isThemeStudioLiveApplyEnabled
};
