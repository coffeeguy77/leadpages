'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildKeywordGap,
  cleanDomain,
  normKw,
  competitionGateway,
  discoverCompetitors,
  discoverFromSerpSeeds
} = require('../lib/search-intelligence/competition-analysis');
const {
  isForbiddenCompetitorDomain,
  isHardcodedFixtureDomain,
  filterCompetitorDomains,
  FORBIDDEN_COMPETITOR_DOMAINS
} = require('../lib/search-intelligence/competition-fixtures');
const { createGateway } = require('../lib/search-intelligence/providers/gateway');

assert.equal(normKw('  Hot Water System '), 'hot water system');
assert.equal(cleanDomain('https://www.Rival-Plumb.com.au/page'), 'rival-plumb.com.au');

FORBIDDEN_COMPETITOR_DOMAINS.forEach(function (d) {
  assert.equal(isHardcodedFixtureDomain(d), true, d);
  assert.equal(isForbiddenCompetitorDomain(d), true, d);
});
assert.equal(isForbiddenCompetitorDomain('comp-1-coffeeevents.example'), true);
assert.equal(isHardcodedFixtureDomain('comp-1-coffeeevents.example'), false);
assert.deepEqual(
  filterCompetitorDomains([
    'rival-plumb.com.au',
    'https://www.RealCoffeeRivals.com.au/',
    { domain: 'act-drainmasters.com.au' },
    'bean-hire.com.au'
  ]),
  ['realcoffeerivals.com.au', 'bean-hire.com.au']
);

const gap = buildKeywordGap(
  [
    { keyword: 'coffee cart hire canberra', position: 8, volume: 720, url: '/a' },
    { keyword: 'barista hire canberra', position: 6, volume: 390 }
  ],
  [
    {
      domain: 'rival-coffee.com.au',
      keywords: [
        { keyword: 'coffee cart hire canberra', position: 3, volume: 720 },
        { keyword: 'mobile barista canberra', position: 4, volume: 540 },
        { keyword: 'espresso cart hire act', position: 7, volume: 310 }
      ]
    },
    {
      domain: 'act-espresso.com.au',
      keywords: [
        { keyword: 'coffee cart hire canberra', position: 5, volume: 720 },
        { keyword: 'mobile barista canberra', position: 6, volume: 540 }
      ]
    }
  ]
);

assert.equal(gap.counts.missing, 2);
assert.ok(gap.missing.some(function (r) { return r.keyword === 'mobile barista canberra'; }));
assert.ok(gap.missing.some(function (r) { return r.keyword === 'espresso cart hire act'; }));
assert.equal(gap.counts.weak, 1);
assert.equal(gap.weak[0].keyword, 'coffee cart hire canberra');
assert.equal(gap.weak[0].ownPosition, 8);
assert.equal(gap.weak[0].bestRivalPosition, 3);
assert.equal(gap.counts.shared, 1);

