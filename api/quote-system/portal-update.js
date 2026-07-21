/**
 * POST /api/quote-system/portal-update
 *   { c: customerAccessToken, job: sessionId, progress: { hours?, guestCount?, beverageLines?, addonIds?, eventDate? } }
 *
 * Customer edits quantities on an open (not-yet-accepted) quote.
 */

const { readBody, json, clean } = require('../../lib/quote-system/http');
const { updateCustomerJob } = require('../../lib/quote-system/customer-portal');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await readBody(req);
    const accessToken = clean(body.c || body.token || body.accessToken, 128);
    const jobId = clean(body.job || body.sessionId || body.id, 80);
    if (!accessToken || !jobId) {
      return json(res, 400, { ok: false, error: 'token_and_job_required' });
    }

    const result = await updateCustomerJob(accessToken, jobId, body.progress || body.inputs || {});
    if (!result.ok) return json(res, result.code || 400, { ok: false, error: result.error });

    return json(res, 200, {
      ok: true,
      quote: result.quote,
      sessionId: result.session.id,
      status: result.session.status
    });
  } catch (e) {
    console.error('quote-system/portal-update:', e && e.message);
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
