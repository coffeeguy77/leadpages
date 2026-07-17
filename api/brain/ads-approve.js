'use strict';

/**
 * Phase 9 — Approve Marketing Hub suggestion (store only; never mutates Google Ads).
 * POST /api/brain/ads-approve
 *   { siteId, kind: 'campaign_plan'|'rsa_copy', payload }
 */

const {
  normalizeCampaignPlan,
  normalizeRsaCopy
} = require('../../lib/brain/ads-compose');
const {
  admin,
  json,
  readBody,
  requireUser,
  assertSiteAccess
} = require('../../lib/brain/http');
const { isMarketingHubEnabled, getPlatformBrain } = require('../../lib/brain/platform');

module.exports = async function adsApprove(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  if (!isMarketingHubEnabled(getPlatformBrain())) {
    return json(res, 503, { ok: false, error: 'marketing_hub_disabled' });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'unauthorized' });

  const body = await readBody(req);
  const siteId = String(body.siteId || '').trim();
  const kind = String(body.kind || '').trim();
  if (!siteId) return json(res, 400, { ok: false, error: 'siteId required' });
  if (kind !== 'campaign_plan' && kind !== 'rsa_copy') {
    return json(res, 400, { ok: false, error: 'kind must be campaign_plan or rsa_copy' });
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return json(res, 400, { ok: false, error: 'payload required' });
  }

  const access = await assertSiteAccess(user, siteId);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const normalized =
    kind === 'campaign_plan'
      ? normalizeCampaignPlan(body.payload)
      : normalizeRsaCopy(body.payload);

  const site = access.site;
  const config = Object.assign({}, site.config || {});
  const hub =
    config.marketingHub && typeof config.marketingHub === 'object'
      ? Object.assign({}, config.marketingHub)
      : {};
  const entry = {
    kind,
    payload: normalized,
    approvedAt: new Date().toISOString(),
    approvedBy: user.id,
    adsMutated: false
  };
  const history = Array.isArray(hub.approved) ? hub.approved.slice(-19) : [];
  history.push(entry);
  hub.approved = history;
  hub.latest = entry;
  config.marketingHub = hub;

  const { error } = await admin
    .from('sites')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) {
    return json(res, 500, { ok: false, error: 'save_failed', message: error.message });
  }

  return json(res, 200, {
    ok: true,
    saved: entry,
    notice:
      'Approved suggestion stored on the site (config.marketingHub). Google Ads was not changed — apply manually or via a future approved write flow.'
  });
};
