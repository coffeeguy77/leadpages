'use strict';

/**
 * GET /api/search-intelligence/local
 * Local listings NAP audit + opportunity map (Phase 3 foundation).
 */

const http = require('../../lib/brain/http');
const { createClient } = require('@supabase/supabase-js');
const { auditListings } = require('../../lib/search-intelligence/local-listings');
const { buildLocalOpportunityMap } = require('../../lib/search-intelligence/local-opportunity');
const { listTracked } = require('../../lib/search-intelligence/tracked-keywords');

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
      .select('id,slug,business_name,config,status')
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

    return http.json(res, 200, {
      ok: true,
      siteId: siteId,
      role: access.role,
      listings: listings,
      opportunityMap: map,
      gbp: {
        status: 'not_connected',
        note: 'Google Business Profile OAuth ships when Google access is approved; market SERP remains DataForSEO-only.'
      }
    });
  } catch (e) {
    return http.json(res, 500, {
      error: 'server_error',
      message: String((e && e.message) || e)
    });
  }
};
