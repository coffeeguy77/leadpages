'use strict';

/**
 * GET|POST /api/google-ads/builder
 * Smart Campaign Builder: plan, readiness, create paused, status, budget, recommendations.
 */

const { requireSite, loadAdsConn, flagSnapshot, http } = require('../../lib/google-ads/builder-http');
const {
  planForPage,
  planForSite,
  recommendLaunch,
  coffeeEventsPilotDefaults,
  publishedPages
} = require('../../lib/google-ads/planner');
const { runReadinessAudit } = require('../../lib/google-ads/readiness');
const { buildRecommendations } = require('../../lib/google-ads/recommendations');
const { createPausedSearchCampaign, setCampaignStatus, updateCampaignBudget } = require('../../lib/google-ads/mutate');
const { syncCampaignMaps } = require('../../lib/google-ads/campaign-sync');
const { writeAudit } = require('../../lib/google-ads/audit');
const { dailyToImpliedMonthly } = require('../../lib/google-ads/safety');
const { enrichPlanWithKeywordMetrics } = require('../../lib/google-ads/keyword-metrics');
const {
  campaignMutationsEnabled,
  statusMutationsEnabled,
  budgetMutationsEnabled
} = require('../../lib/google-ads/flags');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const ctx = await requireSite(req, res, { capability: 'view' });
      if (!ctx) return;
      const { db, siteId, site, access } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      const { data: maps } = await db
        .from('ads_campaign_maps')
        .select('*')
        .eq('site_id', siteId)
        .order('updated_at', { ascending: false })
        .limit(100);
      const { data: plans } = await db
        .from('ads_campaign_plans')
        .select('id,name,mode,status,primary_domain,created_at,updated_at')
        .eq('site_id', siteId)
        .order('updated_at', { ascending: false })
        .limit(20);
      const { data: recs } = await db
        .from('ads_recommendations')
        .select('*')
        .eq('site_id', siteId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20);
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: events } = await db
        .from('events')
        .select('event')
        .eq('site_id', siteId)
        .gte('created_at', since);
      const stats = {};
      (events || []).forEach((e) => {
        stats[e.event] = (stats[e.event] || 0) + 1;
      });
      return http.json(res, 200, {
        ok: true,
        flags: flagSnapshot(),
        role: access.role,
        connected: !!(adsConn && adsConn.customer_id),
        customerId: adsConn && adsConn.customer_id,
        accountName: adsConn && adsConn.account_name,
        campaigns: maps || [],
        plans: plans || [],
        recommendations: recs || [],
        stats: stats,
        pages: publishedPages(site).map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          status: p.status || 'published'
        })),
        note: 'Google Ads reporting may be delayed. Campaign creates are always PAUSED.'
      });
    }

    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });
    const body = await http.readBody(req);
    const action = String(body.action || '').trim();

    if (action === 'plan_page' || action === 'plan_site' || action === 'recommend' || action === 'pilot_defaults') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      const { db, siteId, site, user } = ctx;
      let plan;
      if (action === 'plan_site') plan = planForSite(site, body);
      else if (action === 'recommend') plan = recommendLaunch(site, body);
      else if (action === 'pilot_defaults') {
        const pages = publishedPages(site);
        const page =
          pages.find((p) => String(p.id) === String(body.pageId || '')) ||
          pages.find((p) => String(p.slug) === String(body.pageSlug || '')) ||
          null;
        if (!page) {
          return http.json(res, 400, {
            error: 'landing_page_required',
            message: 'Select the published Coffee Cart Hire page before generating the pilot plan.'
          });
        }
        plan = coffeeEventsPilotDefaults(site, page, body.budgetDaily);
      } else {
        const pages = publishedPages(site);
        const page =
          pages.find((p) => String(p.id) === String(body.pageId || '')) ||
          pages.find((p) => String(p.slug) === String(body.pageSlug || '')) ||
          pages[0];
        if (!page) return http.json(res, 400, { error: 'no_published_pages' });
        plan = planForPage(site, page, body);
      }

      // Attach volume/CPC when DataForSEO or synced Ads keyword metrics exist — never invent.
      try {
        plan = await enrichPlanWithKeywordMetrics(db, siteId, plan, {
          location: body.location || (plan.geoFocus || (plan.draftPlan && plan.draftPlan.geoFocus)),
          seed: body.keywordSeed || body.service || undefined,
          skipMarket: body.skipMarketMetrics === true
        });
      } catch (_e) {
        /* planning still succeeds without metrics */
      }

      const { data: saved, error } = await db
        .from('ads_campaign_plans')
        .insert({
          site_id: siteId,
          name: (plan.campaignName || plan.draftPlan && plan.draftPlan.campaignName) || 'Draft plan',
          mode: plan.mode || 'page',
          primary_domain: plan.primaryDomain || (plan.draftPlan && plan.draftPlan.primaryDomain) || null,
          plan_json: plan,
          provenance: plan.provenance || {},
          status: 'draft',
          created_by: user.id
        })
        .select('id,name,mode,status,created_at')
        .maybeSingle();
      if (error) {
        // Schema may not be applied yet — still return plan
        return http.json(res, 200, {
          ok: true,
          action,
          plan,
          saved: null,
          warning: 'plan_not_persisted',
          schemaHint: 'Run db/ads_campaign_builder_schema.sql in Supabase'
        });
      }
      return http.json(res, 200, { ok: true, action, plan, saved });
    }

    if (action === 'readiness') {
      const ctx = await requireSite(req, res, { body, capability: 'tracking' });
      if (!ctx) return;
      const { db, siteId, site } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      let ga4Conn = null;
      try {
        const g = await db
          .from('si_connections')
          .select('id,provider,property_id,status')
          .eq('site_id', siteId)
          .eq('provider', 'ga4')
          .maybeSingle();
        ga4Conn = g.data;
      } catch (_e) {}
      let gtmConn = null;
      try {
        const g = await db.from('gtm_connections').select('*').eq('site_id', siteId).maybeSingle();
        gtmConn = g.data;
      } catch (_e) {}
      let plan = body.plan || null;
      if (body.planId) {
        const { data } = await db.from('ads_campaign_plans').select('plan_json').eq('id', body.planId).maybeSingle();
        plan = (data && data.plan_json) || plan;
      }
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: events } = await db.from('events').select('event').eq('site_id', siteId).gte('created_at', since);
      const stats = {};
      (events || []).forEach((e) => {
        stats[e.event] = (stats[e.event] || 0) + 1;
      });
      const audit = runReadinessAudit({
        site,
        adsConn,
        ga4Conn,
        gtmConn,
        plan: plan && plan.draftPlan ? plan.draftPlan : plan,
        stats
      });
      try {
        await db.from('tracking_readiness_checks').insert({
          site_id: siteId,
          customer_id: adsConn && adsConn.customer_id,
          overall: audit.overall,
          checks: audit.checks
        });
      } catch (_e) {}
      return http.json(res, 200, { ok: true, action, result: audit });
    }

    if (action === 'sync_campaigns') {
      const ctx = await requireSite(req, res, { body, capability: 'view' });
      if (!ctx) return;
      const { db, siteId } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      if (!adsConn) return http.json(res, 400, { error: 'not_connected' });
      try {
        const result = await syncCampaignMaps(db, adsConn);
        return http.json(res, 200, { ok: true, action, result });
      } catch (e) {
        return http.json(res, 502, { error: 'sync_failed', message: e && e.message ? e.message : String(e) });
      }
    }

    if (action === 'recommendations') {
      const ctx = await requireSite(req, res, { body, capability: 'view' });
      if (!ctx) return;
      const { db, siteId } = ctx;
      const { data: maps } = await db.from('ads_campaign_maps').select('*').eq('site_id', siteId).limit(50);
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: events } = await db.from('events').select('event').eq('site_id', siteId).gte('created_at', since);
      const stats = {};
      (events || []).forEach((e) => {
        stats[e.event] = (stats[e.event] || 0) + 1;
      });
      const list = buildRecommendations({
        campaigns: (maps || []).map((m) => ({
          campaignId: m.campaign_id,
          campaignName: m.campaign_name,
          status: m.status,
          spend: 0,
          conversions: 0
        })),
        stats
      });
      return http.json(res, 200, { ok: true, action, recommendations: list });
    }

    if (action === 'create_paused') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      if (!campaignMutationsEnabled()) {
        return http.json(res, 403, {
          error: 'mutations_disabled',
          message:
            'Create is locked. On Vercel set GOOGLE_ADS_CAMPAIGN_MUTATIONS=1, redeploy, then create as PAUSED. To go live later also set GOOGLE_ADS_STATUS_MUTATIONS=1 and GOOGLE_ADS_CAMPAIGN_PUBLISH=1, run Tracking readiness, then Resume.',
          flags: flagSnapshot()
        });
      }
      const { db, siteId, user } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      if (!adsConn) return http.json(res, 400, { error: 'not_connected' });
      let plan = body.plan;
      if (body.planId && !plan) {
        const { data } = await db.from('ads_campaign_plans').select('plan_json').eq('id', body.planId).maybeSingle();
        plan = data && data.plan_json;
      }
      if (plan && plan.draftPlan) plan = plan.draftPlan;
      const idempotencyKey = String(body.idempotencyKey || 'create_' + siteId + '_' + Date.now()).slice(0, 120);
      let buildId = null;
      try {
        const { data: build } = await db
          .from('ads_campaign_builds')
          .upsert(
            {
              site_id: siteId,
              customer_id: adsConn.customer_id,
              idempotency_key: idempotencyKey,
              mode: (plan && plan.mode) || 'page',
              status: 'creating',
              primary_domain: plan && plan.primaryDomain,
              landing_page_url: plan && plan.adGroups && plan.adGroups[0] && plan.adGroups[0].finalUrl,
              created_by: user.id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'site_id,idempotency_key' }
          )
          .select('id')
          .maybeSingle();
        buildId = build && build.id;
      } catch (_e) {}

      const result = await createPausedSearchCampaign(db, adsConn, plan, {
        buildId,
        currencyCode: body.currencyCode
      });
      await writeAudit(db, {
        siteId,
        customerId: adsConn.customer_id,
        campaignId: result.campaignId,
        actorUserId: user.id,
        action: 'create_paused',
        after: plan,
        result
      });
      if (buildId) {
        try {
          await db
            .from('ads_campaign_builds')
            .update({
              status: result.ok ? 'paused_created' : result.partial && result.partial.length ? 'partial' : 'failed',
              created_resources: result.created || result.partial || [],
              partial_errors: result.ok ? [] : [{ message: result.message || result.error }],
              updated_at: new Date().toISOString()
            })
            .eq('id', buildId);
        } catch (_e) {}
      }
      return http.json(res, result.ok ? 200 : 502, { ok: !!result.ok, action, result, buildId });
    }

    if (action === 'pause' || action === 'resume') {
      const ctx = await requireSite(req, res, { body, capability: 'pause' });
      if (!ctx) return;
      if (!statusMutationsEnabled()) {
        return http.json(res, 403, { error: 'status_mutations_disabled', flags: flagSnapshot() });
      }
      const { db, siteId, user } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      if (!adsConn) return http.json(res, 400, { error: 'not_connected' });
      const campaignId = String(body.campaignId || '').trim();
      if (!campaignId) return http.json(res, 400, { error: 'campaign_id_required' });
      const { data: map } = await db
        .from('ads_campaign_maps')
        .select('*')
        .eq('site_id', siteId)
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (!map) return http.json(res, 404, { error: 'campaign_not_mapped' });
      const status = action === 'pause' ? 'PAUSED' : 'ENABLED';
      if (status === 'ENABLED' && body.confirmResume !== true) {
        return http.json(res, 400, {
          error: 'confirm_required',
          message: 'Resuming will allow spend. Set confirmResume:true after reviewing budget and tracking.',
          preview: {
            campaignName: map.campaign_name,
            dailyBudget: map.daily_budget_micros != null ? Number(map.daily_budget_micros) / 1e6 : null,
            impliedMonthly: dailyToImpliedMonthly(
              map.daily_budget_micros != null ? Number(map.daily_budget_micros) / 1e6 : 0
            )
          }
        });
      }
      const result = await setCampaignStatus(db, adsConn, map, status, {
        confirmExternal: body.confirmExternal === true
      });
      await writeAudit(db, {
        siteId,
        customerId: adsConn.customer_id,
        campaignId,
        actorUserId: user.id,
        action,
        before: { status: map.status },
        after: { status },
        result
      });
      return http.json(res, result.ok ? 200 : 400, { ok: !!result.ok, action, result });
    }

    if (action === 'change_budget') {
      const ctx = await requireSite(req, res, { body, capability: 'budget' });
      if (!ctx) return;
      if (!budgetMutationsEnabled()) {
        return http.json(res, 403, { error: 'budget_mutations_disabled', flags: flagSnapshot() });
      }
      const { db, siteId, user } = ctx;
      const adsConn = await loadAdsConn(db, siteId);
      if (!adsConn) return http.json(res, 400, { error: 'not_connected' });
      const campaignId = String(body.campaignId || '').trim();
      const daily = Number(body.dailyBudget);
      if (!campaignId || !(daily > 0)) return http.json(res, 400, { error: 'invalid_request' });
      const { data: map } = await db
        .from('ads_campaign_maps')
        .select('*')
        .eq('site_id', siteId)
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (!map) return http.json(res, 404, { error: 'campaign_not_mapped' });
      const prev = map.daily_budget_micros != null ? Number(map.daily_budget_micros) / 1e6 : null;
      if (body.confirm !== true) {
        return http.json(res, 400, {
          error: 'confirm_required',
          preview: {
            campaignName: map.campaign_name,
            currentDaily: prev,
            proposedDaily: daily,
            pctChange: prev ? Math.round(((daily - prev) / prev) * 1000) / 10 : null,
            impliedMonthly: dailyToImpliedMonthly(daily),
            shared: !!map.shared_budget_id
          }
        });
      }
      const result = await updateCampaignBudget(db, adsConn, map, daily, {
        confirmExternal: body.confirmExternal === true,
        confirmShared: body.confirmShared === true,
        confirmLargeIncrease: body.confirmLargeIncrease === true
      });
      await writeAudit(db, {
        siteId,
        customerId: adsConn.customer_id,
        campaignId,
        actorUserId: user.id,
        action: 'change_budget',
        before: { daily: prev },
        after: { daily },
        result
      });
      return http.json(res, result.ok ? 200 : 400, { ok: !!result.ok, action, result });
    }

    return http.json(res, 400, {
      error: 'unknown_action',
      actions: [
        'plan_page',
        'plan_site',
        'recommend',
        'pilot_defaults',
        'readiness',
        'sync_campaigns',
        'recommendations',
        'create_paused',
        'pause',
        'resume',
        'change_budget'
      ]
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