async function runGatewayMock() {
  const prev = process.env.SI_PROVIDER;
  const prevAllow = process.env.SI_COMPETITION_ALLOW_MOCK;
  const prevLogin = process.env.DATAFORSEO_LOGIN;
  const prevPass = process.env.DATAFORSEO_PASSWORD;
  delete process.env.DATAFORSEO_LOGIN;
  delete process.env.DATAFORSEO_PASSWORD;
  process.env.SI_PROVIDER = 'mock';

  // Customer path: no DataForSEO → never fall through to plumber mock rivals
  const blocked = competitionGateway({});
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'market_provider_required');

  process.env.SI_COMPETITION_ALLOW_MOCK = '1';
  const gate = competitionGateway({ provider: 'mock', allowMock: true });
  assert.equal(gate.ok, true);
  assert.equal(gate.provider, 'mock');

  const gw = createGateway({ provider: 'mock' });
  assert.ok(gw.ops.indexOf('competitorsDomain') >= 0);
  assert.ok(gw.ops.indexOf('rankedKeywords') >= 0);

  const coffeeDomain = 'coffeeevents.com.au';
  const rivals = await gw.competitorsDomain({ domain: coffeeDomain });
  assert.equal(rivals.ok, true);
  assert.ok(rivals.competitors.length >= 3);
  rivals.competitors.forEach(function (c) {
    assert.ok(!/plumb|drain|pipe/i.test(c.domain), 'must not leak plumber fixtures: ' + c.domain);
    assert.ok(String(c.domain).indexOf('coffeeevents') >= 0, 'rival should derive from seed domain: ' + c.domain);
  });

  const ranked = await gw.rankedKeywords({ domain: coffeeDomain, itemType: 'organic' });
  assert.equal(ranked.ok, true);
  assert.ok(ranked.keywords.length >= 1);
  ranked.keywords.forEach(function (k) {
    assert.ok(!/plumb|drain/i.test(k.keyword), 'ranked KW must follow domain seed: ' + k.keyword);
  });

  const paid = await gw.rankedKeywords({
    domain: 'comp-1-coffeeevents.example',
    itemType: 'paid'
  });
  assert.equal(paid.ok, true);
  assert.ok(paid.keywords.length >= 1);

  const refs = await gw.referringDomains({ domain: coffeeDomain, dofollowOnly: true });
  assert.equal(refs.ok, true);
  assert.ok(refs.referringDomains.every(function (r) { return r.dofollow > 0; }));

  const pages = await gw.domainPages({ domain: coffeeDomain });
  assert.equal(pages.ok, true);
  assert.ok(pages.pages.length >= 1);

  const site = {
    id: 'test-site',
    business_name: 'Coffee Events',
    custom_domain: coffeeDomain,
    config: {
      competitors: [
        'rival-plumb.com.au',
        'canberra-pipes.com.au',
        'act-drainmasters.com.au',
        'queanbeyan-plumbing.com.au'
      ],
      business: { serviceArea: 'Canberra & ACT' }
    }
  };

  const discovered = await discoverCompetitors(null, site, {
    allowMock: true,
    provider: 'mock',
    saveToConfig: false
  });
  assert.equal(discovered.ok, true);
  assert.ok(discovered.competitors.length >= 1);
  discovered.competitors.forEach(function (c) {
    assert.ok(!isHardcodedFixtureDomain(c.domain), c.domain);
    assert.ok(!/plumb|drain|pipe/i.test(c.domain), c.domain);
  });

  const fromSeeds = await discoverFromSerpSeeds(null, site, {
    allowMock: true,
    provider: 'mock',
    seeds: 'coffee cart hire canberra',
    saveToConfig: false
  });
  assert.equal(fromSeeds.ok, true);
  assert.ok(fromSeeds.competitors.length >= 1);
  fromSeeds.competitors.forEach(function (c) {
    assert.ok(!/plumb|drain|pipe/i.test(c.domain), 'SERP seed discovery leaked plumber: ' + c.domain);
  });

  if (prev == null) delete process.env.SI_PROVIDER;
  else process.env.SI_PROVIDER = prev;
  if (prevAllow == null) delete process.env.SI_COMPETITION_ALLOW_MOCK;
  else process.env.SI_COMPETITION_ALLOW_MOCK = prevAllow;
  if (prevLogin == null) delete process.env.DATAFORSEO_LOGIN;
  else process.env.DATAFORSEO_LOGIN = prevLogin;
  if (prevPass == null) delete process.env.DATAFORSEO_PASSWORD;
  else process.env.DATAFORSEO_PASSWORD = prevPass;
}

runGatewayMock().then(function () {
  const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.ok(manage.indexOf("competition','Competition") >= 0);
  assert.ok(manage.indexOf('_siLoadCompetition') >= 0);
  assert.ok(manage.indexOf('/api/search-intelligence/competition') >= 0);
  assert.ok(manage.indexOf('coffee cart hire canberra') >= 0);
  assert.ok(manage.indexOf('clear_competitors') >= 0);
  assert.ok(manage.indexOf('marketProviderReady') >= 0);
  assert.ok(manage.indexOf('si-premium-box') >= 0);
  assert.ok(manage.indexOf('si-free-box') >= 0);
  assert.ok(manage.indexOf('premiumSeo') >= 0 || manage.indexOf('premium-seo') >= 0);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/competition.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/competition-analysis.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/competition-fixtures.js')));
  const mockSrc = fs.readFileSync(
    path.join(__dirname, '..', 'lib/search-intelligence/providers/mock.js'),
    'utf8'
  );
  assert.ok(mockSrc.indexOf('rival-plumb.com.au') < 0);
  assert.ok(mockSrc.indexOf('canberra-pipes.com.au') < 0);
  assert.ok(mockSrc.indexOf('act-drainmasters.com.au') < 0);
  assert.ok(mockSrc.indexOf('queanbeyan-plumbing.com.au') < 0);
  console.log('si-competition-analysis.test.js: ok');
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
