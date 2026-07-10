/**
 * POST /api/quote-system/portal-accept
 *   { token, confirm: true, name? }
 * Customer accepts a verified quote via portal token.
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const {
  loadPortalContext,
  hashIp,
  portalUrl
} = require('../../lib/quote-system/portal');
const { getAdmin } = require('../../lib/quote-system/supabase');
const { updateSession } = require('../../lib/quote-system/session');
const { SESSION_STATUS } = require('../../lib/quote-system/constants');
const { formatMoney } = require('../../lib/quote-system/serializers');
const {
  sendAcceptanceNotifyEmail,
  contactEmailForSite
} = require('../../lib/quote-system/portal-email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const token = clean(body.token || body.t, 128);
    if (!token) return json(res, 400, { ok: false, error: 'token_required' });
    if (!body.confirm) return json(res, 400, { ok: false, error: 'confirm_required' });

    const ctx = await loadPortalContext(token);
    if (!ctx.ok) return json(res, ctx.code || 400, { ok: false, error: ctx.error });

    if (ctx.session.status === SESSION_STATUS.ACCEPTED || ctx.accepted) {
      return json(res, 200, {
        ok: true,
        alreadyAccepted: true,
        acceptedAt: ctx.session.accepted_at
      });
    }

    const now = new Date().toISOString();
    const acceptedName = clean(body.name || ctx.session.contact_name, 120) || null;
    const admin = getAdmin();

    await admin.from('quote_acceptances').insert({
      session_id: ctx.session.id,
      quote_version_id: ctx.version.id,
      accepted_by_name: acceptedName,
      accepted_by_email: ctx.session.contact_email || null,
      accepted_at: now,
      ip_hash: hashIp(req.headers['x-forwarded-for'] || req.headers['x-real-ip']),
      user_agent: clean(req.headers['user-agent'], 300) || null
    });

    await updateSession(ctx.session.id, {
      status: SESSION_STATUS.ACCEPTED,
      accepted_at: now,
      contact_name: acceptedName || ctx.session.contact_name
    });

    if (ctx.session.lead_id) {
      try {
        await admin.from('leads').update({ status: 'won' }).eq('id', ctx.session.lead_id);
      } catch (leadErr) {
        console.error('quote accept lead update:', leadErr && leadErr.message);
      }
    }

    const notifyTo = contactEmailForSite(ctx.site);
    const totalFormatted = formatMoney(ctx.quote.totalCents);
    if (notifyTo) {
      sendAcceptanceNotifyEmail({
        to: notifyTo,
        businessName: ctx.businessName,
        contactName: acceptedName || ctx.session.contact_name,
        contactEmail: ctx.session.contact_email,
        totalFormatted,
        portalUrl: portalUrl(req, token)
      }).catch(function() {});
    }

    return json(res, 200, {
      ok: true,
      accepted: true,
      acceptedAt: now,
      totalFormatted
    });
  } catch (e) {
    console.error('quote-system/portal-accept:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
