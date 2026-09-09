'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { buildResearchBrief } = require('../../lib/layout-composer/generate');

/** POST /api/layout-composer/research — advisory research brief (Phase 5). */
module.exports = async function layoutComposerResearch(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET/POST only' });

  const user = await requireUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: 'Sign in required' });

  const body = await readBody(req);
  const brief = body.brief || body;
  if (!String(brief.trade || brief.businessName || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'Provide trade or businessName in brief' });
  }
  return sendJson(res, 200, buildResearchBrief(brief));
};
