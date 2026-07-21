/**
 * POST /api/quote-system/portal-email
 *   { c?: customerAccessToken, t?: sessionPortalToken, job?: sessionId }
 *
 * Re-email the itemised quote PDF + portal link to the customer.
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const { loadPortalContext, pdfUrl, portalUrl } = require('../../lib/quote-system/portal');
const { loadCustomerJobDetail } = require('../../lib/quote-system/customer-portal');
const { sendPortalLinkEmail } = require('../../lib/quote-system/portal-email');
const { buildQuotePdfBuffer } = require('../../lib/quote-system/pdf');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const sessionPortal = clean(body.t || body.portalToken, 128);
    const customerToken = clean(body.c || body.accessToken, 128);
    const jobId = clean(body.job || body.sessionId, 80);

    let ctx = null;
    let mailPortalUrl = null;
    let mailPdfUrl = null;

    if (customerToken && jobId) {
      ctx = await loadCustomerJobDetail(customerToken, jobId, req);
      if (!ctx.ok) return json(res, ctx.code || 400, { ok: false, error: ctx.error });
      mailPortalUrl = ctx.session.portal_token ? portalUrl(req, ctx.session.portal_token) : null;
      mailPdfUrl = ctx.session.portal_token ? pdfUrl(req, ctx.session.portal_token) : null;
    } else if (sessionPortal) {
      ctx = await loadPortalContext(sessionPortal);
      if (!ctx.ok) return json(res, ctx.code || 400, { ok: false, error: ctx.error });
      mailPortalUrl = portalUrl(req, sessionPortal);
      mailPdfUrl = pdfUrl(req, sessionPortal);
    } else {
      return json(res, 400, { ok: false, error: 'token_required' });
    }

    const email = ctx.session.contact_email;
    if (!email) return json(res, 400, { ok: false, error: 'no_email' });

    let pdfBuffer = null;
    try {
      pdfBuffer = await buildQuotePdfBuffer({
        businessName: ctx.businessName,
        contactName: ctx.session.contact_name,
        contactEmail: email,
        quote: ctx.quote || {}
      });
    } catch (pdfErr) {
      console.warn('portal-email pdf:', pdfErr && pdfErr.message);
    }

    const sent = await sendPortalLinkEmail({
      to: email,
      businessName: ctx.businessName,
      portalUrl: mailPortalUrl,
      totalFormatted: ctx.quote && ctx.quote.totalFormatted,
      pdfBuffer
    });

    return json(res, 200, {
      ok: true,
      sent: !!sent.sent,
      reason: sent.reason || null,
      pdfUrl: mailPdfUrl
    });
  } catch (e) {
    console.error('quote-system/portal-email:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
