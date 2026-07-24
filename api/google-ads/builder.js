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
const { analyzePageFit, applyFixesToPage, suggestRsaFromPage } = require('../../lib/google-ads/page-fit');
const { normalizeRsaCopy } = require('../../lib/brain/ads-compose');
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
        pages: publishedPages(site).map((p) => {
          const body = String((p && p.body) || '');
          const words = body.replace(/[#>*_`~\-|]/g, ' ').split(/\s+/).filter(Boolean).length;
          return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            status: p.status || 'published',
            h1: p.h1 || null,
            meta: p.meta || p.metaDescription || null,
            primaryKeyword: p.primaryKeyword || null,
            wordCount: words,
            hasH1: !!(p && p.h1),
            hasMeta: !!(p && (p.meta || p.metaDescription))
          };
        }),
        note: 'Google Ads reporting may be delayed. Campaign creates are always PAUSED. Pick a landing page first — we analyse fit before you spend.'
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

    if (action === 'analyze_page') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      const { site } = ctx;
      const pages = publishedPages(site);
      const page =
        pages.find((p) => String(p.id) === String(body.pageId || '')) ||
        pages.find((p) => String(p.slug) === String(body.pageSlug || '')) ||
        null;
      if (!page) return http.json(res, 400, { error: 'page_required', message: 'Select a published landing page to analyse.' });
      let plan = body.plan || null;
      if (plan && plan.draftPlan) plan = plan.draftPlan;
      const analysis = analyzePageFit(page, {
        plan: plan,
        geo: body.geo || (plan && plan.geoFocus),
        brand: site.business_name
      });
      return http.json(res, 200, { ok: true, action, pageId: page.id, analysis });
    }

    if (action === 'suggest_rsa') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      const { site } = ctx;
      const pages = publishedPages(site);
      const page =
        pages.find((p) => String(p.id) === String(body.pageId || '')) ||
        pages.find((p) => String(p.slug) === String(body.pageSlug || '')) ||
        null;
      let plan = body.plan || null;
      if (plan && plan.draftPlan) plan = plan.draftPlan;
      const kws =
        (plan && plan.adGroups && plan.adGroups[0] && plan.adGroups[0].keywords) ||
        body.keywords ||
        [];
      let rsa = suggestRsaFromPage(
        page || { title: site.business_name, h1: '', body: '', meta: '' },
        kws,
        (plan && plan.geoFocus) || body.geo,
        site.business_name
      );
      // Optional Brain polish when Marketing Hub is on
      try {
        const { getPlatformBrain, isMarketingHubEnabled } = require('../../lib/brain/platform');
        const brain = getPlatformBrain();
        if (isMarketingHubEnabled(brain) && body.useAi !== false) {
          const brief = [
            page && page.title,
            page && page.h1,
            page && page.meta,
            page && String(page.body || '').slice(0, 400)
          ]
            .filter(Boolean)
            .join('\n');
          const result = await brain.generateStructured({
            taskId: 'ads.rsa_copy',
            promptId: 'ads.rsa_copy',
            siteId: site.id,
            site,
            actor: { userId: ctx.user && ctx.user.id, role: ctx.access && ctx.access.role },
            contextSlices: ['site.identity', 'site.areas'],
            temperature: 0.55,
            input: {
              offer: String((page && (page.primaryKeyword || page.h1 || page.title)) || 'local service').slice(0, 200),
              location: String((plan && plan.geoFocus) || body.geo || '').slice(0, 120),
              landingUrl: String((plan && plan.adGroups && plan.adGroups[0] && plan.adGroups[0].finalUrl) || '').slice(0, 200),
              brief: brief.slice(0, 600)
            },
            responseSchema: {
              type: 'object',
              required: ['headlines', 'descriptions', 'path1', 'path2'],
              properties: {
                headlines: { type: 'array', items: { type: 'string' } },
                descriptions: { type: 'array', items: { type: 'string' } },
                path1: { type: 'string' },
                path2: { type: 'string' },
                finalUrlHint: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          });
          if (result && result.ok && result.output) {
            rsa = Object.assign({}, normalizeRsaCopy(result.output), {
              provenance: { source: 'brain_rsa', edited: false }
            });
          }
        }
      } catch (_e) {
        /* deterministic RSA still returned */
      }
      if (plan && plan.adGroups && plan.adGroups[0]) {
        plan.adGroups[0].ads = [Object.assign({}, rsa, { finalUrl: plan.adGroups[0].finalUrl })];
        plan.pageFit = analyzePageFit(page, { plan: plan, brand: site.business_name, geo: plan.geoFocus });
      }
      return http.json(res, 200, { ok: true, action, rsa, plan });
    }

    if (action === 'apply_page_fixes') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      const { db, siteId, site } = ctx;
      const cfg = Object.assign({}, site.config || {});
      const pages = Array.isArray(cfg.pages) ? cfg.pages.slice() : [];
      const idx = pages.findIndex(
        (p) => p && (String(p.id) === String(body.pageId || '') || String(p.slug) === String(body.pageSlug || ''))
      );
      if (idx < 0) return http.json(res, 404, { error: 'page_not_found' });
      let plan = body.plan || null;
      if (plan && plan.draftPlan) plan = plan.draftPlan;
      const fitCtx = { plan: plan, brand: site.business_name, geo: (plan && plan.geoFocus) || body.geo };
      const preview = analyzePageFit(pages[idx], fitCtx);
      const fixIds = Array.isArray(body.fixIds) ? body.fixIds : body.fixId ? [body.fixId] : preview.fixes.map((f) => f.id);
      const merged = applyFixesToPage(pages[idx], fixIds, fitCtx);
      pages[idx] = merged.page;
      cfg.pages = pages;
      const { error } = await db
        .from('sites')
        .update({ config: cfg, updated_at: new Date().toISOString() })
        .eq('id', siteId);
      if (error) return http.json(res, 500, { error: error.message });

      let nextPlan = plan;
      if (plan) {
        nextPlan = planForPage(Object.assign({}, site, { config: cfg }), pages[idx], {
          budgetDaily: plan.budgetDaily,
          geo: plan.geoFocus,
          campaignName: plan.campaignName
        });
        if (plan.adGroups && plan.adGroups[0] && plan.adGroups[0].keywords) {
          nextPlan.adGroups[0].keywords = plan.adGroups[0].keywords;
        }
        if (plan.adGroups && plan.adGroups[0] && plan.adGroups[0].ads) {
          nextPlan.adGroups[0].ads = plan.adGroups[0].ads;
        }
        nextPlan.pageFit = merged.analysis;
        nextPlan.budgetDaily = plan.budgetDaily;
      }
      return http.json(res, 200, {
        ok: true,
        action,
        applied: merged.applied,
        page: {
          id: pages[idx].id,
          title: pages[idx].title,
          h1: pages[idx].h1,
          meta: pages[idx].meta,
          slug: pages[idx].slug,
          body: pages[idx].body
        },
        analysis: merged.analysis,
        plan: nextPlan,
        message: 'Landing page updated. Review RSA so ads still match the new copy.'
      });
    }

    if (action === 'update_plan') {
      const ctx = await requireSite(req, res, { body, capability: 'draft', requireBuilder: true });
      if (!ctx) return;
      let plan = body.plan;
      if (!plan) return http.json(res, 400, { error: 'plan_required' });
      if (plan.draftPlan) plan = plan.draftPlan;
      // Normalize RSA if provided
      if (plan.adGroups && plan.adGroups[0] && plan.adGroups[0].ads && plan.adGroups[0].ads[0]) {
        const ad = plan.adGroups[0].ads[0];
        const norm = normalizeRsaCopy(ad);
        plan.adGroups[0].ads[0] = Object.assign({}, ad, norm, {
          finalUrl: plan.adGroups[0].finalUrl,
          provenance: Object.assign({}, ad.provenance || {}, { edited: true })
        });
      }
      const pages = publishedPages(ctx.site);
      const pageId = plan.provenance && plan.provenance.pageId;
      const page = pages.find((p) => String(p.id) === String(pageId) || String(p.slug) === String(pageId));
      if (page) {
        plan.pageFit = analyzePageFit(page, { plan: plan, brand: ctx.site.business_name, geo: plan.geoFocus });
      }
      return http.json(res, 200, { ok: true, action, plan });
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
        'change_budget',
        'analyze_page',
        'suggest_rsa',
        'apply_page_fixes',
        'update_plan'
      ]
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
};
