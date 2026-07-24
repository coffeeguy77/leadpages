'use strict';

/**
 * Feature flags for Google Ads Smart Campaign Builder + GTM.
 * Opt-in with env === '1'. Mutations default OFF for safety.
 */

function envOn(name) {
  return String(process.env[name] || '') === '1';
}

function envOffExplicit(name) {
  const v = String(process.env[name] || '').toLowerCase();
  return v === '0' || v === 'false' || v === 'off';
}

function campaignBuilderEnabled() {
  return envOn('GOOGLE_ADS_CAMPAIGN_BUILDER');
}

function campaignBuilderSuperuserOnly() {
  // Default ON when builder is enabled (safer pilot). Explicit 0 disables.
  if (!campaignBuilderEnabled()) return true;
  if (envOffExplicit('GOOGLE_ADS_CAMPAIGN_BUILDER_SUPERUSER_ONLY')) return false;
  if (envOn('GOOGLE_ADS_CAMPAIGN_BUILDER_SUPERUSER_ONLY')) return true;
  return true;
}

function campaignMutationsEnabled() {
  return campaignBuilderEnabled() && envOn('GOOGLE_ADS_CAMPAIGN_MUTATIONS');
}

function campaignPublishEnabled() {
  return campaignMutationsEnabled() && envOn('GOOGLE_ADS_CAMPAIGN_PUBLISH');
}

function budgetMutationsEnabled() {
  return campaignBuilderEnabled() && envOn('GOOGLE_ADS_BUDGET_MUTATIONS');
}

function statusMutationsEnabled() {
  return campaignBuilderEnabled() && envOn('GOOGLE_ADS_STATUS_MUTATIONS');
}

function gtmIntegrationEnabled() {
  return envOn('GTM_INTEGRATION');
}

function gtmManagedPublishEnabled() {
  return gtmIntegrationEnabled() && envOn('GTM_MANAGED_PUBLISH');
}

/**
 * @param {{ role?: string }} access — assertSiteAccess result
 * @param {'view'|'draft'|'publish'|'pause'|'budget'|'tracking'|'gtm_publish'} capability
 */
function canUseCapability(access, capability) {
  const role = access && access.role;
  if (!role) return false;
  if (!campaignBuilderEnabled() && capability !== 'tracking' && capability !== 'view') {
    return false;
  }
  if (campaignBuilderSuperuserOnly() && role !== 'super') {
    if (capability === 'view') return true; // clients can still see read-only when builder on for super planning
    return false;
  }
  switch (capability) {
    case 'view':
      return true;
    case 'draft':
      return campaignBuilderEnabled();
    case 'publish':
      return campaignPublishEnabled();
    case 'pause':
      return statusMutationsEnabled();
    case 'budget':
      return budgetMutationsEnabled();
    case 'tracking':
      return true;
    case 'gtm_publish':
      return gtmManagedPublishEnabled();
    default:
      return false;
  }
}

function flagSnapshot() {
  return {
    GOOGLE_ADS_CAMPAIGN_BUILDER: campaignBuilderEnabled(),
    GOOGLE_ADS_CAMPAIGN_BUILDER_SUPERUSER_ONLY: campaignBuilderSuperuserOnly(),
    GOOGLE_ADS_CAMPAIGN_MUTATIONS: campaignMutationsEnabled(),
    GOOGLE_ADS_CAMPAIGN_PUBLISH: campaignPublishEnabled(),
    GOOGLE_ADS_BUDGET_MUTATIONS: budgetMutationsEnabled(),
    GOOGLE_ADS_STATUS_MUTATIONS: statusMutationsEnabled(),
    GTM_INTEGRATION: gtmIntegrationEnabled(),
    GTM_MANAGED_PUBLISH: gtmManagedPublishEnabled()
  };
}

module.exports = {
  campaignBuilderEnabled,
  campaignBuilderSuperuserOnly,
  campaignMutationsEnabled,
  campaignPublishEnabled,
  budgetMutationsEnabled,
  statusMutationsEnabled,
  gtmIntegrationEnabled,
  gtmManagedPublishEnabled,
  canUseCapability,
  flagSnapshot
};
