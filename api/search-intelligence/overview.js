'use strict';

/**
 * GET /api/search-intelligence/overview?siteId=
 * Loads sites.config, runs first-party audit, returns Command Centre payload.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { buildOverview } = require('../../lib/search-intelligence/overview');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function loadSite(siteId) {
  const sb = admin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('sites')
    .select('id,business_name,slug,config')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function loadConnections(siteId) {
  const sb = admin();
  const out = {};
  if (!sb) return out;
  try {
    const { data } = await sb
      .from('si_connections')
      .select('provider,connection_status,enabled,property_id,last_sync_at')
      .eq('site_id', siteId);
    (data || []).forEach(function (row) {
      if (row && row.provider) out[row.provider] = row;
    });
  } catch (_e) { /* table may not exist yet */ }
  return out;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const siteId = String(
      (body && body.siteId) || (req.query && (req.query.siteId || req.query.site_id)) || ''
    ).trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const site = await loadSite(siteId);
    const cfg = (site && site.config) || (body && body.config) || {};
    const connectionRows = await loadConnections(siteId);
    const includeCatalog =
      String((body && body.includeCatalog) || (req.query && req.query.includeCatalog) || '') === '1';

    const overview = await buildOverview({
      siteId: siteId,
      config: cfg,
      businessName: (site && site.business_name) || null,
      includeRecipeCatalog: includeCatalog,
      demoKeyword: (body && body.demoKeyword) || (req.query && req.query.demoKeyword) || null,
      location: (body && body.location) || (req.query && req.query.location) || null,
      connectionRows: connectionRows
    });
    overview.role = access.role;
    overview.siteSlug = (site && site.slug) || null;
    return http.json(res, 200, overview);
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String(e && e.message || e)
    });
  }
};
