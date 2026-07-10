/**
 * POST /api/quote-system/issue-portal
 *   { token }  — session_token from wizard
 * Issues portal link after SMS verification (idempotent).
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const { getSessionByToken } = require('../../lib/quote-system/auth');
const { finalizeVerifiedPortal } = require('../../lib/quote-system/portal');
const { sendPortalLinkEmail } = require('../../lib/quote-system/portal-email');
const { getAdmin } = require('../../lib/quote-system/supabase');
const { formatMoney } = require('../../lib/quote-system/serializers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const token = clean(body.token, 128);
    if (!token) return json(res, 400, { ok: false, error: 'token_required' });

    const result = await getSessionByToken(token);
    if (!result) return json(res, 404, { ok: false, error: 'session_not_found' });
    if (result.expired) return json(res, 410, { ok: false, error: 'session_expired' });

    const finalized = await finalizeVerifiedPortal(result.session, req);
    if (!finalized.ok) return json(res, 403, { ok: false, error: finalized.error });

    const { data: site } = await getAdmin().from('sites')
      .select('business_name')
      .eq('id', result.session.site_id)
      .maybeSingle();

    let emailed = { sent: false };
    if (finalized.session.contact_email) {
      emailed = await sendPortalLinkEmail({
        to: finalized.session.contact_email,
        businessName: (site && site.business_name) || 'Your provider',
        portalUrl: finalized.portalUrl,
        totalFormatted: finalized.quote && finalized.quote.totalFormatted
      });
    }

    return json(res, 200, {
      ok: true,
      portalUrl: finalized.portalUrl,
      pdfUrl: finalized.pdfUrl,
      quote: finalized.quote,
      emailed: emailed.sent,
      emailReason: emailed.reason || null
    });
  } catch (e) {
    console.error('quote-system/issue-portal:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
