'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { buildResearchBrief } = require('../../lib/layout-composer/generate');
const { openaiKey, generateResearchBrief } = require('../../lib/layout-composer/ai-brief');

/** POST /api/layout-composer/research — advisory research brief (OpenAI when keyed). */
module.exports = async function layoutComposerResearch(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET/POST only' });

  // Auth optional for flagged preview / local testing — stubs do not mutate DB.
  await requireUser(req);

  const body = await readBody(req);
  const brief = body.brief || body;
  const understanding = body.understanding || null;
  if (!String(brief.trade || brief.businessName || (understanding && understanding.trade) || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'Provide trade or businessName in brief' });
  }

  if (openaiKey()) {
    try {
      const ai = await generateResearchBrief(brief, understanding || brief);
      if (ai && ai.ok) {
        return sendJson(res, 200, ai);
      }
    } catch (e) {
      const stub = buildResearchBrief(Object.assign({}, brief, understanding || {}));
      stub.openaiError = String((e && e.message) || e).slice(0, 160);
      stub.notice = 'OpenAI research failed; showing deterministic advisory brief.';
      return sendJson(res, 200, stub);
    }
  }

  return sendJson(res, 200, buildResearchBrief(Object.assign({}, brief, understanding || {})));
};
