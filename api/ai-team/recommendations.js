'use strict';

/**
 * GET/POST /api/ai-team/recommendations
 * list | approve | reject
 *
 * Phase 2: approve also creates an open task (Forge draft when supported).
 */

const http = require('../../lib/brain/http');
const siteBrain = require('../../lib/site-brain');
const { assertAction } = require('../../lib/ai-team/permissions');
const {
  createTaskForApprovedRecommendation,
  recommendationFromRow
} = require('../../lib/ai-team/execution');

module.exports = async (req, res) => {
  try {
    const user = await http.requireUser(req);
    if (!user) return http.json(res, 401, { error: 'unauthorized' });

    const body = req.method === 'POST' ? await http.readBody(req) : {};
    const siteId = String(
      (body && body.siteId) || (req.query && req.query.siteId) || ''
    ).trim();
    if (!siteId) return http.json(res, 400, { error: 'site_id_required' });

    const access = await http.assertSiteAccess(user, siteId);
    if (!access.ok) return http.json(res, access.code, { error: access.error });

    if (req.method === 'GET' || (body && body.action === 'list') || !body.action) {
      const perm = assertAction(access.role, 'view_brain');
      if (!perm.ok) return http.json(res, 403, { error: perm.error });
      const listed = await siteBrain.listRecommendations(siteId, {
        status: (body && body.status) || (req.query && req.query.status) || null,
        limit: 40
      });
      if (!listed.ok) {
        return http.json(res, listed.error === 'site_brain_storage_unavailable' ? 503 : 400, {
          error: listed.error,
          message: listed.message || null,
          persisted: false
        });
      }
      return http.json(res, 200, {
        ok: true,
        persisted: true,
        recommendations: listed.recommendations
      });
    }

    if (req.method !== 'POST') return http.json(res, 405, { error: 'method_not_allowed' });

    const perm = assertAction(access.role, 'approve_recommendation');
    if (!perm.ok) return http.json(res, 403, { error: perm.error });

    const action = String(body.action || '');
    const recommendationId = String(body.recommendationId || '').trim();
    if (!recommendationId) return http.json(res, 400, { error: 'recommendation_id_required' });

    let result;
    if (action === 'approve') {
      result = await siteBrain.approveRecommendation(siteId, recommendationId, {
        actorUserId: user.id,
        actorRole: access.role,
        source: access.role === 'super' ? 'superuser' : access.role
      });
      if (result.ok) {
        const rec = recommendationFromRow(result.recommendation);
        const taskResult = await createTaskForApprovedRecommendation(siteId, rec, {
          actorUserId: user.id,
          actorRole: access.role,
          source: access.role === 'super' ? 'superuser' : access.role
        });
        result.task = taskResult.ok ? taskResult.task : null;
        result.plan = taskResult.ok ? taskResult.plan : null;
        result.nextStep = taskResult.ok
          ? taskResult.plan.message || 'Check Open tasks for the next step.'
          : taskResult.message || null;
        result.executed = false;
        result.published = false;
      }
    } else if (action === 'reject') {
      result = await siteBrain.rejectRecommendation(siteId, recommendationId, {
        actorUserId: user.id,
        actorRole: access.role,
        source: access.role === 'super' ? 'superuser' : access.role
      });
    } else if (action === 'discuss') {
      const permDiscuss = assertAction(access.role, 'atlas_review');
      if (!permDiscuss.ok) return http.json(res, 403, { error: permDiscuss.error });
      const { discussRecommendation } = require('../../lib/ai-team/atlas');
      const discussed = await discussRecommendation({
        siteId,
        recommendationId,
        message: (body && body.message) || '',
        actorUserId: user.id,
        actorRole: access.role
      });
      if (!discussed.ok) {
        return http.json(res, discussed.error === 'site_brain_storage_unavailable' ? 503 : 400, {
          error: discussed.error,
          message: discussed.message || null,
          persisted: false
        });
      }
      return http.json(res, 200, {
        ok: true,
        persisted: true,
        recommendation: discussed.recommendation,
        messages: discussed.messages || [],
        planOutline: discussed.planOutline || []
      });
    } else {
      return http.json(res, 400, { error: 'unknown_action' });
    }

    if (!result.ok) {
      return http.json(res, result.error === 'site_brain_storage_unavailable' ? 503 : 400, {
        error: result.error,
        message: result.message || null,
        persisted: false
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      recommendation: result.recommendation,
      task: result.task || null,
      plan: result.plan || null,
      nextStep: result.nextStep || null,
      executed: false,
      published: false
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
  }
};
