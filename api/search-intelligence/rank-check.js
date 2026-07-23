'use strict';

/**
 * POST /api/search-intelligence/rank-check
 * Run due (or forced) rank checks for a site's tracked keywords.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { runRankJobs, loadLatestRanks } = require('../../lib/search-intelligence/rank-jobs');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
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

    if (req.method === 'GET') {
      const ranks = await loadLatestRanks(db, siteId);
      return http.json(res, 200, Object.assign({ ok: true, siteId: siteId }, ranks));
    }

    const force = body.force === true || String(q.force || '') === '1';
    try {
      const job = await runRankJobs(db, {
        siteId: siteId,
        force: force,
        ignoreCadence: force,
        trackedId: body.trackedId || null,
        max: body.max || 40,
        provider: body.provider || null
      });
      const ranks = await loadLatestRanks(db, siteId);
      return http.json(res, 200, Object.assign({ siteId: siteId, role: access.role }, job, { ranks: ranks }));
    } catch (e) {
      if (e.code === 'schema_pending' || String(e.message) === 'schema_pending') {
        return http.json(res, 503, { error: 'schema_pending' });
      }
      throw e;
    }
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
