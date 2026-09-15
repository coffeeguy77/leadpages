'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { startInterview, answerInterview } = require('../../lib/layout-composer/interview');
const { openaiKey, generateInterviewTurn } = require('../../lib/layout-composer/ai-brief');

/**
 * Optionally polish question/help with OpenAI while keeping chip ids + step machine intact.
 */
async function maybePolishTurn(turn, session, brief) {
  if (!turn || !openaiKey()) return turn;
  try {
    const history = (session && session.answers) || [];
    const ai = await generateInterviewTurn({
      brief: brief || {},
      understanding: (session && session.understanding) || (turn && turn.understanding) || {},
      history: history,
      mode: turn.terminal
        ? 'confirm'
        : (String(turn.stepId || '').indexOf('followup') === 0 ? 'followup_services' : 'next')
    });
    if (!ai) return turn;
    const out = Object.assign({}, turn);
    if (ai.assistantNote) {
      out.help = [ai.assistantNote, ai.help || turn.help].filter(Boolean).join(' ');
    } else if (ai.help) {
      out.help = ai.help;
    }
    if (ai.question && !turn.terminal) {
      out.question = ai.question;
    }
    // Apply AI chips (previously discarded — left briefing feeling hardcoded).
    if (Array.isArray(ai.options) && ai.options.length && !turn.terminal) {
      out.options = ai.options.map(function (o, i) {
        return {
          id: String((o && o.id) || ('opt-' + i)).slice(0, 40),
          label: String((o && o.label) || ('Option ' + (i + 1))).slice(0, 120),
          recommended: !!(o && o.recommended) || i === 0
        };
      });
      if (typeof ai.multi === 'boolean') out.multi = ai.multi;
      // Keep session step options in sync so answerInterview can resolve labels.
      if (session && Array.isArray(session.steps)) {
        const idx = Number(session.stepIndex) || 0;
        const step = session.steps[idx];
        if (step && (!turn.stepId || step.id === turn.stepId)) {
          step.options = out.options.map(function (o) {
            return { id: o.id, label: o.label, recommended: !!o.recommended };
          });
          if (typeof ai.multi === 'boolean') step.multi = ai.multi;
        }
      }
    }
    // Merge AI understanding patches (e.g. free-text product lines) into the session.
    if (session && ai.understandingPatch && typeof ai.understandingPatch === 'object') {
      session.understanding = Object.assign({}, session.understanding || {}, ai.understandingPatch);
      out.understanding = session.understanding;
    }
    out.aiSource = 'openai';
    return out;
  } catch (_e) {
    return turn;
  }
}

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
      const turn = await maybePolishTurn(started.turn, started.session, brief);
      return sendJson(res, 200, {
        ok: true,
        session: started.session,
        turn: turn,
        ready: false,
        openai: !!openaiKey()
      });
    }

    if (action === 'answer') {
      if (!body.session) {
        return sendJson(res, 400, { ok: false, error: 'session is required' });
      }
      const result = answerInterview(body.session, body.answer || {});
      const brief = {
        businessName: result.understanding && result.understanding.businessName,
        trade: result.understanding && result.understanding.trade,
        location: result.understanding && result.understanding.location
      };
      result.turn = await maybePolishTurn(result.turn, result.session, brief);
      result.openai = !!openaiKey();
      return sendJson(res, 200, Object.assign({ ok: true }, result));
    }

    return sendJson(res, 400, { ok: false, error: 'action must be start or answer' });
  } catch (e) {
    const code = e && e.code === 400 ? 400 : 500;
    return sendJson(res, code, { ok: false, error: String((e && e.message) || e) });
  }
};
