'use strict';

/**
 * Mock Search Intelligence provider — deterministic fixtures for tests/docs.
 * Competition rivals MUST be derived from the caller's domain / keyword seed.
 * Never return hard-coded plumber domains for unrelated businesses.
 */
const types = require('./types');
const {
  slugFromDomain,
  serviceTokensFromDomain,
  cleanDomain
} = require('../competition-fixtures');

/** Legacy keyword fixtures — only match when the seed itself is plumbing-related. */
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
  const keyword = String((input && input.keyword) || 'local service').trim() || 'local service';
  const withAi = /ai|overview|brand|chatgpt|who is/i.test(keyword) || (input && input.forceAi);
  const tokens = serviceTokensFromDomain('', keyword);
  const slug = (tokens.slice(0, 2).join('-') || 'local').slice(0, 32);
  const titleBase = tokens.slice(0, 3).join(' ') || keyword;
  const results = [
    types.serpResult({ rank: 1, type: 'maps', domain: 'maps.google.com', title: 'Local pack' }),
    types.serpResult({
      rank: 1,
      type: 'organic',
      url: 'https://comp-1-' + slug + '.example/',
      domain: 'comp-1-' + slug + '.example',
      title: titleBase + ' — competitor A'
    }),
    types.serpResult({
      rank: 2,
      type: 'organic',
      url: 'https://comp-2-' + slug + '.example/',
      domain: 'comp-2-' + slug + '.example',
      title: titleBase + ' — competitor B'
    }),
    types.serpResult({
      rank: 3,
      type: 'organic',
      url: 'https://comp-3-' + slug + '.example/',
      domain: 'comp-3-' + slug + '.example',
      title: titleBase + ' directory listing'
    })
  ];
  const features = ['local_pack', 'people_also_ask'];
  if (withAi) {
    features.push('ai_overview');
    results.push(
      types.serpResult({
        rank: 1,
        type: 'ai_overview',
        domain: 'comp-1-' + slug + '.example',
        url: 'https://comp-1-' + slug + '.example/guide',
        title: 'Competitor cited in AI overview'
      }),
      types.serpResult({
        rank: 2,
        type: 'ai_overview',
        domain: 'comp-2-' + slug + '.example',
        url: 'https://comp-2-' + slug + '.example/about',
        title: 'Second citation'
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
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
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
  const keyword = (input && input.keyword) || 'local service';
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
  const keyword = String((input && input.keyword) || 'local service').trim() || 'local service';
  const lat = input && input.lat != null ? Number(input.lat) : -35.28;
  const lng = input && input.lng != null ? Number(input.lng) : 149.13;
  const nearCentre = Math.abs(lat + 35.2809) < 0.03 && Math.abs(lng - 149.13) < 0.03;
  const slug = (serviceTokensFromDomain('', keyword).slice(0, 2).join('-') || 'local').slice(0, 28);
  const results = [
    types.serpResult({
      rank: 1,
      type: 'maps',
      domain: nearCentre ? 'comp-1-' + slug + '.example' : 'comp-2-' + slug + '.example',
      title: nearCentre ? keyword + ' — demo listing' : keyword + ' — rival listing',
      url: 'https://comp-1-' + slug + '.example/'
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
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
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

async function competitorsDomain(input) {
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
  const slug = slugFromDomain(domain);
  const h = hashSeed(slug);
  // Rivals are synthetic hosts derived from THIS domain — never a hard-coded trade list.
  const rivals = [1, 2, 3, 4].map(function (i) {
    return {
      domain: 'comp-' + i + '-' + slug + '.example',
      overlap: 50 - i * 8 + (h % 5),
      etv: 1000 - i * 180 + (h % 40),
      count: 220 - i * 35,
      paid: i === 3 ? 0 : Math.max(0, 14 - i * 3)
    };
  });
  return {
    ok: true,
    provider: 'mock',
    domain: domain,
    competitors: rivals.map(function (r) {
      return types.competitorDomain({
        domain: r.domain,
        overlapCount: r.overlap,
        competitionLevel: r.overlap,
        visibilityEstimate: r.etv,
        organicKeywords: r.count,
        organicTraffic: r.etv,
        paidKeywords: r.paid,
        paidTraffic: r.paid * 40,
        avgPosition: 12,
        competitorType: 'search',
        provider: 'mock',
        labelClass: 'estimated'
      });
    }),
    labelClass: 'estimated',
    note: 'Mock rivals derived from domain "' + domain + '" only — not live market data.'
  };
}

async function rankedKeywords(input) {
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
  const itemType = String((input && input.itemType) || 'organic').toLowerCase() === 'paid' ? 'paid' : 'organic';
  const location = (input && (input.location || input.geo)) || 'Canberra';
  const tokens = serviceTokensFromDomain(domain, input && input.businessName);
  const seedPhrase =
    (tokens.length ? tokens.join(' ') : slugFromDomain(domain).replace(/-/g, ' ')) +
    ' ' +
    String(location).split(/[&,]/)[0].trim().toLowerCase();
  const synth = synthesiseFromSeed(seedPhrase.trim(), location);
  const isComp = /^comp-\d+-/i.test(domain);
  const keywords = synth.map(function (r, idx) {
    return types.rankedKeyword({
      keyword: r.keyword,
      volume: r.volume,
      cpc: r.cpc,
      competition: r.competition,
      position: isComp ? 2 + idx : 6 + idx * 2,
      url: 'https://' + domain + '/' + String(r.keyword).replace(/\s+/g, '-').slice(0, 40),
      etv: Math.round((r.volume || 0) * 0.12),
      itemType: itemType,
      provider: 'mock',
      labelClass: 'estimated'
    });
  });
  const paid = itemType === 'paid' ? keywords.slice(0, 3).map(function (k, idx) {
    return Object.assign({}, k, { position: 1 + (idx % 2), itemType: 'paid' });
  }) : keywords;
  return {
    ok: true,
    provider: 'mock',
    domain: domain,
    itemType: itemType,
    keywords: itemType === 'paid' ? (isComp ? paid : []) : keywords,
    totalCount: (itemType === 'paid' ? (isComp ? paid : []) : keywords).length,
    labelClass: 'estimated'
  };
}

async function domainIntersection(input) {
  const target1 = cleanDomain(input && (input.target1 || input.domain)) || 'example-site.com.au';
  const target2 = cleanDomain(input && (input.target2 || input.competitor)) || 'comp-1-' + slugFromDomain(target1) + '.example';
  const intersections = !(input && input.intersections === false);
  const location = (input && input.location) || 'Canberra';
  const seed = serviceTokensFromDomain(target1).join(' ') + ' ' + location;
  const synth = synthesiseFromSeed(seed.trim() || target1, location);
  const shared = synth.slice(0, 2).map(function (r, idx) {
    return {
      keyword: r.keyword,
      volume: r.volume,
      cpc: r.cpc,
      position1: 8 + idx,
      position2: 3 + idx
    };
  });
  const missing = synth.slice(2, 5).map(function (r, idx) {
    return {
      keyword: r.keyword,
      volume: r.volume,
      cpc: r.cpc,
      position1: 4 + idx,
      position2: null
    };
  });
  const rows = intersections ? shared : missing;
  return {
    ok: true,
    provider: 'mock',
    target1: target1,
    target2: target2,
    intersections: intersections,
    keywords: rows.map(function (r) {
      return Object.assign({}, r, { provider: 'mock', labelClass: 'estimated' });
    }),
    labelClass: 'estimated'
  };
}

async function referringDomains(input) {
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
  const slug = slugFromDomain(domain);
  const list = [
    { domain: 'news-' + slug + '.example', rank: 420, backlinks: 3, dofollow: 3 },
    { domain: 'directory-' + slug + '.example', rank: 180, backlinks: 1, dofollow: 1 },
    { domain: 'blog-links.example', rank: 95, backlinks: 2, dofollow: 0 },
    { domain: 'partners-' + slug.slice(0, 12) + '.example', rank: 260, backlinks: 1, dofollow: 1 }
  ].filter(function (r) {
    return !(input && input.dofollowOnly) || r.dofollow > 0;
  });
  return {
    ok: true,
    provider: 'mock',
    domain: domain,
    referringDomains: list.map(function (r) {
      return types.referringDomain({
        domain: r.domain,
        rank: r.rank,
        backlinks: r.backlinks,
        dofollow: r.dofollow,
        provider: 'mock',
        labelClass: 'estimated'
      });
    }),
    totalCount: list.length,
    labelClass: 'estimated'
  };
}

async function domainPages(input) {
  const domain = cleanDomain((input && input.domain) || 'example-site.com.au') || 'example-site.com.au';
  const slug = slugFromDomain(domain);
  return {
    ok: true,
    provider: 'mock',
    domain: domain,
    pages: [
      { url: 'https://' + domain + '/' + slug, backlinks: 24, referringDomains: 18, rank: 120, provider: 'mock', labelClass: 'estimated' },
      { url: 'https://' + domain + '/services', backlinks: 16, referringDomains: 12, rank: 90, provider: 'mock', labelClass: 'estimated' },
      { url: 'https://' + domain + '/about', backlinks: 9, referringDomains: 7, rank: 70, provider: 'mock', labelClass: 'estimated' }
    ],
    labelClass: 'estimated'
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
  competitorsDomain: competitorsDomain,
  rankedKeywords: rankedKeywords,
  domainIntersection: domainIntersection,
  referringDomains: referringDomains,
  domainPages: domainPages,
  synthesiseFromSeed: synthesiseFromSeed
};
