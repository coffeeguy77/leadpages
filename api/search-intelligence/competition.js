'use strict';

/**
 * GET|POST /api/search-intelligence/competition
 * Free: manual competitor list. Premium SEO: DataForSEO Labs / Backlinks research.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  loadCompetitionSnapshot,
  discoverCompetitors,
  discoverFromSerpSeeds,
  runKeywordGap,
  runBacklinkStrategy,
  runPaidResearch,
  saveCompetitors,
  clearCompetitors,
  purgeForbiddenCompetitors
} = require('../../lib/search-intelligence/competition-analysis');
const {
  assertPremiumSeoEntitled,
  isPremiumCompetitionAction
} = require('../../lib/search-intelligence/billing');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function requirePremium(res, siteId, role) {
  const gate = await assertPremiumSeoEntitled(siteId, { role: role });
  if (gate.ok) return null;
  return http.json(res, 402, {
    error: gate.error || 'subscription_required',
    message: gate.message,
    product: gate.product,
    app: gate.app
  });
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

    if (req.method === 'GET') {
      const snap = await loadCompetitionSnapshot(db, site, {
        location: q.location || body.location,
        role: access.role
      });
      return http.json(res, 200, Object.assign({ role: access.role }, snap));
    }

    const action = String(body.action || '').trim();
    const provider = body.provider || undefined;
    const location = body.location || undefined;

    if (isPremiumCompetitionAction(action)) {
      const blocked = await requirePremium(res, siteId, access.role);
      if (blocked) return blocked;
    }

    if (action === 'discover_competitors') {
      const result = await discoverCompetitors(db, site, {
        provider: provider,
        location: location,
        domain: body.domain,
        limit: body.limit,
        saveToConfig: body.saveToConfig !== false
      });
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error,
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'discover_from_serp') {
      const result = await discoverFromSerpSeeds(db, site, {
        provider: provider,
        location: location,
        seeds: body.seeds || body.keywords,
        keyword: body.keyword,
        domain: body.domain,
        saveToConfig: body.saveToConfig !== false
      });
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error,
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'keyword_gap') {
      const result = await runKeywordGap(db, site, {
        provider: provider,
        location: location,
        domain: body.domain,
        competitors: body.competitors,
        limit: body.limit
      });
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error,
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'backlink_strategy') {
      const result = await runBacklinkStrategy(db, site, {
        provider: provider,
        domain: body.domain || body.competitor,
        competitor: body.competitor,
        dofollowOnly: body.dofollowOnly !== false,
        limit: body.limit,
        pageLimit: body.pageLimit
      });
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error,
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'paid_research') {
      const result = await runPaidResearch(db, site, {
        provider: provider,
        location: location,
        competitors: body.competitors,
        limit: body.limit
      });
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error,
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'save_competitors') {
      const result = await saveCompetitors(db, site, body.competitors || body.domains);
      if (!result.ok) {
        return http.json(res, 400, {
          error: result.error || 'save_failed',
          message: result.message,
          result: result
        });
      }
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'clear_competitors') {
      const result = await clearCompetitors(db, site);
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    if (action === 'purge_fixtures') {
      const result = await purgeForbiddenCompetitors(db, site);
      return http.json(res, 200, { ok: true, action: action, result: result });
    }

    return http.json(res, 400, {
      error: 'unknown_action',
      actions: [
        'discover_competitors',
        'discover_from_serp',
        'keyword_gap',
        'backlink_strategy',
        'paid_research',
        'save_competitors',
        'clear_competitors',
        'purge_fixtures'
      ]
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: e && e.message ? e.message : String(e)
    });
  }
};
