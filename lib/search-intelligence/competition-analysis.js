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
const {
  hostFromSite,
  competitorDomainsFromSite,
  persistCompetitors
} = require('./backlink-gap');
const { meterUsage } = require('./usage');

function normKw(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDomain(d) {
  return String(d || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
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
    return (data || [])
      .map(function (r) {
        return cleanDomain(r.domain);
      })
      .filter(Boolean);
  } catch (_e) {
    return [];
  }
}

async function saveCompetitorsToSiteConfig(admin, site, domains) {
  if (!admin || !site || !site.id || !domains || !domains.length) return { ok: false };
  const cfg = Object.assign({}, site.config || {});
  const existing = competitorDomainsFromSite(site, []);
  const merged = Array.from(new Set(existing.concat(domains.map(cleanDomain).filter(Boolean)))).slice(
    0,
    12
  );
  cfg.competitors = merged;
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
  const gw = createGateway({ provider: o.provider || undefined });
  const own = cleanDomain(o.domain || hostFromSite(site));
  const location = locationFromSite(site, o.location);
  if (!own) {
    return {
      ok: false,
      error: 'domain_required',
      message: 'Connect a custom domain (or slug) so we can find organic competitors.'
    };
  }

  const res = await gw.competitorsDomain({
    domain: own,
    location: location,
    limit: o.limit || 10
  });
  if (!res || !res.ok) {
    return {
      ok: false,
      error: (res && res.error) || 'competitors_failed',
      message: (res && res.message) || 'Could not load competitors',
      provider: (res && res.provider) || gw.preferred,
      domain: own
    };
  }

  const competitors = res.competitors || [];
  const domains = competitors.map(function (c) {
    return c.domain;
  });

  let persist = null;
  let configSave = null;
  if (admin && site && site.id && domains.length) {
    persist = await persistCompetitors(admin, site.id, domains);
    if (admin) {
      // Tag meta source as competition_analysis
      try {
        for (let i = 0; i < domains.length; i++) {
          await admin.from('si_competitors').upsert(
            {
              site_id: site.id,
              domain: domains[i],
              competitor_type: 'search',
              meta: { source: 'competition_analysis', competitionLevel: competitors[i] && competitors[i].competitionLevel }
            },
            { onConflict: 'site_id,domain' }
          );
        }
      } catch (_e) {
        /* schema pending */
      }
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
      'Sorted by keyword overlap (Competition Level). DataForSEO Labs estimated market data.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Discover rivals from SERP when domain portfolio is empty / new site.
 */
async function discoverFromSerpSeeds(admin, site, opts) {
  const o = opts || {};
  const gw = createGateway({ provider: o.provider || undefined });
  const location = locationFromSite(site, o.location);
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
  for (let i = 0; i < seeds.length; i++) {
    const snap = await gw.serp({ keyword: seeds[i], location: location, device: 'desktop' });
    if (snap && snap.provider) providers.push(snap.provider);
    const results = (snap && snap.snapshot && snap.snapshot.results) || [];
    results.forEach(function (r) {
      if (!r) return;
      const typ = String(r.type || 'organic').toLowerCase();
      if (typ && typ !== 'organic' && typ.indexOf('organic') < 0) return;
      const d = cleanDomain(r.domain || r.url);
      if (!d || d === own) return;
      if (/google\.|facebook\.|youtube\.|instagram\.|linkedin\.|wikipedia\./.test(d)) return;
      counts[d] = (counts[d] || 0) + 1;
    });
  }

  const competitors = Object.keys(counts)
    .map(function (d) {
      return {
        domain: d,
        overlapCount: counts[d],
        competitionLevel: counts[d],
        competitorType: 'search',
        provider: providers[0] || gw.preferred,
        labelClass: 'estimated'
      };
    })
    .sort(function (a, b) {
      return b.overlapCount - a.overlapCount;
    })
    .slice(0, 10);

  if (admin && site && site.id && competitors.length) {
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
    provider: providers[0] || gw.preferred,
    labelClass: 'estimated',
    note: 'Rivals inferred from top organic results for your seed keywords. Confirm and save before gap analysis.',
    analysedAt: new Date().toISOString()
  };
}

/**
 * Keyword gap vs up to 4 competitors.
 */
async function runKeywordGap(admin, site, opts) {
  const o = opts || {};
  const gw = createGateway({ provider: o.provider || undefined });
  const own = cleanDomain(o.domain || hostFromSite(site));
  const location = locationFromSite(site, o.location);
  if (!own) {
    return { ok: false, error: 'domain_required', message: 'Site domain required for keyword gap.' };
  }

  let competitors = (Array.isArray(o.competitors) ? o.competitors : [])
    .map(cleanDomain)
    .filter(Boolean);
  if (!competitors.length) {
    competitors = competitorDomainsFromSite(site, []);
  }
  if (!competitors.length && admin && site && site.id) {
    competitors = await loadSavedCompetitors(admin, site.id);
  }
  competitors = Array.from(new Set(competitors)).slice(0, 4);
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
  const gw = createGateway({ provider: o.provider || undefined });
  let target = cleanDomain(o.domain || o.competitor);
  if (!target) {
    const list = competitorDomainsFromSite(site, []);
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
  const gw = createGateway({ provider: o.provider || undefined });
  const location = locationFromSite(site, o.location);
  let competitors = (Array.isArray(o.competitors) ? o.competitors : [])
    .map(cleanDomain)
    .filter(Boolean);
  if (!competitors.length) competitors = competitorDomainsFromSite(site, []);
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
  const fromConfig = competitorDomainsFromSite(site, []);
  const fromDb = await loadSavedCompetitors(admin, site && site.id);
  const competitors = Array.from(new Set(fromConfig.concat(fromDb))).slice(0, 12);
  return {
    ok: true,
    siteId: site && site.id,
    domain: own,
    location: locationFromSite(site, o.location),
    competitors: competitors,
    actions: [
      'discover_competitors',
      'discover_from_serp',
      'keyword_gap',
      'backlink_strategy',
      'paid_research',
      'save_competitors'
    ],
    note:
      'Competition Analysis: organic rivals → keyword gap → backlink referring domains → paid keywords. Powered by DataForSEO. Live calls meter SI usage.'
  };
}

async function saveCompetitors(admin, site, domains) {
  const list = (domains || []).map(cleanDomain).filter(Boolean).slice(0, 12);
  if (!list.length) return { ok: false, error: 'competitors_required' };
  const persist = await persistCompetitors(admin, site.id, list);
  const configSave = await saveCompetitorsToSiteConfig(admin, site, list);
  return { ok: true, competitors: list, persist: persist, configSave: configSave };
}

module.exports = {
  normKw,
  cleanDomain,
  buildKeywordGap,
  discoverCompetitors,
  discoverFromSerpSeeds,
  runKeywordGap,
  runBacklinkStrategy,
  runPaidResearch,
  loadCompetitionSnapshot,
  saveCompetitors,
  loadSavedCompetitors
};
