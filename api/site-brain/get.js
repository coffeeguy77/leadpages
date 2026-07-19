'use strict';

/**
 * GET/POST /api/site-brain/get
 * body/query: { siteId }
 */

const http = require('../../lib/brain/http');
const siteBrain = require('../../lib/site-brain');
const { summarizeForUi } = require('../../lib/ai-team/context');
const { assertAction } = require('../../lib/ai-team/permissions');
const { bootstrapReviewFields } = require('../../lib/site-brain/sync');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return http.json(res, 405, { error: 'method_not_allowed' });
    }
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const siteId = String(
      (body && body.siteId) || (req.query && req.query.siteId) || ''
    ).trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const perm = assertAction(access.role, 'view_brain');
    if (!perm.ok) return http.json(res, 403, { error: perm.error });

    const got = await siteBrain.getSiteBrain(siteId);
    if (!got.ok) {
      const status = got.error === 'not_found' ? 404 : 503;
      return http.json(res, status, {
        error: got.error,
        message: got.message || null,
        persisted: !!got.persisted
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      store: got.store,
      brain: got.brain,
      summary: summarizeForUi(got.brain.snapshot),
      review: bootstrapReviewFields(got.brain.snapshot),
      needsBootstrapReview: got.brain.bootstrap_status !== 'reviewed',
      role: access.role
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
