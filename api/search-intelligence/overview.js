'use strict';

/**
 * GET /api/search-intelligence/overview?siteId=
 * Loads sites.config, runs first-party audit, returns Command Centre payload.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { buildOverview } = require('../../lib/search-intelligence/overview');
const { loadGscTotals, loadGa4Totals } = require('../../lib/search-intelligence/sync');
const { loadOrganicLeadSummary } = require('../../lib/search-intelligence/attribution-organic');
const { loadPagePerformance } = require('../../lib/search-intelligence/page-performance');
const { listTracked, planLimit } = require('../../lib/search-intelligence/tracked-keywords');
const { loadLatestRanks } = require('../../lib/search-intelligence/rank-jobs');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function loadSite(siteId) {
  const sb = admin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('sites')
    .select('id,business_name,slug,config,custom_domain,status')
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
      .select('provider,connection_status,enabled,property_id,last_sync_at,last_sync_error,google_account_email')
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
    const doCrawl =
      String((body && body.crawl) || (req.query && req.query.crawl) || '') === '1';
    const days = Math.max(
      1,
      Math.min(90, parseInt((body && body.days) || (req.query && req.query.days) || '28', 10) || 28)
    );

    const sb = admin();
    const [gscTotals, ga4Totals, organicSummary, pagePerformance, tracked, ranks] = await Promise.all([
      loadGscTotals(sb, siteId, { days: days }),
      loadGa4Totals(sb, siteId, { days: days }),
      loadOrganicLeadSummary(sb, siteId, { days: days }),
      loadPagePerformance(sb, siteId, { days: days }),
      listTracked(sb, siteId),
      loadLatestRanks(sb, siteId)
    ]);

    const overview = await buildOverview({
      siteId: siteId,
      config: cfg,
      businessName: (site && site.business_name) || null,
      site: site
        ? {
            id: site.id,
            slug: site.slug,
            custom_domain: site.custom_domain,
            status: site.status
          }
        : { id: siteId },
      crawl: doCrawl,
      includeRecipeCatalog: includeCatalog,
      demoKeyword: (body && body.demoKeyword) || (req.query && req.query.demoKeyword) || null,
      location: (body && body.location) || (req.query && req.query.location) || null,
      connectionRows: connectionRows,
      gscTotals: gscTotals,
      ga4Totals: ga4Totals,
      organicSummary: organicSummary,
      pagePerformance: pagePerformance,
      trackedKeywordCount: tracked.count || 0,
      trackedKeywordLimit: tracked.limit || planLimit(),
      ranks: ranks
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
