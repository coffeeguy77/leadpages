/**
 * POST /api/quote-system/verify-sms
 *   { token, action: 'send'|'confirm', phone?, code? }
 * Uses Twilio Verify when configured; falls back to error if not.
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const { getSessionByToken } = require('../../lib/quote-system/auth');
const { updateSession } = require('../../lib/quote-system/session');
const { sendSmsCode, checkSmsCode } = require('../../lib/quote-system/verify');

function normalisePhone(phone) {
  var p = String(phone || '').replace(/[\s\-()]/g, '');
  if (!p) return '';
  if (p.charAt(0) === '0') p = '+61' + p.slice(1);
  if (p.charAt(0) !== '+') p = '+61' + p;
  return p;
}

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

    if (!session.email_verified_at) {
      return json(res, 403, { ok: false, error: 'email_not_verified' });
    }

    if (action === 'send') {
      const phone = normalisePhone(body.phone || session.contact_phone);
      if (!phone || phone.length < 10) {
        return json(res, 400, { ok: false, error: 'valid_phone_required' });
      }

      await updateSession(session.id, { contact_phone: phone });
      const sms = await sendSmsCode(phone, null);
      return json(res, 200, {
        ok: true,
        sent: sms.sent,
        reason: sms.reason || null,
        provider: sms.provider || null
      });
    }

    if (action === 'confirm') {
      const code = clean(body.code, 12);
      const phone = normalisePhone(body.phone || session.contact_phone);
      if (!code) return json(res, 400, { ok: false, error: 'code_required' });
      if (!phone) return json(res, 400, { ok: false, error: 'phone_required' });

      const check = await checkSmsCode(phone, code);
      if (!check.ok) return json(res, 400, { ok: false, error: check.error || 'invalid_code' });

      await updateSession(session.id, { sms_verified_at: new Date().toISOString() });
      return json(res, 200, { ok: true, smsVerified: true });
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.error('quote-system/verify-sms:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
