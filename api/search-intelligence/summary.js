'use strict';

/**
 * GET|POST /api/search-intelligence/summary
 * Preview or persist a weekly client summary snapshot.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const {
  buildClientSummary,
  saveReportSnapshot
} = require('../../lib/search-intelligence/client-summary');

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
      .select('id,slug,business_name,config,status')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    const days = Math.max(1, Math.min(90, parseInt(body.days || q.days || '28', 10) || 28));
    const summary = await buildClientSummary(db, site, {
      days: days,
      reportKind: body.reportKind || q.reportKind || 'weekly'
    });
    summary.role = access.role;

    if (req.method === 'GET' || body.persist === false || String(q.persist || '') === '0') {
      return http.json(res, 200, summary);
    }

    try {
      const saved = await saveReportSnapshot(db, summary);
      summary.saved = saved;
      return http.json(res, 200, summary);
    } catch (e) {
      if (e.code === 'schema_pending' || String(e.message) === 'schema_pending') {
        return http.json(res, 503, {
          error: 'schema_pending',
          summary: summary,
          message: 'Summary built but si_report_snapshots is not applied yet.'
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
