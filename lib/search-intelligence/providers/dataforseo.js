'use strict';

/**
 * DataForSEO adapter — live when DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD are set.
 * Env aliases: DATAFORSEO_EMAIL / DATAFORSEO_API_PASSWORD also accepted.
 * AU default location_code 2036.
 */

const types = require('./types');

function login() {
  return String(
    process.env.DATAFORSEO_LOGIN ||
      process.env.DATAFORSEO_EMAIL ||
      process.env.DFS_LOGIN ||
      ''
  ).trim();
}

function password() {
  return String(
    process.env.DATAFORSEO_PASSWORD ||
      process.env.DATAFORSEO_API_PASSWORD ||
      process.env.DFS_PASSWORD ||
      ''
  ).trim();
}

function configured() {
  return !!(login() && password());
}

function authHeader() {
  const token = Buffer.from(login() + ':' + password()).toString('base64');
  return 'Basic ' + token;
}

function locationCode(input) {
  if (input && input.locationCode != null) return Number(input.locationCode);
  // Prefer city-level codes when geo/location points at Canberra (common AU trade default).
  const loc = String((input && (input.location || input.geo || input.locationName)) || '')
    .toLowerCase();
  if (/canberra|act\b/.test(loc)) return 1000467; // Canberra, Australia (DataForSEO)
  const env = parseInt(process.env.DATAFORSEO_LOCATION_CODE || '2036', 10);
  return Number.isFinite(env) ? env : 2036; // Australia
}

function languageCode(input) {
  return String((input && (input.language || input.languageCode)) || 'en').slice(0, 8);
}

function notConfigured(op) {
  return {
    ok: false,
    provider: 'dataforseo',
    error: 'not_configured',
    operation: op,
    message:
      'Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (or DATAFORSEO_EMAIL / DATAFORSEO_API_PASSWORD) to enable live calls.'
  };
}

async function dfsPost(path, payload) {
  const r = await fetch('https://api.dataforseo.com/v3/' + path.replace(/^\//, ''), {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(Array.isArray(payload) ? payload : [payload])
  });
  const json = await r.json().catch(function () {
    return {};
  });
  if (!r.ok) {
    const err = new Error(
      (json && json.status_message) || (json && json.message) || 'dataforseo_http_' + r.status
    );
    err.status = r.status;
    err.details = json;
    throw err;
  }
  if (json.status_code && json.status_code !== 20000) {
    const err = new Error(json.status_message || 'dataforseo_status_' + json.status_code);
    err.details = json;
    throw err;
  }
  return json;
}

function firstTask(json) {
  const tasks = json && Array.isArray(json.tasks) ? json.tasks : [];
  return tasks[0] || null;
}

