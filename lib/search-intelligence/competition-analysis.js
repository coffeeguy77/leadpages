'use strict';

/**
 * Competition Analysis workflow via DataForSEO Labs / Backlinks.
 * 1) Core organic competitors (keyword overlap)
 * 2) Keyword gap — Missing / Weak / Shared
 * 3) Backlink strategy — referring domains + top linked pages
 * 4) Paid advertising — competitor paid keywords
 *
 * Never invents metrics; mock adapter is labelled estimated.
 * Third-party SEO suite APIs (e.g. commercial rank trackers) stay out of scope.
 */

const { createGateway } = require('./providers/gateway');
const dataforseo = require('./providers/dataforseo');
const {
  hostFromSite,
  competitorDomainsFromSite,
  persistCompetitors
} = require('./backlink-gap');
const { meterUsage } = require('./usage');
const {
  cleanDomain,
  filterCompetitorDomains,
  isForbiddenCompetitorDomain,
  isHardcodedFixtureDomain
} = require('./competition-fixtures');
const { premiumSeoEntitlementSnapshot } = require('./billing');

function normKw(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Competition market data must be live DataForSEO for customers.
 * Mock plumber fixtures must never be returned or persisted as rivals.
 * Tests may pass allowMock:true or set SI_COMPETITION_ALLOW_MOCK=1.
 */
function competitionGateway(opts) {
  const o = opts || {};
  const allowMock =
    o.allowMock === true ||
    String(process.env.SI_COMPETITION_ALLOW_MOCK || '') === '1' ||
    (o.provider === 'mock' &&
      (process.env.NODE_ENV === 'test' || String(process.env.SI_PROVIDER || '') === 'mock'));
  if (allowMock && (o.provider === 'mock' || String(process.env.SI_PROVIDER || '') === 'mock')) {
    return { ok: true, gw: createGateway({ provider: 'mock' }), provider: 'mock' };
  }
  if (!dataforseo.configured()) {
    return {
      ok: false,
      error: 'market_provider_required',
      message:
        'Competition Analysis needs DataForSEO (DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD). Demo/mock rivals are never shown for customer sites.'
    };
  }
  return { ok: true, gw: createGateway({ provider: 'dataforseo' }), provider: 'dataforseo' };
}

function rejectMockProvider(res, gwInfo) {
  if (!res) return null;
  if (res.provider === 'mock' && gwInfo && gwInfo.provider !== 'mock') {
    return {
      ok: false,
      error: 'mock_blocked',
      message: 'Refused to use mock competitor fixtures for this site. Configure DataForSEO for live rivals.'
    };
  }
  return null;
}

function locationFromSite(site, override) {
  if (override) return String(override).trim();
  const cfg = (site && site.config) || {};
  return (
    cfg.region ||
    cfg.location ||
    (cfg.seo && (cfg.seo.region || cfg.seo.location)) ||
    'Australia'
  );
}

/**
 * Pure keyword-gap merge — used by tests.
 * @param {object[]} ownKeywords
 * @param {{ domain: string, keywords: object[] }[]} competitorSets
 */
function buildKeywordGap(ownKeywords, competitorSets) {
  const ownMap = {};
  (ownKeywords || []).forEach(function (k) {
    const key = normKw(k.keyword);
    if (!key) return;
    ownMap[key] = k;
  });

  const byKeyword = {};
  (competitorSets || []).forEach(function (set) {
    const domain = cleanDomain(set.domain);
    (set.keywords || []).forEach(function (k) {
      const key = normKw(k.keyword);
      if (!key) return;
      if (!byKeyword[key]) {
        byKeyword[key] = {
          keyword: k.keyword,
          volume: k.volume != null ? Number(k.volume) : null,
          cpc: k.cpc != null ? Number(k.cpc) : null,
          competition: k.competition != null ? Number(k.competition) : null,
          ownPosition: ownMap[key] && ownMap[key].position != null ? Number(ownMap[key].position) : null,
          ownUrl: (ownMap[key] && ownMap[key].url) || null,
          rivals: []
        };
      }
      const row = byKeyword[key];
      if (row.volume == null && k.volume != null) row.volume = Number(k.volume);
      if (row.cpc == null && k.cpc != null) row.cpc = Number(k.cpc);
      row.rivals.push({
        domain: domain,
        position: k.position != null ? Number(k.position) : null,
        url: k.url || null
      });
    });
  });

  const missing = [];
  const weak = [];
  const shared = [];
  Object.keys(byKeyword).forEach(function (key) {
    const row = byKeyword[key];
    row.rivalCount = row.rivals.length;
    row.bestRivalPosition = row.rivals.reduce(function (best, r) {
      if (r.position == null) return best;
      if (best == null || r.position < best) return r.position;
      return best;
    }, null);
    if (row.ownPosition == null) {
      missing.push(row);
    } else {
      shared.push(row);
      if (row.bestRivalPosition != null && row.ownPosition > row.bestRivalPosition) {
        weak.push(row);
      }
    }
  });

  function byVol(a, b) {
    return (Number(b.volume) || 0) - (Number(a.volume) || 0);
  }
  missing.sort(byVol);
  weak.sort(byVol);
  shared.sort(byVol);

  return {
    missing: missing,
    weak: weak,
    shared: shared,
    counts: {
      missing: missing.length,
      weak: weak.length,
      shared: shared.length,
      own: Object.keys(ownMap).length
    }
  };
}

async function loadSavedCompetitors(admin, siteId) {
  if (!admin || !siteId) return [];
  try {
    const { data } = await admin
      .from('si_competitors')
      .select('domain,competitor_type,meta')
      .eq('site_id', siteId)
      .limit(20);
    return filterCompetitorDomains(
      (data || []).map(function (r) {
        return r.domain;
      })
    );
  } catch (_e) {
    return [];
  }
}

/**
 * Remove hard-coded mock plumber (and other fixture) domains from site config + si_competitors.
 */
async function purgeForbiddenCompetitors(admin, site) {
  if (!site) return { ok: false, removed: [] };
  const before = competitorDomainsFromSite(site, []);
  const cleaned = filterCompetitorDomains(before);
  const removed = before.filter(function (d) {
    return cleaned.indexOf(cleanDomain(d)) < 0;
  });
  let configSave = null;
  if (admin && site.id && (removed.length || before.length !== cleaned.length)) {
    configSave = await saveCompetitorsToSiteConfig(admin, site, cleaned);
    // Replace list entirely with cleaned (saveCompetitorsToSiteConfig merges — force write)
    try {
      const cfg = Object.assign({}, site.config || {});
      cfg.competitors = cleaned;
      await admin
        .from('sites')
        .update({ config: cfg, updated_at: new Date().toISOString() })
        .eq('id', site.id);
      site.config = cfg;
      configSave = { ok: true, competitors: cleaned };
    } catch (_e) {
      /* ignore */
    }
    try {
      const { data: rows } = await admin.from('si_competitors').select('id,domain').eq('site_id', site.id);
      for (let i = 0; i < (rows || []).length; i++) {
        if (isForbiddenCompetitorDomain(rows[i].domain)) {
          await admin.from('si_competitors').delete().eq('id', rows[i].id);
        }
      }
    } catch (_e) {
      /* schema pending */
    }
  }
  return { ok: true, removed: removed.map(cleanDomain), competitors: cleaned, configSave: configSave };
}

async function saveCompetitorsToSiteConfig(admin, site, domains) {
  if (!admin || !site || !site.id) return { ok: false };
  const cfg = Object.assign({}, site.config || {});
  const existing = filterCompetitorDomains(competitorDomainsFromSite(site, []));
  const incoming = filterCompetitorDomains(domains || []);
  if (!incoming.length && !(domains || []).length) {
    // Explicit clear
    cfg.competitors = [];
  } else {
    const merged = Array.from(new Set(existing.concat(incoming))).slice(0, 12);
    cfg.competitors = merged;
  }
  const merged = cfg.competitors;
  try {
    const { error } = await admin
      .from('sites')
      .update({ config: cfg, updated_at: new Date().toISOString() })
      .eq('id', site.id);
    if (error) return { ok: false, error: error.message };
    site.config = cfg;
    return { ok: true, competitors: merged };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * Discover main organic competitors for the site domain.
 */
async function discoverCompetitors(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message, domain: cleanDomain(o.domain || hostFromSite(site)) };
  }
  const gw = gate.gw;
  const own = cleanDomain(o.domain || hostFromSite(site));
  const location = locationFromSite(site, o.location);
  if (!own) {
    return {
      ok: false,
      error: 'domain_required',
      message: 'Connect a custom domain (or slug) so we can find organic competitors.'
    };
  }

  // Always strip leaked mock plumber fixtures before discovery.
  await purgeForbiddenCompetitors(admin, site);

  const res = await gw.competitorsDomain({
    domain: own,
    location: location,
    limit: o.limit || 10,
    businessName: site && site.business_name
  });
  const blocked = rejectMockProvider(res, gate);
  if (blocked) return Object.assign(blocked, { domain: own });
  if (!res || !res.ok) {
    return {
      ok: false,
      error: (res && res.error) || 'competitors_failed',
      message: (res && res.message) || 'Could not load competitors',
      provider: (res && res.provider) || gw.preferred,
      domain: own
    };
  }

  // Customer path: strip all fixtures + synthetic *.example.
  // Test mock path: strip only hard-coded plumber demos; seed-derived rivals may display (never persist).
  const competitors = (res.competitors || []).filter(function (c) {
    if (!c || !c.domain) return false;
    if (gate.provider === 'mock' || res.provider === 'mock') {
      return !isHardcodedFixtureDomain(c.domain);
    }
    return !isForbiddenCompetitorDomain(c.domain);
  });
  const domains = competitors.map(function (c) {
    return c.domain;
  });

  let persist = null;
  let configSave = null;
  // Never persist mock / fixture rivals onto a customer site.
  const canPersist = gate.provider !== 'mock' && res.provider !== 'mock';
  if (canPersist && admin && site && site.id && domains.length) {
    persist = await persistCompetitors(admin, site.id, domains);
    try {
      for (let i = 0; i < domains.length; i++) {
        await admin.from('si_competitors').upsert(
          {
            site_id: site.id,
            domain: domains[i],
            competitor_type: 'search',
            meta: {
              source: 'competition_analysis',
              competitionLevel: competitors[i] && competitors[i].competitionLevel,
              provider: res.provider
            }
          },
          { onConflict: 'site_id,domain' }
        );
      }
    } catch (_e) {
      /* schema pending */
    }
    if (o.saveToConfig !== false) {
      configSave = await saveCompetitorsToSiteConfig(admin, site, domains);
    }
    await meterUsage(admin, site.id, 'competitors_domain', 1, {
      provider: res.provider,
      domain: own,
      count: domains.length
    });
  }

  return {
    ok: true,
    domain: own,
    location: location,
    competitors: competitors,
    provider: res.provider,
    labelClass: res.labelClass || 'estimated',
    persist: persist,
    configSave: configSave,
    note:
      gate.provider === 'mock'
        ? 'Test/mock rivals derived from YOUR domain only — never trade-specific hardcodes. Not persisted to customer config.'
        : 'Sorted by keyword overlap (Competition Level). DataForSEO Labs estimated market data for ' + own + '.',
    analysedAt: new Date().toISOString()
  };
}

function isSerpRivalType(typ) {
  const t = String(typ || 'organic').toLowerCase();
  return (
    t === 'organic' ||
    t.indexOf('organic') >= 0 ||
    t === 'local_pack' ||
    t === 'local' ||
    t === 'maps' ||
    t === 'places'
  );
}

function isPlatformNoiseDomain(d) {
  return /google\.|facebook\.|youtube\.|instagram\.|linkedin\.|wikipedia\.|apple\.com|bing\.com/.test(
    String(d || '')
  );
}

/**
 * Discover rivals from SERP when domain portfolio is empty / new site.
 * Counts organic + local-pack website domains (local queries rarely return organic alone).
 */
async function discoverFromSerpSeeds(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  const location = locationFromSite(site, o.location);
  await purgeForbiddenCompetitors(admin, site);
  const rawSeeds = Array.isArray(o.seeds)
    ? o.seeds
    : String(o.seeds || o.keyword || '').split(/[,\n]/);
  const seeds = rawSeeds
    .map(function (s) {
      return String(s || '').trim();
    })
    .filter(Boolean)
    .slice(0, 5);
  if (!seeds.length) {
    return { ok: false, error: 'seeds_required', message: 'Enter 1–5 industry keywords to discover rivals from Google results.' };
  }

  const own = cleanDomain(o.domain || hostFromSite(site));
  const counts = {};
  const providers = [];
  const errors = [];
  let rawResultCount = 0;
  for (let i = 0; i < seeds.length; i++) {
    const snap = await gw.serp({
      keyword: seeds[i],
      location: location,
      device: 'desktop',
      siteDomain: own,
      ownDomain: own
    });
    if (!snap || !snap.ok) {
      errors.push({
        keyword: seeds[i],
        error: (snap && (snap.error || snap.message)) || 'serp_failed'
      });
      continue;
    }
    if (snap.provider) providers.push(snap.provider);
    const results = (snap.snapshot && snap.snapshot.results) || [];
    rawResultCount += results.length;
    results.forEach(function (r) {
      if (!r || !isSerpRivalType(r.type)) return;
      const d = cleanDomain(r.domain || r.url);
      if (!d || d === own) return;
      if (gate.provider === 'mock' ? isHardcodedFixtureDomain(d) : isForbiddenCompetitorDomain(d)) return;
      if (isPlatformNoiseDomain(d)) return;
      counts[d] = (counts[d] || 0) + 1;
    });
  }

  if (providers.indexOf('mock') >= 0 && gate.provider !== 'mock') {
    return {
      ok: false,
      error: 'mock_blocked',
      message: 'Refused mock SERP fixtures. Configure DataForSEO for live keyword-based rival discovery.',
      seeds: seeds
    };
  }

  if (!Object.keys(counts).length && errors.length) {
    return {
      ok: false,
      error: 'serp_failed',
      message:
        'Live SERP lookup failed for your keyword(s): ' +
        errors
          .map(function (e) {
            return e.keyword + ' (' + e.error + ')';
          })
          .join('; '),
      seeds: seeds,
      errors: errors
    };
  }

  const competitors = Object.keys(counts)
    .map(function (d) {
      return {
        domain: d,
        overlapCount: counts[d],
        competitionLevel: counts[d],
        competitorType: 'search',
        provider: providers[0] || gw.preferred,
        labelClass: 'measured'
      };
    })
    .sort(function (a, b) {
      return b.overlapCount - a.overlapCount;
    })
    .slice(0, 10);

  const canPersist = gate.provider !== 'mock' && providers.indexOf('mock') < 0;
  if (canPersist && admin && site && site.id && competitors.length) {
    await persistCompetitors(
      admin,
      site.id,
      competitors.map(function (c) {
        return c.domain;
      })
    );
    if (o.saveToConfig !== false) {
      await saveCompetitorsToSiteConfig(
        admin,
        site,
        competitors.map(function (c) {
          return c.domain;
        })
      );
    }
    await meterUsage(admin, site.id, 'serp_competitor_discovery', seeds.length, {
      provider: providers[0] || gw.preferred,
      seeds: seeds
    });
  }

  return {
    ok: true,
    mode: 'serp_seeds',
    seeds: seeds,
    location: location,
    domain: own,
    competitors: competitors,
    rawResultCount: rawResultCount,
    errors: errors,
    provider: providers[0] || gw.preferred,
    labelClass: 'measured',
    note:
      competitors.length
        ? 'Rivals from organic + local Google results for YOUR keywords (' +
          seeds.join(', ') +
          '). Confirm and save before gap analysis.'
        : 'SERP returned ' +
          rawResultCount +
          ' row(s) but no rival websites after filters. Try a broader keyword or check DataForSEO credits.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Semrush-style keyword lookup: your position + who else ranks (organic + local).
 */
async function lookupKeywordSerp(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  const keyword = String(o.keyword || o.seeds || '')
    .split(/[,\n]/)[0]
    .trim();
  if (!keyword) {
    return { ok: false, error: 'keyword_required', message: 'Enter a keyword to look up (e.g. coffee cart hire canberra).' };
  }
  const location = locationFromSite(site, o.location);
  const own = cleanDomain(o.domain || hostFromSite(site));
  const device = o.device === 'mobile' ? 'mobile' : 'desktop';

  const snap = await gw.serp({
    keyword: keyword,
    location: location,
    device: device,
    siteDomain: own,
    ownDomain: own
  });
  if (!snap || !snap.ok) {
    return {
      ok: false,
      error: (snap && snap.error) || 'serp_failed',
      message: (snap && snap.message) || 'Could not load live SERP for this keyword.',
      keyword: keyword,
      location: location
    };
  }
  if (snap.provider === 'mock' && gate.provider !== 'mock') {
    return {
      ok: false,
      error: 'mock_blocked',
      message: 'Refused mock SERP. Configure DataForSEO for live keyword lookup.',
      keyword: keyword
    };
  }

  const results = ((snap.snapshot && snap.snapshot.results) || []).filter(function (r) {
    return r && isSerpRivalType(r.type);
  });

  let ownPosition = null;
  let ownUrl = null;
  let ownType = null;
  const rivals = [];
  results.forEach(function (r) {
    const d = cleanDomain(r.domain || r.url);
    if (!d || isPlatformNoiseDomain(d)) return;
    if (gate.provider === 'mock' ? isHardcodedFixtureDomain(d) : isForbiddenCompetitorDomain(d)) return;
    const row = {
      rank: r.rank != null ? Number(r.rank) : null,
      domain: d,
      url: r.url || null,
      title: r.title || null,
      type: r.type || 'organic',
      isYou: !!(own && d === own)
    };
    if (row.isYou) {
      if (ownPosition == null || (row.rank != null && row.rank < ownPosition)) {
        ownPosition = row.rank;
        ownUrl = row.url;
        ownType = row.type;
      }
    } else {
      rivals.push(row);
    }
  });

  rivals.sort(function (a, b) {
    return (a.rank || 999) - (b.rank || 999);
  });

  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'keyword_serp_lookup', 1, {
      provider: snap.provider,
      keyword: keyword,
      location: location
    });
  }

  return {
    ok: true,
    mode: 'keyword_lookup',
    keyword: keyword,
    location: location,
    device: device,
    domain: own,
    ownPosition: ownPosition,
    ownUrl: ownUrl,
    ownType: ownType,
    rivals: rivals.slice(0, 20),
    serp: results.slice(0, 30).map(function (r) {
      const d = cleanDomain(r.domain || r.url);
      return {
        rank: r.rank,
        domain: d,
        url: r.url || null,
        title: r.title || null,
        type: r.type || 'organic',
        isYou: !!(own && d === own)
      };
    }),
    features: (snap.snapshot && snap.snapshot.features) || [],
    provider: snap.provider,
    labelClass: snap.snapshot && snap.snapshot.labelClass ? snap.snapshot.labelClass : 'measured',
    note:
      ownPosition != null
        ? 'You rank #' +
          ownPosition +
          ' for "' +
          keyword +
          '". Rivals below are other sites on this SERP — open one to see keywords they rank for.'
        : own
          ? 'You (' +
            own +
            ') were not found in the top results for "' +
            keyword +
            '". Rivals below currently occupy this SERP.'
          : 'Connect a custom domain to detect your position. Rivals below currently occupy this SERP.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * What a competitor ranks for (organic) — drill-down after keyword lookup.
 */
async function competitorOrganicKeywords(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  const target = cleanDomain(o.domain || o.competitor);
  if (!target) {
    return { ok: false, error: 'competitor_required', message: 'Pick a competitor domain to inspect their ranked keywords.' };
  }
  if (isForbiddenCompetitorDomain(target) && gate.provider !== 'mock') {
    return { ok: false, error: 'forbidden_fixture', message: 'That domain is a demo fixture and cannot be analysed.' };
  }
  const location = locationFromSite(site, o.location);
  const limit = Math.min(100, Math.max(20, o.limit || 50));
  const res = await gw.rankedKeywords({
    domain: target,
    location: location,
    limit: limit,
    itemType: 'organic'
  });
  if (!res || !res.ok) {
    return {
      ok: false,
      error: (res && res.error) || 'ranked_keywords_failed',
      message: (res && res.message) || 'Could not load keywords for this competitor.',
      domain: target
    };
  }
  if (res.provider === 'mock' && gate.provider !== 'mock') {
    return { ok: false, error: 'mock_blocked', message: 'Refused mock keyword fixtures.', domain: target };
  }

  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'competitor_ranked_keywords', 1, {
      provider: res.provider,
      domain: target
    });
  }

  return {
    ok: true,
    mode: 'competitor_keywords',
    domain: target,
    location: location,
    keywords: (res.keywords || []).slice(0, limit),
    totalCount: res.totalCount != null ? res.totalCount : (res.keywords || []).length,
    provider: res.provider,
    labelClass: res.labelClass || 'estimated',
    note: 'Organic keywords this domain ranks for (Labs). Use these to grow your own content and gap list.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Keyword gap vs up to 4 competitors.
 */
async function runKeywordGap(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  const own = cleanDomain(o.domain || hostFromSite(site));
  const location = locationFromSite(site, o.location);
  if (!own) {
    return { ok: false, error: 'domain_required', message: 'Site domain required for keyword gap.' };
  }
  await purgeForbiddenCompetitors(admin, site);

  let competitors = filterCompetitorDomains(Array.isArray(o.competitors) ? o.competitors : []);
  if (!competitors.length) {
    competitors = filterCompetitorDomains(competitorDomainsFromSite(site, []));
  }
  if (!competitors.length && admin && site && site.id) {
    competitors = await loadSavedCompetitors(admin, site.id);
  }
  competitors = filterCompetitorDomains(Array.from(new Set(competitors))).slice(0, 4);
  if (!competitors.length) {
    return {
      ok: false,
      error: 'competitors_required',
      message: 'Discover or add competitor domains first (up to 4).'
    };
  }

  const limit = Math.min(100, Math.max(20, o.limit || 50));
  const ownRes = await gw.rankedKeywords({
    domain: own,
    location: location,
    limit: limit,
    itemType: 'organic'
  });
  const ownKeywords = ownRes && ownRes.ok ? ownRes.keywords || [] : [];

  const competitorSets = [];
  const errors = [];
  for (let i = 0; i < competitors.length; i++) {
    const d = competitors[i];
    const res = await gw.rankedKeywords({
      domain: d,
      location: location,
      limit: limit,
      itemType: 'organic'
    });
    if (res && res.ok) {
      competitorSets.push({ domain: d, keywords: res.keywords || [] });
    } else {
      errors.push({ domain: d, error: (res && (res.error || res.message)) || 'failed' });
    }
  }

  const gap = buildKeywordGap(ownKeywords, competitorSets);

  // Enrich "missing" with multi-competitor consensus (all rivals rank)
  const missingAll = gap.missing.filter(function (row) {
    return row.rivalCount >= Math.min(2, competitors.length);
  });

  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'keyword_gap', 1 + competitorSets.length, {
      provider: (ownRes && ownRes.provider) || gw.preferred,
      domain: own,
      competitors: competitors.length
    });
  }

  return {
    ok: true,
    domain: own,
    location: location,
    competitors: competitors,
    gap: {
      missing: gap.missing.slice(0, 40),
      missingConsensus: missingAll.slice(0, 25),
      weak: gap.weak.slice(0, 40),
      shared: gap.shared.slice(0, 40),
      counts: gap.counts
    },
    ownKeywordCount: ownKeywords.length,
    errors: errors,
    provider: (ownRes && ownRes.provider) || gw.preferred,
    labelClass: 'estimated',
    note:
      'Missing = rivals rank, you do not. Weak = rivals outrank you (quick wins). Shared = both rank. Estimated Labs data — never invented.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Backlink strategy for one competitor (referring domains + top pages).
 */
async function runBacklinkStrategy(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  await purgeForbiddenCompetitors(admin, site);
  let target = cleanDomain(o.domain || o.competitor);
  if (target && isForbiddenCompetitorDomain(target)) {
    return {
      ok: false,
      error: 'forbidden_fixture',
      message: 'That domain is a demo fixture (e.g. plumber mock data) and cannot be analysed. Clear competitors and discover live rivals for your industry.'
    };
  }
  if (!target) {
    const list = filterCompetitorDomains(competitorDomainsFromSite(site, []));
    target = list[0] || null;
  }
  if (!target && admin && site && site.id) {
    const saved = await loadSavedCompetitors(admin, site.id);
    target = saved[0] || null;
  }
  if (!target) {
    return {
      ok: false,
      error: 'competitor_required',
      message: 'Pick a competitor domain to analyse referring domains.'
    };
  }

  const own = cleanDomain(o.ownDomain || hostFromSite(site));
  const summary = await gw.backlinkSummary({ domain: target });
  const refs = await gw.referringDomains({
    domain: target,
    limit: o.limit || 20,
    dofollowOnly: o.dofollowOnly !== false
  });
  const pages = await gw.domainPages({ domain: target, limit: o.pageLimit || 10 });

  let ownSummary = null;
  if (own) {
    const os = await gw.backlinkSummary({ domain: own });
    if (os && os.ok) ownSummary = os.summary;
  }

  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'backlink_strategy', 3, {
      provider: (refs && refs.provider) || gw.preferred,
      domain: target
    });
  }

  return {
    ok: true,
    domain: target,
    ownDomain: own,
    own: ownSummary,
    summary: summary && summary.ok ? summary.summary : null,
    referringDomains: refs && refs.ok ? refs.referringDomains || [] : [],
    topPages: pages && pages.ok ? pages.pages || [] : [],
    dofollowOnly: o.dofollowOnly !== false,
    provider: (refs && refs.provider) || (summary && summary.provider) || gw.preferred,
    labelClass: 'estimated',
    errors: [
      summary && !summary.ok ? summary.error || summary.message : null,
      refs && !refs.ok ? refs.error || refs.message : null,
      pages && !pages.ok ? pages.error || pages.message : null
    ].filter(Boolean),
    note:
      'Focus Follow (dofollow) referring domains for outreach. Top pages show which URLs earn the most links — replicate topics, not spam.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Competitor PPC — paid keywords from Labs ranked_keywords (item_types paid).
 */
async function runPaidResearch(admin, site, opts) {
  const o = opts || {};
  const gate = competitionGateway(o);
  if (!gate.ok) {
    return { ok: false, error: gate.error, message: gate.message };
  }
  const gw = gate.gw;
  const location = locationFromSite(site, o.location);
  await purgeForbiddenCompetitors(admin, site);
  let competitors = filterCompetitorDomains(Array.isArray(o.competitors) ? o.competitors : []);
  if (!competitors.length) competitors = filterCompetitorDomains(competitorDomainsFromSite(site, []));
  if (!competitors.length && admin && site && site.id) {
    competitors = await loadSavedCompetitors(admin, site.id);
  }
  competitors = Array.from(new Set(competitors)).slice(0, 4);
  if (!competitors.length) {
    return {
      ok: false,
      error: 'competitors_required',
      message: 'Add competitor domains first to inspect paid keywords.'
    };
  }

  const rows = [];
  const errors = [];
  for (let i = 0; i < competitors.length; i++) {
    const d = competitors[i];
    const overview = await gw.domainOverview({ domain: d, location: location });
    const paid = await gw.rankedKeywords({
      domain: d,
      location: location,
      limit: o.limit || 25,
      itemType: 'paid'
    });
    if (paid && paid.ok) {
      rows.push({
        domain: d,
        paidKeywords: overview && overview.competitor ? overview.competitor.paidKeywords : paid.totalCount,
        paidTraffic: overview && overview.competitor ? overview.competitor.paidTraffic : null,
        keywords: (paid.keywords || []).slice(0, 25),
        provider: paid.provider
      });
    } else {
      errors.push({ domain: d, error: (paid && (paid.error || paid.message)) || 'failed' });
    }
  }

  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'paid_research', competitors.length, {
      provider: (rows[0] && rows[0].provider) || gw.preferred
    });
  }

  const sampleAds = [];
  rows.forEach(function (r) {
    (r.keywords || []).slice(0, 5).forEach(function (k) {
      sampleAds.push({
        domain: r.domain,
        keyword: k.keyword,
        position: k.position,
        volume: k.volume,
        cpc: k.cpc,
        url: k.url,
        // Labs does not return full RSA copy; landing URL + keyword are the available creative signals.
        adSignal: k.url ? 'Landing: ' + k.url : null
      });
    });
  });

  return {
    ok: true,
    location: location,
    competitors: rows,
    sampleAds: sampleAds.slice(0, 30),
    errors: errors,
    provider: (rows[0] && rows[0].provider) || gw.preferred,
    labelClass: 'estimated',
    note:
      'Paid keyword positions and CPC from DataForSEO Labs. Full ad-copy RSA text is not always available via Labs — use landing URLs and offers on those pages as creative cues.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * GET snapshot for Competition tab.
 */
async function loadCompetitionSnapshot(admin, site, opts) {
  const o = opts || {};
  const own = cleanDomain(o.domain || hostFromSite(site));
  const purged = await purgeForbiddenCompetitors(admin, site);
  const fromConfig = filterCompetitorDomains(competitorDomainsFromSite(site, []));
  const fromDb = await loadSavedCompetitors(admin, site && site.id);
  const competitors = Array.from(new Set(fromConfig.concat(fromDb))).slice(0, 12);
  const liveReady = !!dataforseo.configured();
  const entitlement = await premiumSeoEntitlementSnapshot(site && site.id, { role: o.role });
  const premium = entitlement.premiumSeo || {};
  return {
    ok: true,
    siteId: site && site.id,
    domain: own,
    location: locationFromSite(site, o.location),
    competitors: competitors,
    marketProviderReady: liveReady,
    premiumSeo: premium,
    purgedFixtures: (purged && purged.removed) || [],
    freeActions: ['save_competitors', 'clear_competitors', 'purge_fixtures'],
    premiumActions: [
      'lookup_keyword',
      'competitor_keywords',
      'discover_competitors',
      'discover_from_serp',
      'keyword_gap',
      'backlink_strategy',
      'paid_research'
    ],
    actions: [
      'lookup_keyword',
      'competitor_keywords',
      'discover_competitors',
      'discover_from_serp',
      'keyword_gap',
      'backlink_strategy',
      'paid_research',
      'save_competitors',
      'clear_competitors',
      'purge_fixtures'
    ],
    note: premium.entitled
      ? liveReady
        ? 'Premium SEO active — live DataForSEO research for YOUR domain and keywords only.'
        : 'Premium SEO active — set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD on the server to run live discovery.'
      : 'Free: save competitor domains manually. Premium SEO unlocks keyword lookup, rival discovery, gap, backlinks, and paid research.'
  };
}

async function saveCompetitors(admin, site, domains) {
  const list = filterCompetitorDomains(domains || []).slice(0, 12);
  const rejected = (domains || [])
    .map(cleanDomain)
    .filter(function (d) {
      return d && isForbiddenCompetitorDomain(d);
    });
  if (!list.length) {
    return {
      ok: false,
      error: rejected.length ? 'forbidden_fixture' : 'competitors_required',
      message: rejected.length
        ? 'Removed demo fixture domains (e.g. plumber mocks). Enter real competitor domains for this business.'
        : 'competitors_required',
      rejected: rejected
    };
  }
  // Force replace with cleaned list
  try {
    const cfg = Object.assign({}, site.config || {});
    cfg.competitors = list;
    await admin
      .from('sites')
      .update({ config: cfg, updated_at: new Date().toISOString() })
      .eq('id', site.id);
    site.config = cfg;
  } catch (_e) {
    /* ignore */
  }
  const persist = await persistCompetitors(admin, site.id, list);
  return { ok: true, competitors: list, persist: persist, rejected: rejected };
}

async function clearCompetitors(admin, site) {
  if (!admin || !site || !site.id) return { ok: false, error: 'site_required' };
  try {
    const cfg = Object.assign({}, site.config || {});
    cfg.competitors = [];
    await admin
      .from('sites')
      .update({ config: cfg, updated_at: new Date().toISOString() })
      .eq('id', site.id);
    site.config = cfg;
  } catch (_e) {
    /* ignore */
  }
  try {
    await admin.from('si_competitors').delete().eq('site_id', site.id);
  } catch (_e) {
    /* schema pending */
  }
  return { ok: true, competitors: [] };
}

module.exports = {
  normKw,
  cleanDomain,
  buildKeywordGap,
  discoverCompetitors,
  discoverFromSerpSeeds,
  lookupKeywordSerp,
  competitorOrganicKeywords,
  runKeywordGap,
  runBacklinkStrategy,
  runPaidResearch,
  loadCompetitionSnapshot,
  saveCompetitors,
  clearCompetitors,
  purgeForbiddenCompetitors,
  loadSavedCompetitors,
  competitionGateway
};
