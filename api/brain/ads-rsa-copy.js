'use strict';

/**
 * Phase 9 — Marketing Hub RSA copy (suggest only).
 * POST /api/brain/ads-rsa-copy
 *   { siteId, offer?, location?, landingUrl?, brief? }
 */

const { getPlatformBrain, isMarketingHubEnabled } = require('../../lib/brain/platform');
const {
  ADS_RSA_COPY_SCHEMA,
  normalizeRsaCopy
} = require('../../lib/brain/ads-compose');
const { json, readBody, requireUser, assertSiteAccess } = require('../../lib/brain/http');

module.exports = async function adsRsaCopy(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const brain = getPlatformBrain();
  if (!isMarketingHubEnabled(brain)) {
    return json(res, 503, {
      ok: false,
      error: 'marketing_hub_disabled',
      message: 'Marketing Hub is disabled.'
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
  const cfg = site.config || {};
  const result = await brain.generateStructured({
    taskId: 'ads.rsa_copy',
    promptId: 'ads.rsa_copy',
    siteId: site.id,
    site,
    actor: { userId: user.id, role: access.role, partnerId: access.partnerId },
    contextSlices: ['site.identity', 'site.areas'],
    temperature: 0.6,
    input: {
      offer: String(body.offer || cfg.trade || 'local trade services').trim().slice(0, 200),
      location: String(body.location || '').trim().slice(0, 120),
      landingUrl: String(body.landingUrl || '/').trim().slice(0, 200),
      brief: String(body.brief || '').trim().slice(0, 600)
    },
    responseSchema: ADS_RSA_COPY_SCHEMA
  });

  if (!result.ok) {
    return json(res, 502, {
      ok: false,
      error: (result.error && result.error.code) || 'brain_failed',
      message: (result.error && result.error.message) || 'RSA copy failed',
      correlationId: result.correlationId
    });
  }

  const rsa = normalizeRsaCopy(result.output);
  return json(res, 200, {
    ok: true,
    rsa,
    usage: result.usage,
    model: result.model,
    correlationId: result.correlationId,
    notice: 'RSA suggestion only — Approve stores copy on the site. No Ads API write.'
  });
};
