/**
 * POST /api/quote-system/verify-email
 *   { token, action: 'send'|'confirm', email?, code?, force? }
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const {
  getSessionByToken,
  getQuoteSystemForSite,
  getActiveConfig
} = require('../../lib/quote-system/auth');
const { updateSession } = require('../../lib/quote-system/session');
const {
  ensureEmailVerificationSent,
  verifyEmailCode,
  normalizeOtpCode
} = require('../../lib/quote-system/verify');
const { sendQuoteSummaryEmail } = require('../../lib/quote-system/email-verify-flow');
const { assertQuoteAppEntitled } = require('../../lib/quote-system/billing');
const { normalizeEmail, whitelistEmail } = require('../../lib/quote-system/email-whitelist');

const VERIFY_ERROR_MESSAGES = {
  no_pending: 'No verification code is pending. Tap Resend code and try again.',
  expired: 'That code has expired. Tap Resend code for a new one.',
  invalid_code: 'That code does not match. Check the latest email and try again.',
  too_many_attempts: 'Too many attempts. Tap Resend code for a new one.',
  code_required: 'Enter the 6-digit code from your email.'
};

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

    const entitled = await assertQuoteAppEntitled(session.site_id);
    if (!entitled.ok) return json(res, 403, { ok: false, error: entitled.error });

    if (action === 'send') {
      const email = normalizeEmail(clean(body.email || session.contact_email, 160));
      if (!email || email.indexOf('@') < 3) {
        return json(res, 400, { ok: false, error: 'valid_email_required' });
      }

      await updateSession(session.id, { contact_email: email });

      const quoteSystem = await getQuoteSystemForSite(session.site_id);
      const configVersion = quoteSystem ? await getActiveConfig(quoteSystem) : null;
      const businessName = configVersion &&
        configVersion.config &&
        configVersion.config.business &&
        configVersion.config.business.name;

      const mail = await ensureEmailVerificationSent(session.id, email, businessName, {
        force: !!body.force
      });
      return json(res, 200, {
        ok: true,
        sent: mail.sent,
        reason: mail.reason || null,
        alreadyPending: !!mail.alreadyPending
      });
    }

    if (action === 'confirm') {
      const code = normalizeOtpCode(body.code || clean(body.code, 12));
      if (!code) {
        return json(res, 400, {
          ok: false,
          error: 'code_required',
          message: VERIFY_ERROR_MESSAGES.code_required
        });
      }

      const verified = await verifyEmailCode(session.id, code);
      if (!verified.ok) {
        return json(res, 400, {
          ok: false,
          error: verified.error,
          message: VERIFY_ERROR_MESSAGES[verified.error] || 'Could not verify that code.'
        });
      }

      await updateSession(session.id, { email_verified_at: new Date().toISOString() });

      let whitelisted = false;
      if (session.contact_email) {
        try {
          await whitelistEmail(session.site_id, session.contact_email);
          whitelisted = true;
        } catch (wlErr) {
          // Never fail a successful OTP because whitelist upsert failed (missing
          // migration, RLS, etc). Verification itself already succeeded.
          console.warn('quote-system verify-email whitelist:', wlErr && wlErr.message);
        }
      }

      let emailSummary = null;
      try {
        emailSummary = await sendQuoteSummaryEmail(session);
      } catch (mailErr) {
        console.warn('quote-system verify-email summary mail:', mailErr && mailErr.message);
      }

      return json(res, 200, {
        ok: true,
        emailVerified: true,
        whitelisted: whitelisted,
        summaryEmailSent: !!(emailSummary && emailSummary.sent)
      });
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.error('quote-system/verify-email:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
