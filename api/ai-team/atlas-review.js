'use strict';

/**
 * POST /api/ai-team/atlas-review
 * Advisory only — persists recommendations; never mutates sites.config.
 */

const http = require('../../lib/brain/http');
const { runAtlasReview } = require('../../lib/ai-team/atlas');
const { assertAction } = require('../../lib/ai-team/permissions');
const { sanitizeEditorContext } = require('../../lib/ai-team/context');

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

    const perm = assertAction(access.role, 'atlas_review');
    if (!perm.ok) return http.json(res, 403, { error: perm.error });

    const editorContext = sanitizeEditorContext({
      ...((body && body.editorContext) || {}),
      siteId,
      userRole: access.role
    });

    const result = await runAtlasReview({
      siteId,
      requestText: (body && body.requestText) || '',
      editorContext,
      actorUserId: user.id,
      actorRole: access.role
    });

    if (!result.ok) {
      const status = result.error === 'site_brain_storage_unavailable' || result.error === 'not_found' ? 503 : 400;
      return http.json(res, status, {
        error: result.error,
        message: result.message || 'Atlas review failed',
        persisted: false
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      specialist: 'atlas',
      recommendations: result.recommendations,
      contextUsed: result.contextUsed,
      bootstrapStatus: result.bootstrapStatus,
      publish: false,
      applied: false
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
