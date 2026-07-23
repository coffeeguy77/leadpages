'use strict';

/**
 * GET|POST /api/search-intelligence/clusters
 * List or rebuild keyword clusters for a site.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  listClusters,
  rebuildClusters
} = require('../../lib/search-intelligence/clusters');
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

    if (req.method === 'GET') {
      const listed = await listClusters(db, siteId);
      listed.role = access.role;
      return http.json(res, 200, listed);
    }

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    try {
      const rebuilt = await rebuildClusters(db, site, {});
      await meterUsage(db, siteId, 'cluster_rebuild', 1, {
        provider: 'internal',
        count: rebuilt.count
      });
      rebuilt.role = access.role;
      return http.json(res, 200, rebuilt);
    } catch (e) {
      if (e.code === 'schema_pending' || String(e.message) === 'schema_pending') {
        return http.json(res, 503, {
          error: 'schema_pending',
          message: 'Apply db/search_intelligence_schema.sql (si_keyword_clusters) first.'
        });
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