async function keywordIdeas(input) {
  if (!configured()) return notConfigured('keywordIdeas');
  const seed = String((input && input.keyword) || '').trim();
  if (!seed) return { ok: false, provider: 'dataforseo', error: 'keyword_required' };

  try {
    const json = await dfsPost('dataforseo_labs/google/keyword_ideas/live', {
      keywords: [seed],
      location_code: locationCode(input),
      language_code: languageCode(input),
      include_serp_info: false,
      include_seed_keyword: true,
      limit: Math.min(50, Math.max(5, (input && input.limit) || 25))
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const ideas = items.slice(0, 40).map(function (it) {
      const info = it.keyword_info || {};
      const props = it.keyword_properties || {};
      const intentInfo = it.search_intent_info || {};
      return types.keywordIdea({
        keyword: it.keyword || '',
        location: (input && input.location) || 'Australia',
        language: languageCode(input),
        country: 'AU',
        volume: info.search_volume != null ? info.search_volume : null,
        cpc: info.cpc != null ? info.cpc : null,
        competition: info.competition != null ? info.competition : null,
        difficulty: props.keyword_difficulty != null ? props.keyword_difficulty : null,
        intent: intentInfo.main_intent || null,
        localIntent: null,
        provider: 'dataforseo',
        labelClass: 'estimated'
      });
    });
    return { ok: true, provider: 'dataforseo', ideas: ideas };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'keywordIdeas',
      message: String((e && e.message) || e)
    };
  }
}

/**
 * Exact Google Ads search volume + CPC for a list of keywords (batch).
 * Endpoint: keywords_data/google_ads/search_volume/live
 * This is what Campaign Builder Vol/CPC columns need — not related "ideas".
 */
async function searchVolume(input) {
  if (!configured()) return notConfigured('searchVolume');
  const raw = Array.isArray(input && input.keywords)
    ? input.keywords
    : String((input && (input.keyword || input.seed)) || '')
        .split(/\n|,/)
        .map(function (s) {
          return s.trim();
        });
  const keywords = [];
  const seen = {};
  raw.forEach(function (k) {
    const t = String(k || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    if (!t || seen[t]) return;
    // Google Ads rejects overly long phrases
    if (t.split(/\s+/).length > 10) return;
    seen[t] = true;
    keywords.push(t);
  });
  if (!keywords.length) {
    return { ok: false, provider: 'dataforseo', error: 'keywords_required' };
  }

  try {
    const json = await dfsPost('keywords_data/google_ads/search_volume/live', {
      keywords: keywords.slice(0, 200),
      location_code: locationCode(input),
      language_code: languageCode(input),
      search_partners: false
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    // Live search_volume returns result as an array of keyword rows (not nested items).
    const rows = task && Array.isArray(task.result) ? task.result : [];
    const ideas = rows.map(function (it) {
      const compIdx = it.competition_index != null ? Number(it.competition_index) : null;
      let competition = null;
      if (compIdx != null && Number.isFinite(compIdx)) competition = compIdx / 100;
      else if (typeof it.competition === 'number') competition = it.competition;
      return types.keywordIdea({
        keyword: it.keyword || '',
        location: (input && (input.location || input.geo)) || 'Australia',
        language: languageCode(input),
        country: 'AU',
        volume: it.search_volume != null ? it.search_volume : null,
        cpc: it.cpc != null ? Number(it.cpc) : null,
        competition: competition,
        difficulty: null,
        intent: null,
        localIntent: null,
        provider: 'dataforseo',
        labelClass: 'estimated',
        lowBid: it.low_top_of_page_bid != null ? Number(it.low_top_of_page_bid) : null,
        highBid: it.high_top_of_page_bid != null ? Number(it.high_top_of_page_bid) : null
      });
    });
    return {
      ok: true,
      provider: 'dataforseo',
      mode: 'search_volume',
      ideas: ideas,
      requested: keywords.length,
      returned: ideas.length
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'searchVolume',
      message: String((e && e.message) || e)
    };
  }
}

function mapSerpItems(items) {
  const features = [];
  const results = [];
  (items || []).forEach(function (it) {
    const t = String(it.type || '');
    if (t === 'organic') {
      results.push(
        types.serpResult({
          rank: it.rank_group != null ? it.rank_group : it.rank_absolute,
          url: it.url || null,
          domain: it.domain || null,
          title: it.title || null,
          snippet: it.description || null,
          type: 'organic'
        })
      );
    } else if (t === 'local_pack' || t === 'maps') {
      features.push('local_pack');
      results.push(
        types.serpResult({
          rank: it.rank_group != null ? it.rank_group : 1,
          url: it.url || null,
          domain: it.domain || 'maps.google.com',
          title: it.title || 'Local pack',
          type: 'maps'
        })
      );
    } else if (t === 'people_also_ask') {
      features.push('people_also_ask');
    } else if (t === 'ai_overview' || t === 'chatgpt') {
      features.push('ai_overview');
      if (t === 'chatgpt') features.push('chatgpt');
      // Citation / referenced items nested under AI overview when present
      const refs =
        (Array.isArray(it.items) && it.items) ||
        (Array.isArray(it.links) && it.links) ||
        (Array.isArray(it.references) && it.references) ||
        [];
      if (refs.length) {
        refs.slice(0, 12).forEach(function (ref, idx) {
          results.push(
            types.serpResult({
              rank: idx + 1,
              url: ref.url || ref.link || null,
              domain: ref.domain || hostFromUrl(ref.url || ref.link) || null,
              title: ref.title || ref.source || 'AI citation',
              snippet: ref.description || ref.snippet || null,
              type: 'ai_overview'
            })
          );
        });
      } else if (it.url || it.domain) {
        results.push(
          types.serpResult({
            rank: it.rank_group != null ? it.rank_group : 1,
            url: it.url || null,
            domain: it.domain || hostFromUrl(it.url) || null,
            title: it.title || 'AI overview',
            snippet: it.description || null,
            type: 'ai_overview'
          })
        );
      }
    }
  });
  return { features: Array.from(new Set(features)), results: results };
}

async function serp(input) {
  if (!configured()) return notConfigured('serp');
  const keyword = String((input && input.keyword) || '').trim();
  if (!keyword) return { ok: false, provider: 'dataforseo', error: 'keyword_required' };

  try {
    const device = (input && input.device) === 'desktop' ? 'desktop' : 'mobile';
    const json = await dfsPost('serp/google/organic/live/advanced', {
      keyword: keyword,
      location_code: locationCode(input),
      language_code: languageCode(input),
      device: device,
      os: device === 'mobile' ? 'android' : 'windows',
      depth: 100
    });
    const task = firstTask(json);
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const mapped = mapSerpItems(result && result.items);
    return {
      ok: true,
      provider: 'dataforseo',
      snapshot: types.serpSnapshot({
        keyword: keyword,
        location: (input && input.location) || 'Australia',
        device: device,
        provider: 'dataforseo',
        features: mapped.features,
        results: mapped.results,
        labelClass: 'measured'
      })
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'serp',
      message: String((e && e.message) || e)
    };
  }
}

function hostFromUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_e) {
    return String(u || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();
  }
}

async function rankCheck(input) {
  if (!configured()) return notConfigured('rankCheck');
  const keyword = String((input && input.keyword) || '').trim();
  if (!keyword) return { ok: false, provider: 'dataforseo', error: 'keyword_required' };

  const serpRes = await module.exports.serp(input);
  if (!serpRes.ok) {
    return Object.assign({}, serpRes, { operation: 'rankCheck' });
  }

  const target = input && input.url ? hostFromUrl(input.url) : null;
  const organic = (serpRes.snapshot.results || []).filter(function (r) {
    return r.type === 'organic';
  });
  let match = null;
  if (target) {
    match = organic.find(function (r) {
      return r.domain && (r.domain.replace(/^www\./, '').toLowerCase() === target || hostFromUrl(r.url) === target);
    });
  } else if (organic[0]) {
    // No site URL configured — report top organic only as an unowned snapshot.
    match = organic[0];
  }
  // When a target host is set but not found, do NOT fall back to someone else's #1.

  return {
    ok: true,
    provider: 'dataforseo',
    observation: types.rankObservation({
      keyword: keyword,
      url: match ? match.url : input && input.url ? input.url : null,
      position: match && match.rank != null ? match.rank : null,
      device: (input && input.device) || 'mobile',
      geo: (input && input.geo) || (input && input.location) || 'Australia',
      provider: 'dataforseo',
      features: (serpRes.snapshot && serpRes.snapshot.features) || [],
      labelClass: 'measured',
      note: target && !match ? 'not_in_top_results' : null
    })
  };
}

/**
 * Google Maps SERP at a coordinate (Maps-grid cell).
 * Uses DataForSEO serp/google/maps/live/advanced.
 */
async function mapsGrid(input) {
  if (!configured()) return notConfigured('mapsGrid');
  const keyword = String((input && input.keyword) || '').trim();
  if (!keyword) return { ok: false, provider: 'dataforseo', error: 'keyword_required' };
  const lat = input && input.lat != null ? Number(input.lat) : null;
  const lng = input && input.lng != null ? Number(input.lng) : null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, provider: 'dataforseo', error: 'lat_lng_required' };
  }

  try {
    const zoom = Math.max(8, Math.min(16, Number((input && input.zoom) || 12)));
    const device = (input && input.device) === 'desktop' ? 'desktop' : 'mobile';
    const json = await dfsPost('serp/google/maps/live/advanced', {
      keyword: keyword,
      location_coordinate: lat + ',' + lng + ',' + zoom + 'z',
      language_code: languageCode(input),
      device: device,
      os: device === 'mobile' ? 'android' : 'windows',
      depth: Math.min(100, Math.max(10, Number((input && input.depth) || 20)))
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const results = items.slice(0, 40).map(function (it, idx) {
      return types.serpResult({
        rank: it.rank_group != null ? it.rank_group : it.rank_absolute != null ? it.rank_absolute : idx + 1,
        url: it.url || it.domain || null,
        domain: it.domain || hostFromUrl(it.url) || 'maps.google.com',
        title: it.title || it.cid || 'Maps result',
        snippet: it.address || it.description || null,
        type: 'maps'
      });
    });
    return {
      ok: true,
      provider: 'dataforseo',
      snapshot: types.serpSnapshot({
        keyword: keyword,
        location: lat + ',' + lng,
        device: device,
        provider: 'dataforseo',
        features: results.length ? ['local_pack', 'maps'] : ['maps'],
        results: results,
        labelClass: 'measured'
      })
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'mapsGrid',
      message: String((e && e.message) || e)
    };
  }
}

/**
 * Light backlink / referring-domain overview (Phase 4 foundation via DataForSEO Labs).
 */
async function backlinkSummary(input) {
  if (!configured()) return notConfigured('backlinkSummary');
  const domain = String((input && input.domain) || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };

  try {
    const json = await dfsPost('backlinks/summary/live', {
      target: domain,
      include_subdomains: true,
      internal_list_limit: 10
    });
    const task = firstTask(json);
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    return {
      ok: true,
      provider: 'dataforseo',
      summary: types.backlinkSummary({
        domain: domain,
        referringDomains: result && result.referring_domains != null ? Number(result.referring_domains) : null,
        backlinks: result && result.backlinks != null ? Number(result.backlinks) : null,
        newLost: null,
        provider: 'dataforseo',
        labelClass: 'measured'
      })
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'backlinkSummary',
      message: String((e && e.message) || e)
    };
  }
}

async function domainOverview(input) {
  if (!configured()) return notConfigured('domainOverview');
  const domain = String((input && input.domain) || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };

  // Light stub using Labs domain rank overview if available; soft-fail to modelled empty.
  try {
    const json = await dfsPost('dataforseo_labs/google/domain_rank_overview/live', {
      target: domain,
      location_code: locationCode(input),
      language_code: languageCode(input)
    });
    const task = firstTask(json);
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const item = result && Array.isArray(result.items) ? result.items[0] : null;
    const metrics = item && item.metrics && item.metrics.organic ? item.metrics.organic : {};
    const paid = item && item.metrics && item.metrics.paid ? item.metrics.paid : {};
    return {
      ok: true,
      provider: 'dataforseo',
      competitor: types.competitorDomain({
        domain: domain,
        visibilityEstimate: metrics.etv != null ? Number(metrics.etv) : null,
        overlapCount: metrics.count != null ? Number(metrics.count) : null,
        organicKeywords: metrics.count != null ? Number(metrics.count) : null,
        organicTraffic: metrics.etv != null ? Number(metrics.etv) : null,
        paidKeywords: paid.count != null ? Number(paid.count) : null,
        paidTraffic: paid.etv != null ? Number(paid.etv) : null,
        competitorType: 'business',
        provider: 'dataforseo',
        labelClass: 'estimated'
      })
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'domainOverview',
      message: String((e && e.message) || e)
    };
  }
}

function cleanDomain(d) {
  return String(d || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

/**
 * Main organic competitors (keyword overlap) — Domain Overview–style rivals.
 */
async function competitorsDomain(input) {
  if (!configured()) return notConfigured('competitorsDomain');
  const domain = cleanDomain(input && input.domain);
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };
  const limit = Math.min(20, Math.max(3, (input && input.limit) || 10));
  try {
    const json = await dfsPost('dataforseo_labs/google/competitors_domain/live', {
      target: domain,
      location_code: locationCode(input),
      language_code: languageCode(input),
      item_types: ['organic'],
      limit: limit,
      exclude_top_domains: true,
      ignore_missing_domains: true
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const competitors = items.map(function (it) {
      const full = (it.full_domain_metrics && it.full_domain_metrics.organic) || {};
      const paid = (it.full_domain_metrics && it.full_domain_metrics.paid) || {};
      const intersections = it.intersections != null ? Number(it.intersections) : null;
      return types.competitorDomain({
        domain: cleanDomain(it.domain),
        overlapCount: intersections,
        competitionLevel: intersections,
        visibilityEstimate: full.etv != null ? Number(full.etv) : null,
        organicKeywords: full.count != null ? Number(full.count) : null,
        organicTraffic: full.etv != null ? Number(full.etv) : null,
        paidKeywords: paid.count != null ? Number(paid.count) : null,
        paidTraffic: paid.etv != null ? Number(paid.etv) : null,
        avgPosition: it.avg_position != null ? Number(it.avg_position) : null,
        competitorType: 'search',
        provider: 'dataforseo',
        labelClass: 'estimated'
      });
    });
    return {
      ok: true,
      provider: 'dataforseo',
      domain: domain,
      competitors: competitors,
      labelClass: 'estimated'
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'competitorsDomain',
      message: String((e && e.message) || e)
    };
  }
}

function mapRankedItem(it, provider, itemType) {
  const kd = it.keyword_data || {};
  const info = kd.keyword_info || {};
  const serp = it.ranked_serp_element || {};
  const el = serp.serp_item || {};
  const intent = (kd.search_intent_info && kd.search_intent_info.main_intent) || null;
  return types.rankedKeyword({
    keyword: kd.keyword || '',
    volume: info.search_volume != null ? Number(info.search_volume) : null,
    cpc: info.cpc != null ? Number(info.cpc) : null,
    competition: info.competition != null ? Number(info.competition) : null,
    position: el.rank_group != null ? Number(el.rank_group) : el.rank_absolute != null ? Number(el.rank_absolute) : null,
    url: el.url || el.relative_url || null,
    etv: el.etv != null ? Number(el.etv) : null,
    intent: intent,
    itemType: itemType || 'organic',
    provider: provider,
    labelClass: 'estimated'
  });
}

/**
 * Keywords a domain ranks for (organic or paid).
 */
async function rankedKeywords(input) {
  if (!configured()) return notConfigured('rankedKeywords');
  const domain = cleanDomain(input && input.domain);
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };
  const limit = Math.min(200, Math.max(10, (input && input.limit) || 50));
  const itemType = String((input && input.itemType) || 'organic').toLowerCase() === 'paid' ? 'paid' : 'organic';
  try {
    const json = await dfsPost('dataforseo_labs/google/ranked_keywords/live', {
      target: domain,
      location_code: locationCode(input),
      language_code: languageCode(input),
      item_types: [itemType],
      limit: limit,
      order_by: ['keyword_data.keyword_info.search_volume,desc']
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const keywords = items.map(function (it) {
      return mapRankedItem(it, 'dataforseo', itemType);
    });
    return {
      ok: true,
      provider: 'dataforseo',
      domain: domain,
      itemType: itemType,
      keywords: keywords,
      totalCount: result && result.total_count != null ? Number(result.total_count) : keywords.length,
      labelClass: 'estimated'
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'rankedKeywords',
      message: String((e && e.message) || e)
    };
  }
}

/**
 * Domain intersection — shared keywords (intersections:true) or gap (false = target1 only).
 */
async function domainIntersection(input) {
  if (!configured()) return notConfigured('domainIntersection');
  const target1 = cleanDomain(input && (input.target1 || input.domain));
  const target2 = cleanDomain(input && (input.target2 || input.competitor));
  if (!target1 || !target2) {
    return { ok: false, provider: 'dataforseo', error: 'targets_required' };
  }
  const limit = Math.min(100, Math.max(5, (input && input.limit) || 40));
  const intersections = input && input.intersections === false ? false : true;
  try {
    const json = await dfsPost('dataforseo_labs/google/domain_intersection/live', {
      target1: target1,
      target2: target2,
      location_code: locationCode(input),
      language_code: languageCode(input),
      intersections: intersections,
      item_types: ['organic'],
      limit: limit,
      order_by: ['keyword_data.keyword_info.search_volume,desc']
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const keywords = items.map(function (it) {
      const kd = it.keyword_data || {};
      const info = kd.keyword_info || {};
      const first = it.first_domain_serp_element || {};
      const second = it.second_domain_serp_element || {};
      return {
        keyword: kd.keyword || '',
        volume: info.search_volume != null ? Number(info.search_volume) : null,
        cpc: info.cpc != null ? Number(info.cpc) : null,
        competition: info.competition != null ? Number(info.competition) : null,
        position1: first.rank_group != null ? Number(first.rank_group) : null,
        position2: second.rank_group != null ? Number(second.rank_group) : null,
        url1: first.url || null,
        url2: second.url || null,
        etv1: first.etv != null ? Number(first.etv) : null,
        etv2: second.etv != null ? Number(second.etv) : null,
        provider: 'dataforseo',
        labelClass: 'estimated'
      };
    });
    return {
      ok: true,
      provider: 'dataforseo',
      target1: target1,
      target2: target2,
      intersections: intersections,
      keywords: keywords,
      labelClass: 'estimated'
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'domainIntersection',
      message: String((e && e.message) || e)
    };
  }
}

/**
 * Referring domains for a target (Follow / authority outreach list).
 */
async function referringDomains(input) {
  if (!configured()) return notConfigured('referringDomains');
  const domain = cleanDomain(input && input.domain);
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };
  const limit = Math.min(50, Math.max(5, (input && input.limit) || 20));
  const dofollowOnly = !!(input && input.dofollowOnly);
  try {
    const payload = {
      target: domain,
      limit: limit,
      order_by: ['rank,desc'],
      exclude_internal_backlinks: true
    };
    if (dofollowOnly) {
      payload.filters = [['dofollow', '>', 0]];
    }
    const json = await dfsPost('backlinks/referring_domains/live', payload);
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const domains = items.map(function (it) {
      return types.referringDomain({
        domain: cleanDomain(it.domain || it.domain_from),
        rank: it.rank != null ? Number(it.rank) : it.domain_from_rank != null ? Number(it.domain_from_rank) : null,
        backlinks: it.backlinks != null ? Number(it.backlinks) : null,
        dofollow: it.dofollow != null ? Number(it.dofollow) : null,
        firstSeen: it.first_seen || null,
        provider: 'dataforseo',
        labelClass: 'estimated'
      });
    });
    return {
      ok: true,
      provider: 'dataforseo',
      domain: domain,
      referringDomains: domains,
      totalCount: result && result.total_count != null ? Number(result.total_count) : domains.length,
      labelClass: 'estimated'
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'referringDomains',
      message: String((e && e.message) || e)
    };
  }
}

/**
 * Pages on a domain earning the most backlinks.
 */
async function domainPages(input) {
  if (!configured()) return notConfigured('domainPages');
  const domain = cleanDomain(input && input.domain);
  if (!domain) return { ok: false, provider: 'dataforseo', error: 'domain_required' };
  const limit = Math.min(30, Math.max(5, (input && input.limit) || 10));
  try {
    const json = await dfsPost('backlinks/domain_pages/live', {
      target: domain,
      limit: limit,
      order_by: ['backlinks,desc']
    });
    const task = firstTask(json);
    if (task && task.status_code && Number(task.status_code) >= 40000) {
      throw new Error(task.status_message || 'dataforseo_task_' + task.status_code);
    }
    const result = task && Array.isArray(task.result) ? task.result[0] : null;
    const items = result && Array.isArray(result.items) ? result.items : [];
    const pages = items.map(function (it) {
      return {
        url: it.url || it.page || null,
        backlinks: it.backlinks != null ? Number(it.backlinks) : null,
        referringDomains: it.referring_domains != null ? Number(it.referring_domains) : null,
        rank: it.rank != null ? Number(it.rank) : null,
        provider: 'dataforseo',
        labelClass: 'estimated'
      };
    });
    return {
      ok: true,
      provider: 'dataforseo',
      domain: domain,
      pages: pages,
      labelClass: 'estimated'
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'dataforseo',
      error: 'provider_error',
      operation: 'domainPages',
      message: String((e && e.message) || e)
    };
  }
}

module.exports = {
  id: 'dataforseo',
  configured: configured,
  keywordIdeas: keywordIdeas,
  searchVolume: searchVolume,
  serp: serp,
  mapsGrid: mapsGrid,
  domainOverview: domainOverview,
  rankCheck: rankCheck,
  backlinkSummary: backlinkSummary,
  competitorsDomain: competitorsDomain,
  rankedKeywords: rankedKeywords,
  domainIntersection: domainIntersection,
  referringDomains: referringDomains,
  domainPages: domainPages
};
