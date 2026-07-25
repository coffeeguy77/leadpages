'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildKeywordGap,
  cleanDomain,
  normKw
} = require('../lib/search-intelligence/competition-analysis');
const { createGateway } = require('../lib/search-intelligence/providers/gateway');

assert.equal(normKw('  Hot Water System '), 'hot water system');
assert.equal(cleanDomain('https://www.Rival-Plumb.com.au/page'), 'rival-plumb.com.au');

const gap = buildKeywordGap(
  [
    { keyword: 'plumber canberra', position: 8, volume: 720, url: '/a' },
    { keyword: 'blocked drain canberra', position: 6, volume: 390 }
  ],
  [
    {
      domain: 'rival-plumb.com.au',
      keywords: [
        { keyword: 'plumber canberra', position: 3, volume: 720 },
        { keyword: 'hot water system canberra', position: 4, volume: 540 },
        { keyword: 'gas fitter canberra', position: 7, volume: 310 }
      ]
    },
    {
      domain: 'canberra-pipes.com.au',
      keywords: [
        { keyword: 'plumber canberra', position: 5, volume: 720 },
        { keyword: 'hot water system canberra', position: 6, volume: 540 }
      ]
    }
  ]
);

assert.equal(gap.counts.missing, 2);
assert.ok(gap.missing.some(function (r) { return r.keyword === 'hot water system canberra'; }));
assert.ok(gap.missing.some(function (r) { return r.keyword === 'gas fitter canberra'; }));
assert.equal(gap.counts.weak, 1);
assert.equal(gap.weak[0].keyword, 'plumber canberra');
assert.equal(gap.weak[0].ownPosition, 8);
assert.equal(gap.weak[0].bestRivalPosition, 3);
assert.equal(gap.counts.shared, 1);

async function runGatewayMock() {
  const prev = process.env.SI_PROVIDER;
  process.env.SI_PROVIDER = 'mock';
  const gw = createGateway({ provider: 'mock' });
  assert.ok(gw.ops.indexOf('competitorsDomain') >= 0);
  assert.ok(gw.ops.indexOf('rankedKeywords') >= 0);
  assert.ok(gw.ops.indexOf('domainIntersection') >= 0);
  assert.ok(gw.ops.indexOf('referringDomains') >= 0);
  assert.ok(gw.ops.indexOf('domainPages') >= 0);

  const rivals = await gw.competitorsDomain({ domain: 'example-plumber.com.au' });
  assert.equal(rivals.ok, true);
  assert.ok(rivals.competitors.length >= 3);

  const ranked = await gw.rankedKeywords({ domain: 'rival-plumb.com.au', itemType: 'organic' });
  assert.equal(ranked.ok, true);
  assert.ok(ranked.keywords.length >= 3);

  const paid = await gw.rankedKeywords({ domain: 'rival-plumb.com.au', itemType: 'paid' });
  assert.equal(paid.ok, true);
  assert.ok(paid.keywords.length >= 1);

  const refs = await gw.referringDomains({ domain: 'rival-plumb.com.au', dofollowOnly: true });
  assert.equal(refs.ok, true);
  assert.ok(refs.referringDomains.every(function (r) { return r.dofollow > 0; }));

  const pages = await gw.domainPages({ domain: 'rival-plumb.com.au' });
  assert.equal(pages.ok, true);
  assert.ok(pages.pages.length >= 1);

  if (prev == null) delete process.env.SI_PROVIDER;
  else process.env.SI_PROVIDER = prev;
}

runGatewayMock().then(function () {
  const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.ok(manage.indexOf("competition','Competition") >= 0);
  assert.ok(manage.indexOf('_siLoadCompetition') >= 0);
  assert.ok(manage.indexOf('/api/search-intelligence/competition') >= 0);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/competition.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/competition-analysis.js')));
  console.log('si-competition-analysis.test.js: ok');
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
