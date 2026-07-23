'use strict';

/**
 * GET / POST / DELETE  /api/search-intelligence/tracked-keywords
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  listTracked,
  trackKeyword,
  untrackKeyword,
  planLimit
} = require('../../lib/search-intelligence/tracked-keywords');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await http.readBody(req);
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    if (req.method === 'GET') {
      const listed = await listTracked(db, siteId);
      return http.json(res, 200, Object.assign({ siteId: siteId }, listed));
    }

    if (req.method === 'POST') {
      try {
        const result = await trackKeyword(db, siteId, {
          keyword: body.keyword,
          device: body.device,
          geo: body.geo || body.location,
          cadence: body.cadence,
          priority: body.priority,
          language: body.language,
          country: body.country,
          meta: body.meta
        });
        return http.json(res, 200, Object.assign({ siteId: siteId, limit: planLimit() }, result));
      } catch (e) {
        if (e.code === 'plan_limit') {
          return http.json(res, 403, {
            error: 'plan_limit',
            limit: e.limit,
            count: e.count,
            message: 'Tracked keyword limit reached (' + e.limit + '). Raise SI_TRACKED_KEYWORD_LIMIT or remove unused terms.'
          });
        }
        if (e.code === 'schema_pending' || String(e.message) === 'schema_pending') {
          return http.json(res, 503, { error: 'schema_pending' });
        }
        if (String(e.message) === 'keyword_required') {
          return http.json(res, 400, { error: 'keyword_required' });
        }
        throw e;
      }
    }

    if (req.method === 'DELETE' || (req.method === 'POST' && body.action === 'untrack')) {
      const id = String(body.id || body.trackedId || q.id || '').trim();
      if (!id) return http.json(res, 400, { error: 'missing_id' });
      try {
        const result = await untrackKeyword(db, siteId, id);
        return http.json(res, 200, Object.assign({ siteId: siteId }, result));
      } catch (e) {
        if (String(e.message) === 'not_found') return http.json(res, 404, { error: 'not_found' });
        throw e;
      }
    }

    return http.json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
