'use strict';

/**
 * Keyword Planner historical metrics via Google Ads API
 * (KeywordPlanIdeaService.GenerateKeywordHistoricalMetrics).
 *
 * Uses the connected Ads customer — no DataForSEO cost.
 * Never invents volume/CPC when the API returns empty.
 */

const { adsFetch, digits, resolveLoginCustomerId, ensureAccessToken } = require('./client');

/** Google geo criterion IDs (from geotargets CSV). */
const GEO = {
  AUSTRALIA: 2036,
  ACT: 20034,
  CANBERRA: 1000142
};

const LANGUAGE_EN = 'languageConstants/1000';

function geoResource(id) {
  return 'geoTargetConstants/' + String(id);
}

/**
 * Map plan location text → geoTargetConstants resource names (max 10).
 * Prefer city/state when known; else Australia.
 */
function resolveGeoTargetConstants(location) {
  const loc = String(location || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (/canberra/.test(loc)) return [geoResource(GEO.CANBERRA)];
  if (/\bact\b|australian capital/.test(loc)) return [geoResource(GEO.ACT)];
  if (/\bnz\b|new zealand/.test(loc)) return [geoResource(2704)];
  if (/\buk\b|united kingdom|\bengland\b/.test(loc)) return [geoResource(2826)];
  if (/\bunited states\b|\busa\b|\bus\b/.test(loc)) return [geoResource(2840)];
  // Default / Australia and other AU cities: country-level (never invent city IDs).
  return [geoResource(GEO.AUSTRALIA)];
}

function microsToDollars(micros) {
  if (micros == null || micros === '') return null;
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((n / 1e6) * 100) / 100;
}

function competitionIndexTo01(index) {
  if (index == null || index === '') return null;
  const n = Number(index);
  if (!Number.isFinite(n)) return null;
  return Math.round((Math.max(0, Math.min(100, n)) / 100) * 100) / 100;
}

/**
 * Map one API result → idea row for applyKeywordMetrics.
 */
function resultToIdea(result) {
  if (!result) return null;
  const text = String(result.text || '').trim();
  if (!text) return null;
  const m = result.keywordMetrics || result.keyword_metrics || {};
  const volumeRaw = m.avgMonthlySearches != null ? m.avgMonthlySearches : m.avg_monthly_searches;
  const volume =
    volumeRaw != null && volumeRaw !== '' && Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : null;

  const avgCpc = microsToDollars(m.averageCpcMicros != null ? m.averageCpcMicros : m.average_cpc_micros);
  const low = microsToDollars(
    m.lowTopOfPageBidMicros != null ? m.lowTopOfPageBidMicros : m.low_top_of_page_bid_micros
  );
  const high = microsToDollars(
    m.highTopOfPageBidMicros != null ? m.highTopOfPageBidMicros : m.high_top_of_page_bid_micros
  );
  let cpc = avgCpc;
  if (cpc == null && low != null && high != null) {
    cpc = Math.round(((low + high) / 2) * 100) / 100;
  } else if (cpc == null && low != null) {
    cpc = low;
  } else if (cpc == null && high != null) {
    cpc = high;
  }

  const competition = competitionIndexTo01(
    m.competitionIndex != null ? m.competitionIndex : m.competition_index
  );

  const idea = {
    keyword: text,
    volume: volume,
    cpc: cpc,
    competition: competition,
    labelClass: 'estimated',
    source: 'google_ads_keyword_planner',
    closeVariants: Array.isArray(result.closeVariants)
      ? result.closeVariants
      : Array.isArray(result.close_variants)
        ? result.close_variants
        : []
  };
  return idea;
}

/**
 * Expand ideas so closeVariants also index (near-exact dedupe in Ads API).
 */
function expandIdeasWithVariants(ideas) {
  const out = [];
  const seen = {};
  (ideas || []).forEach(function (idea) {
    if (!idea || !idea.keyword) return;
    const k = String(idea.keyword).toLowerCase();
    if (!seen[k]) {
      seen[k] = true;
      out.push(idea);
    }
    (idea.closeVariants || []).forEach(function (v) {
      const t = String(v || '').trim();
      if (!t) return;
      const vk = t.toLowerCase();
      if (seen[vk]) return;
      seen[vk] = true;
      out.push(Object.assign({}, idea, { keyword: t, closeVariants: [] }));
    });
  });
  return out;
}

/**
 * Call GenerateKeywordHistoricalMetrics for the connected customer.
 * @returns {Promise<{ok:boolean, ideas:object[], provider:string, error?:string, geo?:string[]}>}
 */
async function fetchKeywordHistoricalMetrics(admin, conn, keywords, opts) {
  const o = opts || {};
  if (!conn || !conn.customer_id) {
    return { ok: false, ideas: [], provider: 'google_ads_keyword_planner', error: 'not_connected' };
  }
  const texts = (keywords || [])
    .map(function (k) {
      return String(k || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    })
    .filter(Boolean);
  const uniq = [];
  const seen = {};
  texts.forEach(function (t) {
    if (seen[t]) return;
    seen[t] = true;
    uniq.push(t);
  });
  if (!uniq.length) {
    return { ok: true, ideas: [], provider: 'google_ads_keyword_planner', error: 'no_keywords' };
  }

  try {
    await ensureAccessToken(admin, conn);
  } catch (e) {
    return {
      ok: false,
      ideas: [],
      provider: 'google_ads_keyword_planner',
      error: String((e && e.message) || e || 'token_error').slice(0, 200)
    };
  }

  const cid = digits(conn.customer_id);
  const login = resolveLoginCustomerId(conn);
  const location = String(o.location || 'Australia').trim() || 'Australia';
  const geos = resolveGeoTargetConstants(location);

  // Cap batch size (API allows 10k; keep requests modest).
  const batch = uniq.slice(0, 200);
  const body = {
    keywords: batch,
    geoTargetConstants: geos,
    language: LANGUAGE_EN,
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    historicalMetricsOptions: { includeAverageCpc: true }
  };

  try {
    const json = await adsFetch(
      'customers/' + cid + '/keywordPlanIdeaService:generateKeywordHistoricalMetrics',
      {
        method: 'POST',
        accessToken: conn.access_token,
        loginCustomerId: login,
        body: body
      }
    );
    const results = (json && json.results) || [];
    const ideas = expandIdeasWithVariants(results.map(resultToIdea).filter(Boolean));
    return {
      ok: true,
      ideas: ideas,
      provider: 'google_ads_keyword_planner',
      geo: geos,
      location: location,
      requested: batch.length,
      returned: ideas.length
    };
  } catch (e) {
    return {
      ok: false,
      ideas: [],
      provider: 'google_ads_keyword_planner',
      error: String((e && e.message) || e || 'ads_api_error').slice(0, 280),
      geo: geos,
      location: location
    };
  }
}

module.exports = {
  GEO,
  LANGUAGE_EN,
  resolveGeoTargetConstants,
  microsToDollars,
  resultToIdea,
  expandIdeasWithVariants,
  fetchKeywordHistoricalMetrics
};
