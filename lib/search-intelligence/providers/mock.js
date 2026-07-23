'use strict';

/**
 * Mock Search Intelligence provider — deterministic fixtures for tests/docs.
 */
const types = require('./types');

const FIXTURE_KEYWORDS = [
  { keyword: 'plumber canberra', volume: 720, cpc: 18.5, competition: 0.62, difficulty: 28, intent: 'transactional', localIntent: true },
  { keyword: 'emergency plumber canberra', volume: 390, cpc: 32.0, competition: 0.71, difficulty: 34, intent: 'transactional', localIntent: true },
  { keyword: 'hot water system replacement canberra', volume: 210, cpc: 14.2, competition: 0.48, difficulty: 22, intent: 'commercial', localIntent: true }
];

async function keywordIdeas(input) {
  const seed = String((input && input.keyword) || '').toLowerCase();
  const rows = FIXTURE_KEYWORDS
    .filter(function (k) { return !seed || k.keyword.indexOf(seed.split(' ')[0]) >= 0 || seed.indexOf('plumb') >= 0; })
    .map(function (k) {
      return types.keywordIdea(Object.assign({}, k, {
        location: (input && input.location) || 'Canberra,AU',
        provider: 'mock',
        labelClass: 'estimated'
      }));
    });
  return { ok: true, provider: 'mock', ideas: rows.length ? rows : FIXTURE_KEYWORDS.map(function (k) {
    return types.keywordIdea(Object.assign({}, k, { provider: 'mock', location: (input && input.location) || null }));
  }) };
}

async function serp(input) {
  const keyword = (input && input.keyword) || 'plumber canberra';
  return {
    ok: true,
    provider: 'mock',
    snapshot: types.serpSnapshot({
      keyword: keyword,
      location: (input && input.location) || 'Canberra,AU',
      device: (input && input.device) || 'mobile',
      provider: 'mock',
      features: ['local_pack', 'people_also_ask'],
      results: [
        types.serpResult({ rank: 1, type: 'maps', domain: 'maps.google.com', title: 'Local pack' }),
        types.serpResult({ rank: 1, type: 'organic', url: 'https://example-plumber.com.au/', domain: 'example-plumber.com.au', title: 'Canberra Plumber' }),
        types.serpResult({ rank: 2, type: 'organic', url: 'https://rival.example/', domain: 'rival.example', title: 'Rival Plumbing' })
      ]
    })
  };
}

async function domainOverview(input) {
  const domain = (input && input.domain) || 'example-plumber.com.au';
  return {
    ok: true,
    provider: 'mock',
    competitor: types.competitorDomain({
      domain: domain,
      visibilityEstimate: 12.4,
      overlapCount: 18,
      competitorType: 'business',
      provider: 'mock'
    })
  };
}

async function rankCheck(input) {
  const keyword = (input && input.keyword) || 'plumber canberra';
  // Deterministic-ish position from keyword for demos (4–18).
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) hash = (hash + keyword.charCodeAt(i) * (i + 1)) % 97;
  const position = 4 + (hash % 15);
  return {
    ok: true,
    provider: 'mock',
    observation: types.rankObservation({
      keyword: keyword,
      url: (input && input.url) || null,
      position: position,
      device: (input && input.device) || 'mobile',
      geo: (input && input.geo) || 'Canberra,AU',
      provider: 'mock',
      features: position <= 10 ? ['local_pack'] : []
    })
  };
}

module.exports = {
  id: 'mock',
  keywordIdeas: keywordIdeas,
  serp: serp,
  domainOverview: domainOverview,
  rankCheck: rankCheck
};
