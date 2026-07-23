'use strict';

/**
 * GET|POST /api/search-intelligence/authority
 * Phase 4 — Ads↔SEO universe, backlink gap, AI / brand SERP probes.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { loadAdsKeywords } = require('../../lib/search-intelligence/ads-keywords');
const { listTracked } = require('../../lib/search-intelligence/tracked-keywords');
const { buildAdsKeywordUniverse, probeAiVisibility, probeBrandSerp } = require('../../lib/search-intelligence/phase4-foundations');
const { runBacklinkGap } = require('../../lib/search-intelligence/backlink-gap');
const { meterUsage } = require('../../lib/search-intelligence/usage');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status,custom_domain')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    const days = Math.max(1, Math.min(90, Number(body.days || q.days || 28)));
    const tracked = await listTracked(db, siteId).catch(function () {
      return { items: [], count: 0 };
    });
    const ads = await loadAdsKeywords(db, siteId, { days: days });
    const universe = buildAdsKeywordUniverse(tracked.items || [], ads.items || []);

    if (req.method === 'GET') {
      return http.json(res, 200, {
        ok: true,
        siteId: siteId,
        role: access.role,
        adsKeywords: {
          available: ads.available,
          count: ads.count,
          connectionStatus: ads.connectionStatus,
          sources: ads.sources,
          note: ads.note,
          labelClass: ads.labelClass,
          sample: (ads.items || []).slice(0, 25)
        },
        universe: universe,
        actions: ['probe_ai', 'probe_brand', 'backlink_gap'],
        note: 'POST { action: probe_ai | probe_brand | backlink_gap } to run paid probes (DataForSEO / mock).'
      });
    }

    const action = String(body.action || '').trim();
    if (action === 'probe_ai') {
      const result = await probeAiVisibility(site, {
        keyword: body.keyword || undefined,
        provider: body.provider || undefined
      });
      await meterUsage(db, siteId, 'ai_visibility_probe', 1, {
        provider: result.provider || 'serp',
        keyword: result.keyword
      });
      return http.json(res, 200, { ok: true, action: action, result: result, universe: universe });
    }
    if (action === 'probe_brand') {
      const result = await probeBrandSerp(site, {
        provider: body.provider || undefined
      });
      await meterUsage(db, siteId, 'brand_serp_probe', 1, {
        provider: result.provider || 'serp'
      });
      return http.json(res, 200, { ok: true, action: action, result: result, universe: universe });
    }
    if (action === 'backlink_gap') {
      const competitors = Array.isArray(body.competitors) ? body.competitors : undefined;
      const result = await runBacklinkGap(db, site, {
        competitors: competitors,
        provider: body.provider || undefined,
        domain: body.domain || undefined
      });
      return http.json(res, 200, { ok: true, action: action, result: result, universe: universe });
    }

    return http.json(res, 400, {
      error: 'unknown_action',
      message: 'Use action probe_ai, probe_brand, or backlink_gap.'
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
