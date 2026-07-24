'use strict';

const assert = require('assert');
const {
  applyKeywordMetrics,
  collectKeywordTexts,
  normKw
} = require('../lib/google-ads/keyword-metrics');

assert.equal(normKw('  Coffee Cart Hire '), 'coffee cart hire');

const plan = {
  geoFocus: 'Canberra',
  metricsNote: 'placeholder',
  adGroups: [
    {
      name: 'Coffee Cart Hire — Canberra',
      keywords: [
        { keyword: 'coffee cart hire canberra', matchType: 'PHRASE', intent: 'commercial' },
        { keyword: 'coffee cart hire', matchType: 'EXACT', intent: 'commercial' },
        { keyword: 'best coffee cart hire canberra', matchType: 'PHRASE', intent: 'research' }
      ]
    }
  ]
};

assert.deepEqual(collectKeywordTexts(plan), [
  'coffee cart hire canberra',
  'coffee cart hire',
  'best coffee cart hire canberra'
]);

// No live market → do not invent; note explains gap
applyKeywordMetrics(plan, { liveMarket: false, measured: {}, ideas: [] });
assert.equal(plan.adGroups[0].keywords[0].volume, null);
assert.equal(plan.adGroups[0].keywords[0].cpc, null);
assert.match(plan.metricsNote, /never invented/i);
assert.equal(plan.keywordMetrics.liveMarket, false);

// Measured Ads CPC wins for CPC; market fills volume
applyKeywordMetrics(plan, {
  liveMarket: true,
  provider: 'dataforseo',
  measured: {
    'coffee cart hire canberra': {
      cpc: 4.25,
      clicks: 12,
      source: 'ads_keyword_daily',
      labelClass: 'measured'
    }
  },
  ideas: [
    {
      keyword: 'coffee cart hire canberra',
      volume: 210,
      cpc: 3.1,
      competition: 0.4,
      labelClass: 'estimated'
    },
    {
      keyword: 'coffee cart hire',
      volume: 480,
      cpc: 2.8,
      labelClass: 'estimated'
    }
  ]
});

const k0 = plan.adGroups[0].keywords[0];
assert.equal(k0.volume, 210);
assert.equal(k0.cpc, 4.25);
assert.equal(k0.cpcSource, 'ads_measured');
assert.equal(k0.metricsLabelClass, 'measured');

const k1 = plan.adGroups[0].keywords[1];
assert.equal(k1.volume, 480);
assert.equal(k1.cpc, 2.8);
assert.equal(k1.cpcSource, 'dataforseo');

assert.match(plan.metricsNote, /measured Ads CPC/i);
assert.match(plan.metricsNote, /dataforseo/i);

// Mock ideas must not apply when liveMarket false even if ideas present
const plan2 = {
  adGroups: [{ keywords: [{ keyword: 'plumber canberra' }] }]
};
applyKeywordMetrics(plan2, {
  liveMarket: false,
  ideas: [{ keyword: 'plumber canberra', volume: 999, cpc: 99 }]
});
assert.equal(plan2.adGroups[0].keywords[0].volume, null);
assert.equal(plan2.adGroups[0].keywords[0].cpc, null);

console.log('ads-planner-keyword-metrics.test.js: ok');
