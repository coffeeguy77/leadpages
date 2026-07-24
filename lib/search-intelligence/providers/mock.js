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

function hashSeed(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}

function synthesiseFromSeed(seed, location) {
  const raw = String(seed || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!raw) return [];
  const h = hashSeed(raw);
  const variants = [
    raw,
    'best ' + raw,
    raw + ' near me',
    raw + ' cost',
    raw + ' course',
    'affordable ' + raw
  ];
  const seen = {};
  const out = [];
  variants.forEach(function (kw, idx) {
    const k = kw.replace(/\s+/g, ' ').trim();
    if (!k || k.length < 3 || seen[k]) return;
    seen[k] = true;
    out.push({
      keyword: k,
      volume: 80 + ((h >> (idx * 3)) % 900),
      cpc: Number((4 + ((h >> (idx + 2)) % 280) / 10).toFixed(1)),
      competition: Number((0.25 + ((h >> idx) % 50) / 100).toFixed(2)),
      difficulty: 15 + ((h + idx * 17) % 45),
      intent: idx === 3 ? 'commercial' : 'transactional',
      localIntent: /\b(canberra|sydney|melbourne|brisbane|perth|adelaide|near me)\b/i.test(k),
      location: location || null,
      provider: 'mock',
      labelClass: 'estimated'
    });
  });
  return out.slice(0, 6);
}

async function keywordIdeas(input) {
  const seed = String((input && input.keyword) || '')
    .toLowerCase()
    .trim();
  const location = (input && input.location) || 'Australia';
  const seedTokens = seed.split(/\s+/).filter(Boolean);
  // Ignore geo/stop words when matching fixtures so "barista … canberra"
  // never collapses to plumber canberra fixtures.
  const LOCATION_STOP = {
    canberra: 1,
    sydney: 1,
    melbourne: 1,
    brisbane: 1,
    perth: 1,
    adelaide: 1,
    hobart: 1,
    darwin: 1,
    australia: 1,
    au: 1,
    near: 1,
    me: 1,
    the: 1,
    and: 1,
    for: 1,
    in: 1
  };
  const serviceTokens = seedTokens.filter(function (t) {
    return t.length >= 3 && !LOCATION_STOP[t];
  });
  const matched =
    serviceTokens.length === 0
      ? []
      : FIXTURE_KEYWORDS.filter(function (k) {
          return serviceTokens.some(function (t) {
            return k.keyword.indexOf(t) >= 0;
          });
        }).map(function (k) {
          return types.keywordIdea(
            Object.assign({}, k, {
              location: location,
              provider: 'mock',
              labelClass: 'estimated'
            })
          );
        });

  if (matched.length) {
    return { ok: true, provider: 'mock', ideas: matched };
  }

  // Never fall back to unrelated plumber fixtures — synthesise from the seed.
  const synth = synthesiseFromSeed(seed, location).map(function (k) {
    return types.keywordIdea(k);
  });
  return {
    ok: true,
    provider: 'mock',
    ideas: synth.length
      ? synth
      : [
          types.keywordIdea({
            keyword: seed || 'keyword research',
            volume: 100,
            cpc: 5,
            competition: 0.4,
            difficulty: 20,
            intent: 'commercial',
            localIntent: false,
            location: location,
            provider: 'mock',
            labelClass: 'estimated'
          })
        ],
    note: 'Mock provider — estimated ideas derived from your seed. Set DATAFORSEO credentials for live volumes.'
  };
}

async function serp(input) {
  const keyword = (input && input.keyword) || 'plumber canberra';
  const withAi = /ai|overview|brand|chatgpt|who is/i.test(keyword) || (input && input.forceAi);
  const results = [
    types.serpResult({ rank: 1, type: 'maps', domain: 'maps.google.com', title: 'Local pack' }),
    types.serpResult({
      rank: 1,
      type: 'organic',
      url: 'https://rival.example/',
      domain: 'rival.example',
      title: 'Rival Plumbing'
    }),
    types.serpResult({
      rank: 2,
      type: 'organic',
      url: 'https://example-plumber.com.au/',
      domain: 'example-plumber.com.au',
      title: 'Canberra Plumber'
    })
  ];
  const features = ['local_pack', 'people_also_ask'];
  if (withAi) {
    features.push('ai_overview');
    results.push(
      types.serpResult({
        rank: 1,
        type: 'ai_overview',
        domain: 'rival.example',
        url: 'https://rival.example/guide',
        title: 'Rival cited in AI overview'
      }),
      types.serpResult({
        rank: 2,
        type: 'ai_overview',
        domain: 'directory.example',
        url: 'https://directory.example/plumber',
        title: 'Directory citation'
      })
    );
  }
  return {
    ok: true,
    provider: 'mock',
    snapshot: types.serpSnapshot({
      keyword: keyword,
      location: (input && input.location) || 'Canberra,AU',
      device: (input && input.device) || 'mobile',
      provider: 'mock',
      features: features,
      results: results,
      labelClass: 'estimated'
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
  // Deterministic demo position (4–18). Always labelled estimated — not live Google.
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
      features: position <= 10 ? ['local_pack'] : [],
      labelClass: 'estimated',
      note: 'mock_not_live_google'
    })
  };
}

async function mapsGrid(input) {
  const keyword = (input && input.keyword) || 'plumber canberra';
  const lat = input && input.lat != null ? Number(input.lat) : -35.28;
  const lng = input && input.lng != null ? Number(input.lng) : 149.13;
  // Deterministic presence: cells near centre include demo domain; edges do not.
  const nearCentre = Math.abs(lat + 35.2809) < 0.03 && Math.abs(lng - 149.13) < 0.03;
  const results = [
    types.serpResult({
      rank: 1,
      type: 'maps',
      domain: nearCentre ? 'example-plumber.com.au' : 'rival.example',
      title: nearCentre ? 'Demo Plumbing Canberra' : 'Rival Plumbing',
      url: nearCentre ? 'https://example-plumber.com.au/' : 'https://rival.example/'
    }),
    types.serpResult({
      rank: 2,
      type: 'maps',
      domain: 'maps.google.com',
      title: 'Another Local Biz'
    })
  ];
  return {
    ok: true,
    provider: 'mock',
    snapshot: types.serpSnapshot({
      keyword: keyword,
      location: lat + ',' + lng,
      device: (input && input.device) || 'mobile',
      provider: 'mock',
      features: ['local_pack', 'maps'],
      results: results,
      labelClass: 'estimated'
    })
  };
}

async function backlinkSummary(input) {
  const domain = (input && input.domain) || 'example-plumber.com.au';
  return {
    ok: true,
    provider: 'mock',
    summary: types.backlinkSummary({
      domain: domain,
      referringDomains: 42,
      backlinks: 180,
      newLost: { new: 3, lost: 1 },
      provider: 'mock',
      labelClass: 'estimated'
    })
  };
}

module.exports = {
  id: 'mock',
  keywordIdeas: keywordIdeas,
  serp: serp,
  mapsGrid: mapsGrid,
  domainOverview: domainOverview,
  rankCheck: rankCheck,
  backlinkSummary: backlinkSummary,
  synthesiseFromSeed: synthesiseFromSeed
};
