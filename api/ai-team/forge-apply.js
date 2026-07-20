'use strict';

/**
 * POST /api/ai-team/forge-apply
 * Apply a Forge draft task to sites.config (not publish).
 */

const http = require('../../lib/brain/http');
const { assertAction } = require('../../lib/ai-team/permissions');
const { applyForgeTask } = require('../../lib/ai-team/execution');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = await http.readBody(req);
    const siteId = String((body && body.siteId) || '').trim();
    const taskId = String((body && body.taskId) || '').trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });
    if (!taskId) return http.json(res, 400, { error: 'task_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    const perm = assertAction(access.role, 'forge_apply');
    if (!perm.ok) return http.json(res, 403, { error: perm.error });

    const result = await applyForgeTask(siteId, taskId, {
      actorUserId: user.id,
      actorRole: access.role,
      source: access.role === 'super' ? 'superuser' : access.role
    });

    if (!result.ok) {
      const status =
        result.error === 'site_brain_storage_unavailable'
          ? 503
          : result.error === 'not_forge_task'
            ? 400
            : 400;
      return http.json(res, status, {
        error: result.error,
        message: result.message || null,
        persisted: false,
        published: false
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      published: false,
      executed: true,
      summary: result.summary,
      notice: result.notice,
      editorTab: result.editorTab,
      editorSection: result.editorSection
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
