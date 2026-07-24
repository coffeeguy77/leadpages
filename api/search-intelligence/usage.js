'use strict';

/**
 * GET /api/search-intelligence/usage?siteId=&days=
 * Provider usage rollup for bake-off / cost awareness.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { usageSummary } = require('../../lib/search-intelligence/usage');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return http.json(res, 405, { error: 'method_not_allowed' });
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const siteId = String((req.query && (req.query.siteId || req.query.site_id)) || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    // Metered provider usage is internal cost telemetry — not for client accounts.
    const role = String(access.role || '');
    if (role === 'client') {
      return http.json(res, 200, {
        available: false,
        role: role,
        message: 'Provider usage is only shown to partners and platform admins.'
      });
    }

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || '30'), 10) || 30));
    const summary = await usageSummary(db, siteId, { days: days });
    summary.role = access.role;
    return http.json(res, 200, summary);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
