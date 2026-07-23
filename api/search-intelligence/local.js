'use strict';

/**
 * GET /api/search-intelligence/local
 * Local listings NAP audit + opportunity map + local page findings + GBP status.
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { auditListings } = require('../../lib/search-intelligence/local-listings');
const { buildLocalOpportunityMap } = require('../../lib/search-intelligence/local-opportunity');
const { detectLocalPageIssues } = require('../../lib/search-intelligence/local-page-gates');
const { listTracked } = require('../../lib/search-intelligence/tracked-keywords');
const oauthCfg = require('../../lib/search-intelligence/google-oauth/config');

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

    const db = admin();
    if (!db) return http.json(res, 503, { error: 'database_unavailable' });

    const { data: site, error } = await db
      .from('sites')
      .select('id,slug,business_name,config,status,custom_domain')
      .eq('id', siteId)
      .maybeSingle();
    if (error || !site) return http.json(res, 404, { error: 'site_not_found' });

    const tracked = await listTracked(db, siteId).catch(function () {
      return { items: [], count: 0 };
    });
    const kwRows = (tracked.items || []).map(function (it) {
      return {
        keyword: it.keyword || it.normalised,
        keywordId: it.keywordId || it.keyword_id,
        trackedId: it.id
      };
    });

    const listings = auditListings(site);
    const map = buildLocalOpportunityMap(site, kwRows);
    const pageIssues = detectLocalPageIssues(site);

    let gbpRow = null;
    try {
      const { data } = await db
        .from('si_connections')
        .select('*')
        .eq('site_id', siteId)
        .eq('provider', 'gbp')
        .maybeSingle();
      gbpRow = data || null;
    } catch (_e) {
      gbpRow = null;
    }
    const gbp = oauthCfg.connectionStatus('gbp', gbpRow);

    return http.json(res, 200, {
      ok: true,
      siteId: siteId,
      role: access.role,
      listings: listings,
      opportunityMap: map,
      pageFindings: pageIssues.findings || [],
      gbp: {
        status: gbp.status,
        platformConfigured: gbp.platformConfigured,
        oauthReady: gbp.oauthReady,
        connectPath: gbp.connectPath || '/settings/integrations/google-business',
        propertyId: gbp.propertyId,
        hint: gbp.hint,
        note:
          gbp.status === 'not_configured'
            ? 'GBP OAuth scaffold is ready. Set GBP_CLIENT_ID / GBP_CLIENT_SECRET when Google access is approved. Maps SERP stays DataForSEO-only.'
            : gbp.hint
      }
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
