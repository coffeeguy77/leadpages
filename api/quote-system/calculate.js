/**
 * POST /api/quote-system/calculate
 *   { token, inputs? }
 * Server-side calculation; response level depends on verification state.
 */

const { readBody, json } = require('../../lib/quote-system/http');
const {
  getSessionByToken,
  getQuoteSystemForSite,
  getActiveConfig,
  verificationLevelForSession
} = require('../../lib/quote-system/auth');
const { calculateQuote } = require('../../lib/quote-system/calculator');
const {
  nextQuoteVersionNumber,
  insertQuoteVersion,
  updateSession,
  linkLeadToSession
} = require('../../lib/quote-system/session');
const { serializeQuoteResult, serializeSession } = require('../../lib/quote-system/serializers');
const { RESPONSE_LEVEL, SESSION_STATUS } = require('../../lib/quote-system/constants');
const { createQuoteLead } = require('../../lib/quote-system/crm');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const token = String(body.token || '').trim();
    if (!token) return json(res, 400, { ok: false, error: 'token_required' });

    const result = await getSessionByToken(token);
    if (!result) return json(res, 404, { ok: false, error: 'session_not_found' });
    if (result.expired) return json(res, 410, { ok: false, error: 'session_expired' });

    const session = result.session;
    const quoteSystem = await getQuoteSystemForSite(session.site_id);
    if (!quoteSystem || !quoteSystem.enabled) {
      return json(res, 403, { ok: false, error: 'quote_not_enabled' });
    }

    const configVersion = await getActiveConfig(quoteSystem);
    if (!configVersion || !configVersion.config) {
      return json(res, 503, { ok: false, error: 'no_config' });
    }

    const progress = Object.assign({}, session.progress || {}, body.inputs || {});
    const calc = calculateQuote(configVersion.config, progress);

    const level = verificationLevelForSession(session);
    const versionNumber = await nextQuoteVersionNumber(session.id);

    await insertQuoteVersion({
      session_id: session.id,
      site_id: session.site_id,
      config_version_id: configVersion.id,
      version_number: versionNumber,
      inputs: calc.inputs,
      breakdown: calc.breakdown,
      subtotal_cents: calc.subtotalCents,
      gst_cents: calc.gstCents,
      total_cents: calc.totalCents,
      verification_level: level
    });

    const updatedSession = await updateSession(session.id, {
      progress: progress,
      status: SESSION_STATUS.SUBMITTED
    });

    if (!updatedSession.lead_id && updatedSession.contact_email && level !== RESPONSE_LEVEL.PUBLIC_PROGRESS) {
      const admin = require('../../lib/quote-system/supabase').getAdmin();
      const { data: siteRow } = await admin.from('sites')
        .select('id,business_name,owner_user_id')
        .eq('id', session.site_id)
        .maybeSingle();
      if (siteRow) {
        try {
          const leadId = await createQuoteLead(siteRow, updatedSession, calc);
          await linkLeadToSession(updatedSession, leadId);
        } catch (leadErr) {
          console.error('quote lead create:', leadErr && leadErr.message);
        }
      }
    }

    calc.versionNumber = versionNumber;
    calc.configVersionId = configVersion.id;
    calc.sessionId = session.id;

    return json(res, 200, {
      ok: true,
      quote: serializeQuoteResult(calc, level),
      session: serializeSession(updatedSession, level)
    });
  } catch (e) {
    console.error('quote-system/calculate:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
