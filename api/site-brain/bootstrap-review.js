'use strict';

/**
 * POST /api/site-brain/bootstrap-review
 * User confirms/corrects bootstrap fields (not raw JSON).
 */

const http = require('../../lib/brain/http');
const { applyBootstrapReview, bootstrapReviewFields } = require('../../lib/site-brain/sync');
const { assertAction } = require('../../lib/ai-team/permissions');
const { summarizeForUi } = require('../../lib/ai-team/context');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = await http.readBody(req);
    const siteId = String((body && body.siteId) || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const perm = assertAction(access.role, 'mutate_brain');
    if (!perm.ok) return http.json(res, 403, { error: perm.error });

    const result = await applyBootstrapReview(siteId, (body && body.answers) || {}, {
      actorUserId: user.id,
      actorRole: access.role,
      source: access.role === 'super' ? 'superuser' : access.role === 'partner' ? 'partner' : 'user'
    });

    if (!result.ok) {
      const status = result.error === 'site_brain_storage_unavailable' ? 503 : 400;
      return http.json(res, status, {
        error: result.error,
        message: result.message || null,
        persisted: false
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      brain: result.brain,
      summary: summarizeForUi(result.brain.snapshot),
      review: bootstrapReviewFields(result.brain.snapshot),
      needsBootstrapReview: false
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
