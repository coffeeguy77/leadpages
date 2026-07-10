/**
 * POST /api/quote-system/verify-email
 *   { token, action: 'send'|'confirm', email?, code? }
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const {
  getSessionByToken,
  getQuoteSystemForSite,
  getActiveConfig
} = require('../../lib/quote-system/auth');
const { updateSession } = require('../../lib/quote-system/session');
const {
  generateCode,
  storeVerification,
  sendEmailCode,
  verifyEmailCode
} = require('../../lib/quote-system/verify');
const { VERIFY_CHANNEL } = require('../../lib/quote-system/constants');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const token = clean(body.token, 128);
    const action = clean(body.action, 16).toLowerCase();
    if (!token || !action) return json(res, 400, { ok: false, error: 'token_and_action_required' });

    const result = await getSessionByToken(token);
    if (!result) return json(res, 404, { ok: false, error: 'session_not_found' });
    if (result.expired) return json(res, 410, { ok: false, error: 'session_expired' });

    const session = result.session;

    if (action === 'send') {
      const email = clean(body.email || session.contact_email, 160).toLowerCase();
      if (!email || email.indexOf('@') < 3) {
        return json(res, 400, { ok: false, error: 'valid_email_required' });
      }

      const code = generateCode();
      await storeVerification(session.id, VERIFY_CHANNEL.EMAIL, email, code);
      await updateSession(session.id, { contact_email: email });

      const quoteSystem = await getQuoteSystemForSite(session.site_id);
      const configVersion = quoteSystem ? await getActiveConfig(quoteSystem) : null;
      const businessName = configVersion &&
        configVersion.config &&
        configVersion.config.business &&
        configVersion.config.business.name;

      const mail = await sendEmailCode(email, code, businessName);
      return json(res, 200, {
        ok: true,
        sent: mail.sent,
        reason: mail.reason || null
      });
    }

    if (action === 'confirm') {
      const code = clean(body.code, 12);
      if (!code) return json(res, 400, { ok: false, error: 'code_required' });

      const verified = await verifyEmailCode(session.id, code);
      if (!verified.ok) return json(res, 400, { ok: false, error: verified.error });

      await updateSession(session.id, { email_verified_at: new Date().toISOString() });
      return json(res, 200, { ok: true, emailVerified: true });
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.error('quote-system/verify-email:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
