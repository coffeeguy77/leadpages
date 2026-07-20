'use strict';

/**
 * POST /api/site-brain/sync
 * Initialise or refresh Site Brain from the live site row + config.
 */

const http = require('../../lib/brain/http');
const { syncSiteBrainFromSite } = require('../../lib/site-brain/sync');
const { assertAction } = require('../../lib/ai-team/permissions');

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

    const result = await syncSiteBrainFromSite(access.site, {
      actorUserId: user.id,
      actorRole: access.role,
      forceResync: !!(body && body.forceResync),
      requestId: (body && body.requestId) || null
    });

    if (!result.ok) {
      const status = result.error === 'site_brain_storage_unavailable' ? 503 : 400;
      return http.json(res, status, {
        error: result.error,
        message: result.message || null,
        persisted: false,
        detail: result.detail || null
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      created: result.created,
      brain: result.brain,
      review: result.review,
      needsBootstrapReview: result.needsBootstrapReview
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
