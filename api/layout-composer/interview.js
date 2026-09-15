'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { startInterview, answerInterview } = require('../../lib/layout-composer/interview');

/**
 * POST /api/layout-composer/interview
 * Body: { action: 'start'|'answer', brief, blueprint?, session?, answer? }
 */
module.exports = async function layoutComposerInterview(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  await requireUser(req); // optional — briefing is non-destructive
  const body = await readBody(req);
  const action = String(body.action || 'start').toLowerCase();

  try {
    if (action === 'start') {
      const brief = body.brief || {};
      if (!String(brief.businessName || '').trim()) {
        return sendJson(res, 400, { ok: false, error: 'brief.businessName is required' });
      }
      const started = startInterview(brief, body.blueprint || null);
      return sendJson(res, 200, {
        ok: true,
        session: started.session,
        turn: started.turn,
        ready: false
      });
    }

    if (action === 'answer') {
      if (!body.session) {
        return sendJson(res, 400, { ok: false, error: 'session is required' });
      }
      const result = answerInterview(body.session, body.answer || {});
      return sendJson(res, 200, Object.assign({ ok: true }, result));
    }

    return sendJson(res, 400, { ok: false, error: 'action must be start or answer' });
  } catch (e) {
    const code = e && e.code === 400 ? 400 : 500;
    return sendJson(res, code, { ok: false, error: String((e && e.message) || e) });
  }
};
