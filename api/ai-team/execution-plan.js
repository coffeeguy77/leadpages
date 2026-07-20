'use strict';

/**
 * POST /api/ai-team/execution-plan
 * actions: create | list | preview | apply | cancel | rollback
 *
 * Forge-owned Execution Plans. Never publishes.
 */

const http = require('../../lib/brain/http');
const siteBrain = require('../../lib/site-brain');
const { assertAction } = require('../../lib/ai-team/permissions');
const {
  createExecutionPlanForRecommendations,
  previewExecutionPlan,
  applyExecutionPlan,
  cancelExecutionPlan,
  rollbackExecutionPlan,
  listExecutionPlans,
  recommendationFromRow
} = require('../../lib/ai-team/execution');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
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

    const action = String(
      (body && body.action) || (req.query && req.query.action) || 'list'
    ).trim();

    if (action === 'list') {
      const perm = assertAction(access.role, 'view_brain');
      if (!perm.ok) return http.json(res, 403, { error: perm.error });
      const listed = await listExecutionPlans(siteId);
      if (!listed.ok) {
        return http.json(res, listed.error === 'site_brain_storage_unavailable' ? 503 : 400, {
          error: listed.error,
          persisted: false
        });
      }
      return http.json(res, 200, {
        ok: true,
        persisted: true,
        plans: listed.plans,
        published: false
      });
    }

    const forgePerm = assertAction(access.role, 'forge_apply');
    const approvePerm = assertAction(access.role, 'approve_recommendation');
    const actor = {
      actorUserId: user.id,
      actorRole: access.role,
      source: access.role === 'super' ? 'superuser' : access.role,
      editorContext: (body && body.editorContext) || {}
    };

    if (action === 'create') {
      if (!approvePerm.ok) return http.json(res, 403, { error: approvePerm.error });
      const ids = Array.isArray(body.recommendationIds)
        ? body.recommendationIds.map(String)
        : body.recommendationId
          ? [String(body.recommendationId)]
          : [];
      if (!ids.length) return http.json(res, 400, { error: 'recommendation_ids_required' });

      const listed = await siteBrain.listRecommendations(siteId, { limit: 80 });
      if (!listed.ok) {
        return http.json(res, listed.error === 'site_brain_storage_unavailable' ? 503 : 400, {
          error: listed.error,
          persisted: false
        });
      }
      const byId = {};
      (listed.recommendations || []).forEach(function (r) {
        byId[r.id] = r;
      });

      const recs = [];
      for (let i = 0; i < ids.length; i++) {
        const row = byId[ids[i]];
        if (!row) {
          return http.json(res, 400, { error: 'recommendation_not_found', id: ids[i] });
        }
        // Approve each selected recommendation
        const approved = await siteBrain.approveRecommendation(siteId, ids[i], actor);
        if (!approved.ok) {
          return http.json(res, 400, {
            error: approved.error,
            message: approved.message || null,
            persisted: false
          });
        }
        recs.push(recommendationFromRow(approved.recommendation));
      }

      const result = await createExecutionPlanForRecommendations(siteId, recs, actor);
      if (!result.ok) {
        return http.json(res, result.error === 'site_brain_storage_unavailable' ? 503 : 400, {
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
        plan: result.plan,
        preview: result.preview,
        task: result.task,
        knowledgeTasks: result.knowledgeTasks || [],
        nextStep: result.nextStep
      });
    }

    const planId = String((body && body.planId) || '').trim();
    if (!planId) return http.json(res, 400, { error: 'plan_id_required' });
    if (!forgePerm.ok && action !== 'preview') {
      return http.json(res, 403, { error: forgePerm.error });
    }

    let result;
    if (action === 'preview') {
      const viewPerm = assertAction(access.role, 'view_brain');
      if (!viewPerm.ok) return http.json(res, 403, { error: viewPerm.error });
      result = await previewExecutionPlan(siteId, planId, actor);
    } else if (action === 'apply') {
      result = await applyExecutionPlan(siteId, planId, actor);
    } else if (action === 'cancel') {
      result = await cancelExecutionPlan(siteId, planId, actor);
    } else if (action === 'rollback') {
      result = await rollbackExecutionPlan(siteId, planId, actor);
    } else {
      return http.json(res, 400, { error: 'unknown_action' });
    }

    if (!result.ok) {
      const status =
        result.error === 'site_brain_storage_unavailable'
          ? 503
          : result.error === 'guardian_blocked'
            ? 403
            : 400;
      return http.json(res, status, {
        error: result.error,
        message: result.message || null,
        guardian: result.guardian || null,
        persisted: false,
        published: false
      });
    }

    return http.json(res, 200, {
      ok: true,
      persisted: true,
      published: false,
      executed: !!result.executed,
      plan: result.plan || null,
      preview: result.preview || (result.plan && result.plan.preview) || null,
      summary: result.summary || null,
      notice: result.notice || null,
      editorTab: result.editorTab || null,
      editorSection: result.editorSection || null,
      rollbackSnapshotId: result.rollbackSnapshotId || null,
      canApply: result.canApply
    });
  } catch (e) {
    return http.json(res, 500, { error: 'server_error', message: String((e && e.message) || e) });
  }
};
