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
const { assertQuoteAppEntitled } = require('../../lib/quote-system/billing');
const { normalizeEmail, isEmailWhitelisted } = require('../../lib/quote-system/email-whitelist');
const { ensureEmailVerificationSent } = require('../../lib/quote-system/verify');
const { sendQuoteSummaryEmail } = require('../../lib/quote-system/email-verify-flow');

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

    const entitled = await assertQuoteAppEntitled(session.site_id);
    if (!entitled.ok) {
      return json(res, 403, { ok: false, error: entitled.error });
    }

    const configVersion = await getActiveConfig(quoteSystem);
    if (!configVersion || !configVersion.config) {
      return json(res, 503, { ok: false, error: 'no_config' });
    }

    const progress = Object.assign({}, session.progress || {}, body.inputs || {});
    const contactPatch = {};
    const bodyContact = body.contact && typeof body.contact === 'object' ? body.contact : {};
    if (bodyContact.name) contactPatch.contact_name = String(bodyContact.name).trim().slice(0, 120);
    if (bodyContact.email) contactPatch.contact_email = normalizeEmail(bodyContact.email);
    if (bodyContact.phone) contactPatch.contact_phone = String(bodyContact.phone).trim().slice(0, 60);
    // Also accept email nested in progress.contact for older clients.
    const progressContact = progress.contact && typeof progress.contact === 'object' ? progress.contact : null;
    if (!contactPatch.contact_email && progressContact && progressContact.email) {
      contactPatch.contact_email = normalizeEmail(progressContact.email);
    }
    if (!contactPatch.contact_name && progressContact && progressContact.name) {
      contactPatch.contact_name = String(progressContact.name).trim().slice(0, 120);
    }

    let workingSession = await updateSession(session.id, Object.assign({
      progress: progress,
      status: SESSION_STATUS.SUBMITTED
    }, contactPatch));

    let emailVerification = { required: false, sent: false, whitelisted: false, reason: null };

    const email = normalizeEmail(workingSession.contact_email || contactPatch.contact_email || '');
    if (email && !workingSession.email_verified_at) {
      emailVerification.required = true;

      if (await isEmailWhitelisted(workingSession.site_id, email)) {
        workingSession = await updateSession(workingSession.id, {
          contact_email: email,
          email_verified_at: new Date().toISOString()
        });
        emailVerification.whitelisted = true;
        try {
          await sendQuoteSummaryEmail(workingSession);
        } catch (mailErr) {
          console.warn('quote-system calculate whitelisted summary:', mailErr && mailErr.message);
        }
      } else {
        const businessName = configVersion.config &&
          configVersion.config.business &&
          configVersion.config.business.name;
        // Always force a fresh email on calculate so "Get my quote" actually delivers a code.
        const mail = await ensureEmailVerificationSent(workingSession.id, email, businessName, {
          force: true
        });
        emailVerification.sent = !!mail.sent;
        emailVerification.reason = mail.reason || null;
        emailVerification.alreadyPending = !!mail.alreadyPending;
        if (!mail.sent) {
          console.warn('quote-system calculate email OTP not sent:', mail.reason || 'unknown');
        }
      }
    } else if (!email) {
      emailVerification.required = true;
      emailVerification.reason = 'no_email';
      console.warn('quote-system calculate: no contact_email on session — OTP skipped');
    }

    const level = verificationLevelForSession(workingSession);
    const calc = calculateQuote(configVersion.config, progress);
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

    const updatedSession = workingSession;

    if (!updatedSession.lead_id && updatedSession.contact_email && level !== RESPONSE_LEVEL.PUBLIC_PROGRESS) {
      const admin = require('../../lib/quote-system/supabase').getAdmin();
      const { data: siteRow } = await admin.from('sites')
        .select('id,business_name,owner_user_id,config')
        .eq('id', session.site_id)
        .maybeSingle();
      if (siteRow) {
        try {
          const leadId = await createQuoteLead(siteRow, updatedSession, calc, configVersion.config);
          if (leadId) await linkLeadToSession(updatedSession, leadId);
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
      session: serializeSession(updatedSession, level),
      emailVerification: emailVerification
    });
  } catch (e) {
    console.error('quote-system/calculate:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
