'use strict';

/**
 * Phase 9 — Marketing Hub campaign plan (suggest only).
 * POST /api/brain/ads-campaign-plan
 *   { siteId, goal?, budgetHints?, brief? }
 */

const { getPlatformBrain, isMarketingHubEnabled } = require('../../lib/brain/platform');
const {
  ADS_CAMPAIGN_PLAN_SCHEMA,
  normalizeCampaignPlan,
  buildAdsSummary
} = require('../../lib/brain/ads-compose');
const {
  admin,
  json,
  readBody,
  requireUser,
  assertSiteAccess
} = require('../../lib/brain/http');

async function loadAdsSummary(siteId) {
  const { data: conn } = await admin
    .from('google_ads_connections')
    .select('customer_id,account_name,descriptive_name,status,last_sync_at,updated_at')
    .eq('site_id', siteId)
    .maybeSingle();

  const sinceDay = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const { data: metrics } = await admin
    .from('ads_metrics_daily')
    .select('impressions,clicks,cost_micros,conversions')
    .eq('site_id', siteId)
    .gte('day', sinceDay);

  let spendMicros = 0;
  let clicks = 0;
  let impressions = 0;
  let conversions = 0;
  (metrics || []).forEach((m) => {
    spendMicros += Number(m.cost_micros || 0);
    clicks += Number(m.clicks || 0);
    impressions += Number(m.impressions || 0);
    conversions += Number(m.conversions || 0);
  });

  return buildAdsSummary(conn, {
    spendAud: spendMicros / 1e6,
    clicks,
    impressions,
    conversions
  });
}

module.exports = async function adsCampaignPlan(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const brain = getPlatformBrain();
  if (!isMarketingHubEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'marketing_hub_disabled',
      message: 'Set BRAIN_MARKETING_HUB=1 (default) or remove =0 to enable Marketing Hub.'
    });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const site = access.site;
  const adsSummary = await loadAdsSummary(siteId);

  const result = await brain.generateStructured({
    taskId: 'ads.campaign_plan',
    promptId: 'ads.campaign_plan',
    siteId: site.id,
    site,
    actor: { userId: user.id, role: access.role, partnerId: access.partnerId },
    adsSummary,
    contextSlices: ['site.identity', 'site.services', 'site.areas', 'ads.summary'],
    temperature: 0.55,
    input: {
      goal: String(body.goal || 'More qualified calls and quote requests').trim().slice(0, 300),
      budgetHints: String(body.budgetHints || '').trim().slice(0, 300),
      brief: String(body.brief || '').trim().slice(0, 800),
      adsSummary: JSON.stringify(adsSummary)
    },
    responseSchema: ADS_CAMPAIGN_PLAN_SCHEMA
  });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'Campaign plan failed',
      correlationId: result.correlationId
    });
  }

  const plan = normalizeCampaignPlan(result.output);
  return json(res, 200, {
    ok: true,
    plan,
    adsSummary,
    usage: result.usage,
    model: result.model,
    correlationId: result.correlationId,
    notice:
      'Suggestion only — Approve stores the plan on the site. No Google Ads changes are made automatically.'
  });
};
