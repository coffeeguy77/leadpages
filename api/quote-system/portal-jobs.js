/**
 * GET /api/quote-system/portal-jobs?c=<customer_access_token>
 *   Optional &job=<session_id> for a single job detail.
 *
 * Customer jobs inbox — all quotes for a verified email on a site.
 */

const { json, clean } = require('../../lib/quote-system/http');
const {
  loadCustomerJobsContext,
  loadCustomerJobDetail,
  pdfUrl,
  portalUrl
} = require('../../lib/quote-system/customer-portal');
const { trackPortalView } = require('../../lib/quote-system/portal');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const url = new URL(req.url, 'https://x');
    const accessToken = clean(url.searchParams.get('c') || url.searchParams.get('token'), 128);
    const jobId = clean(url.searchParams.get('job') || url.searchParams.get('id'), 80);
    if (!accessToken) return json(res, 400, { ok: false, error: 'token_required' });

    if (jobId) {
      const ctx = await loadCustomerJobDetail(accessToken, jobId, req);
      if (!ctx.ok) return json(res, ctx.code || 400, { ok: false, error: ctx.error });
      await trackPortalView(ctx.session);
      const sessionPortal = ctx.session.portal_token;
      return json(res, 200, {
        ok: true,
        mode: 'job',
        businessName: ctx.businessName,
        contact: {
          name: ctx.session.contact_name || null,
          email: ctx.session.contact_email || null
        },
        quote: ctx.quote,
        progress: ctx.progress || ctx.session.progress || {},
        status: ctx.session.status,
        accepted: ctx.accepted,
        acceptedAt: ctx.acceptedAt,
        canAccept: ctx.accepted !== true && ctx.session.status !== 'accepted',
        canEdit: !!ctx.canEdit,
        sessionId: ctx.session.id,
        jobsPortalUrl: ctx.jobsPortalUrl,
        accessToken: ctx.accessToken,
        portalUrl: sessionPortal ? portalUrl(req, sessionPortal) : null,
        pdfUrl: sessionPortal ? pdfUrl(req, sessionPortal) : null
      });
    }

    const list = await loadCustomerJobsContext(accessToken, req);
    if (!list.ok) return json(res, list.code || 400, { ok: false, error: list.error });

    return json(res, 200, {
      ok: true,
      mode: 'jobs',
      businessName: list.businessName,
      contact: list.contact,
      jobs: list.jobs,
      jobsPortalUrl: list.jobsPortalUrl,
      accessToken: list.accessToken
    });
  } catch (e) {
    console.error('quote-system/portal-jobs:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
