'use strict';

/**
 * GET /api/ai-composer/access
 * What the signed-in user may do in AI Composer: role (super | partner), full mode
 * (super admins and trusted partners) and, for partners, this month's usage.
 */

const { sendJson } = require('../../lib/layout-composer/http');
const { requireComposerAccess, checkMonthlyLimit } = require('../../lib/ai-composer/access');

module.exports = async function aiComposerAccess(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET only' });
  const access = await requireComposerAccess(req);
  if (!access.ok) return sendJson(res, access.code, { ok: false, error: access.error });
  const quota = await checkMonthlyLimit(access);
  return sendJson(res, 200, {
    ok: true,
    role: access.role,
    full: access.full,
    partnerName: access.partner ? (access.partner.display_name || '') : '',
    used: quota.used,
    limit: quota.limit,
    limitReached: quota.ok === false && quota.code === 429
  });
};
