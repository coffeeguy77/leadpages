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
      depth: 20
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

  const serpRes = await serp(input);
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
  }
  if (!match && organic[0]) match = organic[0];

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
      labelClass: 'measured'
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
    return {
      ok: true,
      provider: 'dataforseo',
      competitor: types.competitorDomain({
        domain: domain,
        visibilityEstimate: metrics.etv != null ? Number(metrics.etv) : null,
        overlapCount: metrics.count != null ? Number(metrics.count) : null,
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

module.exports = {
  id: 'dataforseo',
  configured: configured,
  keywordIdeas: keywordIdeas,
  serp: serp,
  mapsGrid: mapsGrid,
  domainOverview: domainOverview,
  rankCheck: rankCheck,
  backlinkSummary: backlinkSummary
};
