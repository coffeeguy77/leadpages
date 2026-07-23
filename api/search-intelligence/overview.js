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
const { loadAdsKeywords } = require('../../lib/search-intelligence/ads-keywords');
const { persistRecommendations } = require('../../lib/search-intelligence/recommendations-persist');
const { loadCrmOutcomes, buildCrmOutcomes } = require('../../lib/search-intelligence/crm-outcomes');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function emptyTracked() {
  return { ok: false, items: [], limit: planLimit(), count: 0 };
}

function emptyRanks() {
  return { available: false, items: [], count: 0 };
}

function emptyAds() {
  return {
    ok: true,
    available: false,
    items: [],
    count: 0,
    sources: [],
    connectionStatus: 'unknown',
    note: 'Ads keywords unavailable.'
  };
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
    const siteForCrm = site
      ? {
          id: site.id,
          slug: site.slug,
          custom_domain: site.custom_domain,
          status: site.status,
          business_name: site.business_name,
          config: cfg
        }
      : { id: siteId, config: cfg };

    // Soft-fail each loader — one missing table/query must not 500 the Command Centre.
    const [gscTotals, ga4Totals, organicSummary, pagePerformance, tracked, ranks, adsKeywords, crmOutcomes] =
      await Promise.all([
        loadGscTotals(sb, siteId, { days: days }).catch(function () {
          return { clicks: 0, impressions: 0, rows: 0, available: false };
        }),
        loadGa4Totals(sb, siteId, { days: days }).catch(function () {
          return {
            sessions: 0,
            engagedSessions: 0,
            conversions: 0,
            rows: 0,
            available: false
          };
        }),
        loadOrganicLeadSummary(sb, siteId, { days: days }).catch(function () {
          return { available: false, organicLeads: 0, organicCallClicks: 0, organicForms: 0, days: days };
        }),
        loadPagePerformance(sb, siteId, { days: days }).catch(function () {
          return { available: false, pages: [], findings: [], pageCount: 0 };
        }),
        listTracked(sb, siteId).catch(function () {
          return emptyTracked();
        }),
        loadLatestRanks(sb, siteId).catch(function () {
          return emptyRanks();
        }),
        loadAdsKeywords(sb, siteId, { days: days }).catch(function () {
          return emptyAds();
        }),
        loadCrmOutcomes(sb, siteForCrm, { days: days }).catch(function () {
          return buildCrmOutcomes(siteForCrm, [], { days: days });
        })
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
            status: site.status,
            business_name: site.business_name
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
      trackedKeywords: tracked.items || [],
      adsKeywords: (adsKeywords && adsKeywords.items) || [],
      adsKeywordMeta: adsKeywords || null,
      ranks: ranks,
      crmOutcomes: crmOutcomes
    });
    overview.role = access.role;
    overview.siteSlug = (site && site.slug) || null;
    if (adsKeywords) {
      overview.adsKeywords = {
        available: !!adsKeywords.available,
        count: adsKeywords.count || 0,
        connectionStatus: adsKeywords.connectionStatus,
        sources: adsKeywords.sources || [],
        note: adsKeywords.note || null,
        labelClass: adsKeywords.labelClass || 'modelled'
      };
    }
    if (sb && overview.nextBestActions) {
      try {
        overview.persisted = await persistRecommendations(sb, siteId, overview.nextBestActions);
      } catch (_e) {
        overview.persisted = { ok: false, skipped: 'persist_failed' };
      }
    }
    return http.json(res, 200, overview);
  } catch (e) {
    const message = String((e && e.message) || e);
    console.error('[si/overview]', message, e && e.stack);
    return http.json(res, 500, {
      error: 'server_error',
      message: message
    });
  }
};
