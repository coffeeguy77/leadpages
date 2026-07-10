/**
 * GET /api/quote-system/portal?t=<portal_token>
 * Customer portal JSON — full verified quote, acceptance state, PDF URL.
 */

const { json, clean } = require('../../lib/quote-system/http');
const {
  loadPortalContext,
  trackPortalView,
  pdfUrl,
  portalUrl
} = require('../../lib/quote-system/portal');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const url = new URL(req.url, 'https://x');
    const token = clean(url.searchParams.get('t') || url.searchParams.get('token'), 128);
    if (!token) return json(res, 400, { ok: false, error: 'token_required' });

    const ctx = await loadPortalContext(token);
    if (!ctx.ok) return json(res, ctx.code || 400, { ok: false, error: ctx.error });

    await trackPortalView(ctx.session);

    return json(res, 200, {
      ok: true,
      businessName: ctx.businessName,
      contact: {
        name: ctx.session.contact_name || null,
        email: ctx.session.contact_email || null
      },
      quote: ctx.quote,
      status: ctx.session.status,
      accepted: ctx.accepted,
      acceptedAt: ctx.acceptedAt,
      portalUrl: portalUrl(req, token),
      pdfUrl: pdfUrl(req, token),
      canAccept: ctx.accepted !== true && ctx.session.status !== 'accepted'
    });
  } catch (e) {
    console.error('quote-system/portal:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
