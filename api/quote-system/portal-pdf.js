/**
 * GET /api/quote-system/portal-pdf?t=<portal_token>
 * Download verified quote as PDF.
 */

const { clean } = require('../../lib/quote-system/http');
const { loadPortalContext } = require('../../lib/quote-system/portal');
const { buildQuotePdfBuffer } = require('../../lib/quote-system/pdf');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  try {
    const url = new URL(req.url, 'https://x');
    const token = clean(url.searchParams.get('t') || url.searchParams.get('token'), 128);
    if (!token) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: 'token_required' }));
    }

    const ctx = await loadPortalContext(token);
    if (!ctx.ok) {
      res.statusCode = ctx.code || 400;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: ctx.error }));
    }

    const pdf = await buildQuotePdfBuffer({
      businessName: ctx.businessName,
      contactName: ctx.session.contact_name,
      contactEmail: ctx.session.contact_email,
      quote: ctx.quote,
      accepted: ctx.accepted,
      acceptedAt: ctx.acceptedAt
    });

    const slug = (ctx.site && ctx.site.slug) || 'quote';
    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', 'attachment; filename="' + slug + '-quote.pdf"');
    res.setHeader('cache-control', 'private, no-store');
    return res.end(pdf);
  } catch (e) {
    console.error('quote-system/portal-pdf:', e && e.message);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'server_error' }));
  }
};
