'use strict';

/**
 * POST /api/search-intelligence/maps-grid
 * Sample Maps SERP across a small geo grid (DataForSEO or mock).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { runAndMeter } = require('../../lib/search-intelligence/maps-grid');

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

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status,custom_domain')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    if (req.method === 'GET') {
      return http.json(res, 200, {
        ok: true,
        siteId: siteId,
        role: access.role,
        hint: 'POST with optional keyword + gridSize (1–5, default 3) to sample Maps pack coverage.'
      });
    }

    const gridSize = Math.max(1, Math.min(5, Number(body.gridSize || body.grid_size || 3)));
    const sample = await runAndMeter(db, site, {
      keyword: body.keyword || q.keyword || undefined,
      gridSize: gridSize,
      provider: body.provider || undefined
    });
    sample.role = access.role;
    return http.json(res, 200, sample);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
