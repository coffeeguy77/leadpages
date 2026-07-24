'use strict';

const assert = require('assert');
const {
  applyKeywordMetrics,
  collectKeywordTexts,
  normKw
} = require('../lib/google-ads/keyword-metrics');
const {
  resolveGeoTargetConstants,
  microsToDollars,
  resultToIdea,
  expandIdeasWithVariants,
  GEO
} = require('../lib/google-ads/keyword-planner-metrics');

assert.equal(normKw('  Coffee Cart Hire '), 'coffee cart hire');

assert.deepEqual(resolveGeoTargetConstants('Canberra & ACT'), [
  'geoTargetConstants/' + GEO.CANBERRA
]);
assert.deepEqual(resolveGeoTargetConstants('Australia'), [
  'geoTargetConstants/' + GEO.AUSTRALIA
]);
assert.equal(microsToDollars(2_500_000), 2.5);
assert.equal(microsToDollars(null), null);

const ideaFromAds = resultToIdea({
  text: 'coffee cart hire canberra',
  closeVariants: ['coffee cart hire canberra act'],
  keywordMetrics: {
    avgMonthlySearches: '210',
    competitionIndex: '40',
    lowTopOfPageBidMicros: '1500000',
    highTopOfPageBidMicros: '3500000',
    averageCpcMicros: '2200000'
  }
});
assert.equal(ideaFromAds.volume, 210);
assert.equal(ideaFromAds.cpc, 2.2);
assert.equal(ideaFromAds.competition, 0.4);
assert.equal(ideaFromAds.source, 'google_ads_keyword_planner');

const expanded = expandIdeasWithVariants([ideaFromAds]);
assert.equal(expanded.length, 2);
assert.ok(expanded.some((x) => x.keyword === 'coffee cart hire canberra act'));

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

// Measured Ads CPC wins for CPC; Keyword Planner fills volume
applyKeywordMetrics(plan, {
  liveMarket: true,
  provider: 'google_ads_keyword_planner',
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
assert.equal(k1.cpcSource, 'google_ads_keyword_planner');

assert.match(plan.metricsNote, /measured Ads CPC/i);
assert.match(plan.metricsNote, /Keyword Planner/i);

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
