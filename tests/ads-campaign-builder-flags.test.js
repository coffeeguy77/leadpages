'use strict';

const assert = require('assert');
const {
  campaignBuilderEnabled,
  campaignMutationsEnabled,
  campaignPublishEnabled,
  budgetMutationsEnabled,
  statusMutationsEnabled,
  gtmIntegrationEnabled,
  gtmManagedPublishEnabled,
  canUseCapability,
  flagSnapshot
} = require('../lib/google-ads/flags');

function withEnv(map, fn) {
  const prev = {};
  Object.keys(map).forEach((k) => {
    prev[k] = process.env[k];
    if (map[k] === undefined) delete process.env[k];
    else process.env[k] = map[k];
  });
  try {
    return fn();
  } finally {
    Object.keys(map).forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  }
}

withEnv(
  {
    GOOGLE_ADS_CAMPAIGN_BUILDER: undefined,
    GOOGLE_ADS_CAMPAIGN_MUTATIONS: undefined,
    GOOGLE_ADS_CAMPAIGN_PUBLISH: undefined,
    GOOGLE_ADS_BUDGET_MUTATIONS: undefined,
    GOOGLE_ADS_STATUS_MUTATIONS: undefined,
    GTM_INTEGRATION: undefined,
    GTM_MANAGED_PUBLISH: undefined
  },
  () => {
    assert.equal(campaignBuilderEnabled(), false);
    assert.equal(campaignMutationsEnabled(), false);
    assert.equal(campaignPublishEnabled(), false);
    assert.equal(budgetMutationsEnabled(), false);
    assert.equal(statusMutationsEnabled(), false);
    assert.equal(gtmIntegrationEnabled(), false);
    assert.equal(gtmManagedPublishEnabled(), false);
  }
);

withEnv(
  {
    GOOGLE_ADS_CAMPAIGN_BUILDER: '1',
    GOOGLE_ADS_CAMPAIGN_BUILDER_SUPERUSER_ONLY: '1',
    GOOGLE_ADS_CAMPAIGN_MUTATIONS: '1',
    GOOGLE_ADS_CAMPAIGN_PUBLISH: '0',
    GOOGLE_ADS_BUDGET_MUTATIONS: '1',
    GOOGLE_ADS_STATUS_MUTATIONS: '1',
    GTM_INTEGRATION: '1',
    GTM_MANAGED_PUBLISH: '0'
  },
  () => {
    assert.equal(campaignBuilderEnabled(), true);
    assert.equal(campaignMutationsEnabled(), true);
    assert.equal(campaignPublishEnabled(), false);
    assert.equal(budgetMutationsEnabled(), true);
    assert.equal(statusMutationsEnabled(), true);
    assert.equal(gtmIntegrationEnabled(), true);
    assert.equal(gtmManagedPublishEnabled(), false);
    assert.equal(canUseCapability({ role: 'super' }, 'draft'), true);
    assert.equal(canUseCapability({ role: 'client' }, 'draft'), false);
    assert.equal(canUseCapability({ role: 'client' }, 'view'), true);
    const snap = flagSnapshot();
    assert.equal(snap.GOOGLE_ADS_CAMPAIGN_BUILDER, true);
    assert.equal(snap.GOOGLE_ADS_CAMPAIGN_PUBLISH, false);
    assert.equal(snap.GTM_MANAGED_PUBLISH, false);
  }
);

console.log('ads-campaign-builder-flags.test.js: ok');
