'use strict';

/**
 * Phase 2 — Recommendation → Execution Plan → Guardian → Preview → Apply → Rollback.
 * Forge is the only writer of sites.config.
 */

const { randomUUID } = require('crypto');
const siteBrain = require('../site-brain');
const {
  buildDraftFromRecommendation,
  buildExecutionPlan,
  buildChangePreview,
  applyExecutionPlanToConfig,
  applyPatchToConfig
} = require('./forge');
const { validateExecutionPlan } = require('./guardian');

function getAdmin() {
  return require('../brain/http').admin;
}

function parseJson(val) {
  if (val == null) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_e) {
    return {};
  }
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

async function loadSiteConfig(siteId) {
  try {
    const admin = getAdmin();
    if (!admin || typeof admin.from !== 'function') {
      return { ok: true, site: { id: siteId }, config: {}, degraded: true };
    }
    const { data, error } = await admin
      .from('sites')
      .select('id, config, business_name, slug')
      .eq('id', String(siteId))
      .maybeSingle();
    if (error || !data) {
      // Planning can proceed with empty config in tests / missing rows
      return { ok: true, site: { id: siteId }, config: {}, degraded: true };
    }
    return { ok: true, site: data, config: data.config || {} };
  } catch (_e) {
    return { ok: true, site: { id: siteId }, config: {}, degraded: true };
  }
}

function ensurePlanArrays(snap) {
  if (!Array.isArray(snap.executionPlans)) snap.executionPlans = [];
  if (!Array.isArray(snap.configRollbackSnapshots)) snap.configRollbackSnapshots = [];
  if (!Array.isArray(snap.openTasks)) snap.openTasks = [];
  return snap;
}

async function savePlanToBrain(siteId, plan, opts) {
  const o = opts || {};
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = ensurePlanArrays(deepClone(got.brain.snapshot));
  const list = snap.executionPlans.slice();
  const idx = list.findIndex((p) => p && p.id === plan.id);
  const row = Object.assign({}, plan, { updatedAt: new Date().toISOString() });
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  snap.executionPlans = list.slice(0, 40);
  const saved = await siteBrain.saveSnapshot(siteId, snap, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    expectedVersion: got.brain.version,
    eventType: o.eventType || 'execution_plan_upsert',
    path: 'executionPlans',
    source: o.source || 'forge'
  });
  if (!saved.ok) return saved;
  return { ok: true, plan: row, brain: saved.brain, persisted: true };
}

/**
 * After approve (single or batch): create ONE Execution Plan (+ knowledge tasks if needed).
 */
async function createExecutionPlanForRecommendations(siteId, recommendations, opts) {
  const o = opts || {};
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;

  const siteLoad = await loadSiteConfig(siteId);
  if (!siteLoad.ok) return { ...siteLoad, persisted: false };

  const built = buildExecutionPlan({
    recommendations: recommendations,
    snapshot: got.brain.snapshot,
    config: siteLoad.config,
    siteId: siteId,
    editorContext: o.editorContext || {}
  });
  if (!built.ok) return { ...built, persisted: false };

  const plan = built.plan;
  const savedPlan = await savePlanToBrain(siteId, plan, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: o.source || 'forge',
    eventType: 'execution_plan_create'
  });
  if (!savedPlan.ok) return savedPlan;

  // Knowledge follow-ups as open tasks (no config mutation)
  const knowledgeTasks = [];
  for (let i = 0; i < (built.knowledgeTasks || []).length; i++) {
    const k = built.knowledgeTasks[i];
    const task = {
      id: randomUUID(),
      status: 'open',
      createdAt: new Date().toISOString(),
      title: k.title,
      recommendationId: k.recommendationId,
      kind: 'site_knowledge',
      executable: false,
      editorTab: 'ai-team',
      editorSection: null,
      fieldKey: k.fieldKey,
      message: k.message,
      planId: plan.id
    };
    const created = await siteBrain.createTask(siteId, task, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      source: o.source || 'user'
    });
    if (created.ok) knowledgeTasks.push(task);
  }

  let applyTask = null;
  if (plan.steps && plan.steps.length) {
    applyTask = {
      id: randomUUID(),
      status: 'open',
      createdAt: new Date().toISOString(),
      title: plan.title || 'Preview & apply changes',
      recommendationId: (plan.recommendationIds || [])[0] || null,
      recommendationIds: plan.recommendationIds || [],
      kind: 'execution_plan',
      executable: !!(plan.guardian && plan.guardian.canApply),
      editorTab: 'details',
      editorSection: plan.steps[0].operation === 'enable_faq' ? 'faq' : 'hero',
      message: 'Review the Change Preview, then Apply Changes. One rollback point for this batch.',
      planId: plan.id,
      patch: null,
      executionPlanId: plan.id
    };
    const created = await siteBrain.createTask(siteId, applyTask, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      source: o.source || 'forge'
    });
    if (!created.ok) return created;
  }

  return {
    ok: true,
    persisted: true,
    published: false,
    plan: savedPlan.plan,
    preview: savedPlan.plan.preview || buildChangePreview(savedPlan.plan),
    task: applyTask,
    knowledgeTasks: knowledgeTasks,
    nextStep: applyTask
      ? 'Open Change Preview, then Apply Changes — or Cancel.'
      : knowledgeTasks.length
        ? 'Complete Site Knowledge (Answer with Atlas), then ask Atlas again.'
        : 'No configuration changes in this plan.'
  };
}

/**
 * Backward-compatible single-approve path.
 */
async function createTaskForApprovedRecommendation(siteId, recommendation, opts) {
  const o = opts || {};
  const result = await createExecutionPlanForRecommendations(siteId, [recommendation], o);
  if (!result.ok) return result;

  // Preserve prior shape used by recommendations API / tests
  const planCompat = buildDraftFromRecommendation(
    recommendation,
    (await siteBrain.getSiteBrain(siteId)).brain.snapshot,
    (await loadSiteConfig(siteId)).config
  );

  return {
    ok: true,
    persisted: true,
    task: result.task || (result.knowledgeTasks && result.knowledgeTasks[0]) || null,
    plan: planCompat.ok ? planCompat : result.plan,
    executionPlan: result.plan,
    preview: result.preview,
    nextStep: result.nextStep,
    published: false
  };
}

async function getExecutionPlan(siteId, planId) {
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = ensurePlanArrays(got.brain.snapshot);
  const plan = (snap.executionPlans || []).find((p) => p && p.id === String(planId));
  if (!plan) return { ok: false, error: 'plan_not_found', persisted: false };
  return { ok: true, plan: plan, brain: got.brain, persisted: true };
}

async function previewExecutionPlan(siteId, planId, opts) {
  const got = await getExecutionPlan(siteId, planId);
  if (!got.ok) return got;
  const siteLoad = await loadSiteConfig(siteId);
  if (!siteLoad.ok) return { ...siteLoad, persisted: false };

  // Refresh before values from live config for accurate preview
  const rebuilt = buildExecutionPlan({
    recommendations: (got.plan.recommendationIds || []).map(function (id) {
      return { id: id, proposedChange: { type: 'outcome', outcome: inferOutcomeFromPlanStep(got.plan, id) } };
    }),
    snapshot: got.brain.snapshot,
    config: siteLoad.config,
    siteId: siteId,
    editorContext: (opts && opts.editorContext) || got.plan.editorContext || {}
  });

  // Prefer stored plan steps (already Guardian-validated) with refreshed preview shell
  const plan = Object.assign({}, got.plan, {
    preview: buildChangePreview(got.plan),
    status: got.plan.status === 'draft' && got.plan.guardian && got.plan.guardian.ok
      ? 'preview_ready'
      : got.plan.status
  });

  const guardian = validateExecutionPlan(plan, { config: siteLoad.config, requireSiteId: siteId });
  plan.guardian = guardian;
  if (guardian.ok && plan.steps && plan.steps.length) plan.status = 'preview_ready';

  await savePlanToBrain(siteId, plan, {
    actorUserId: opts && opts.actorUserId,
    actorRole: opts && opts.actorRole,
    source: (opts && opts.source) || 'forge',
    eventType: 'execution_plan_preview'
  });

  return {
    ok: true,
    persisted: true,
    published: false,
    plan: plan,
    preview: plan.preview,
    guardian: guardian,
    canApply: !!(guardian.canApply),
    rebuiltOk: rebuilt.ok
  };
}

function inferOutcomeFromPlanStep(plan, recId) {
  const step = (plan.steps || []).find((s) => s.recommendationId === recId);
  return (step && step.outcome) || null;
}

/**
 * Apply Execution Plan after Guardian + Preview. Captures one rollback snapshot.
 */
async function applyExecutionPlan(siteId, planId, opts) {
  const o = opts || {};
  const got = await getExecutionPlan(siteId, planId);
  if (!got.ok) return got;
  let plan = got.plan;

  if (plan.status === 'applied') {
    return { ok: false, error: 'already_applied', message: 'This plan was already applied.', persisted: false };
  }
  if (plan.status === 'cancelled' || plan.status === 'rolled_back') {
    return { ok: false, error: 'plan_not_active', message: 'This plan is not active.', persisted: false };
  }

  const guardian = validateExecutionPlan(plan, { requireSiteId: siteId });
  if (!guardian.ok || !guardian.canApply) {
    return {
      ok: false,
      error: 'guardian_blocked',
      message: 'Guardian blocked this Execution Plan.',
      guardian: guardian,
      persisted: false
    };
  }

  const siteLoad = await loadSiteConfig(siteId);
  // Apply must have real config — refuse degraded empty when applying
  if (!siteLoad.ok || siteLoad.degraded) {
    return {
      ok: false,
      error: 'site_not_found',
      message: 'Could not load site config for Apply.',
      persisted: false
    };
  }

  const rollbackId = randomUUID();
  const beforeConfig = deepClone(siteLoad.config);
  const applied = applyExecutionPlanToConfig(siteLoad.config, plan);
  if (!applied.ok) return { ...applied, persisted: false };

  const admin = getAdmin();
  const { error } = await admin
    .from('sites')
    .update({
      config: applied.config,
      updated_at: new Date().toISOString()
    })
    .eq('id', String(siteId));
  if (error) {
    return { ok: false, error: 'save_failed', message: error.message, persisted: false };
  }

  // Persist rollback snapshot + plan status
  const brainGot = await siteBrain.getSiteBrain(siteId);
  if (brainGot.ok) {
    const snap = ensurePlanArrays(deepClone(brainGot.brain.snapshot));
    snap.configRollbackSnapshots.unshift({
      id: rollbackId,
      planId: plan.id,
      config: beforeConfig,
      createdAt: new Date().toISOString(),
      summary: applied.summary
    });
    snap.configRollbackSnapshots = snap.configRollbackSnapshots.slice(0, 20);

    const idx = snap.executionPlans.findIndex((p) => p && p.id === plan.id);
    plan = Object.assign({}, plan, {
      status: 'applied',
      appliedAt: new Date().toISOString(),
      rollbackSnapshotId: rollbackId,
      rollbackStrategy: Object.assign({}, plan.rollbackStrategy || {}, {
        type: 'config_snapshot',
        snapshotId: rollbackId
      }),
      updatedAt: new Date().toISOString()
    });
    if (idx >= 0) snap.executionPlans[idx] = plan;
    else snap.executionPlans.unshift(plan);

    // Complete related open tasks
    snap.openTasks = (snap.openTasks || []).filter(function (t) {
      if (!t) return false;
      if (t.planId === plan.id || t.executionPlanId === plan.id) return false;
      return t.status !== 'completed';
    });

    await siteBrain.saveSnapshot(siteId, snap, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      expectedVersion: brainGot.brain.version,
      eventType: 'execution_plan_apply',
      path: 'executionPlans',
      source: o.source || 'forge'
    });
  }

  await siteBrain.addEvidence(siteId, {
    type: 'forge_apply',
    planId: plan.id,
    recommendationIds: plan.recommendationIds || [],
    paths: applied.paths,
    summary: applied.summary,
    rollbackSnapshotId: rollbackId
  }, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: 'forge'
  });

  const landingStep = (plan.steps || []).find((s) => s && s.operation === 'create_landing_page');
  const pageId =
    (applied && applied.pageId) ||
    (landingStep && landingStep.after && landingStep.after.page && landingStep.after.page.id) ||
    null;
  const pageSlug =
    (applied && applied.pageSlug) ||
    (landingStep && landingStep.after && landingStep.after.page && landingStep.after.page.slug) ||
    null;

  const editorSection =
    landingStep
      ? null
      : (plan.steps || []).some((s) => s.operation === 'enable_faq')
        ? 'faq'
        : (plan.steps || []).some((s) => s.operation === 'hero_cta')
          ? 'hero'
          : null;

  return {
    ok: true,
    persisted: true,
    published: false,
    executed: true,
    plan: plan,
    summary: applied.summary,
    paths: applied.paths,
    rollbackSnapshotId: rollbackId,
    editorTab: pageId ? 'landing' : 'details',
    editorSection: editorSection,
    pageId: pageId,
    pageSlug: pageSlug,
    notice: pageId
      ? 'Landing page draft created' +
        (pageSlug ? ' (/' + pageSlug + ')' : '') +
        '. Review in Landing pages, then Publish Live Site yourself.'
      : 'Changes applied to site config (one batch, one rollback point). Review in Page editor, then Publish Live Site.'
  };
}

async function cancelExecutionPlan(siteId, planId, opts) {
  const o = opts || {};
  const got = await getExecutionPlan(siteId, planId);
  if (!got.ok) return got;
  if (got.plan.status === 'applied') {
    return { ok: false, error: 'already_applied', message: 'Use Rollback instead of Cancel.', persisted: false };
  }
  const plan = Object.assign({}, got.plan, {
    status: 'cancelled',
    updatedAt: new Date().toISOString()
  });
  const saved = await savePlanToBrain(siteId, plan, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: o.source || 'user',
    eventType: 'execution_plan_cancel'
  });
  if (!saved.ok) return saved;

  // Drop related open tasks
  const brainGot = await siteBrain.getSiteBrain(siteId);
  if (brainGot.ok) {
    const snap = ensurePlanArrays(deepClone(brainGot.brain.snapshot));
    snap.openTasks = (snap.openTasks || []).filter(function (t) {
      return t && t.planId !== planId && t.executionPlanId !== planId;
    });
    await siteBrain.saveSnapshot(siteId, snap, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      expectedVersion: brainGot.brain.version,
      eventType: 'execution_plan_cancel_tasks',
      path: 'openTasks',
      source: o.source || 'user'
    });
  }

  return { ok: true, persisted: true, published: false, plan: plan };
}

async function rollbackExecutionPlan(siteId, planId, opts) {
  const o = opts || {};
  const got = await getExecutionPlan(siteId, planId);
  if (!got.ok) return got;
  const plan = got.plan;
  if (plan.status !== 'applied') {
    return { ok: false, error: 'not_applied', message: 'Only applied plans can be rolled back.', persisted: false };
  }
  const snapId = plan.rollbackSnapshotId || (plan.rollbackStrategy && plan.rollbackStrategy.snapshotId);
  if (!snapId) {
    return { ok: false, error: 'rollback_missing', message: 'No rollback snapshot for this plan.', persisted: false };
  }

  const brainGot = await siteBrain.getSiteBrain(siteId);
  if (!brainGot.ok) return brainGot;
  const snap = ensurePlanArrays(deepClone(brainGot.brain.snapshot));
  const rb = (snap.configRollbackSnapshots || []).find((s) => s && s.id === snapId);
  if (!rb || !rb.config) {
    return { ok: false, error: 'rollback_snapshot_missing', persisted: false };
  }

  const admin = getAdmin();
  const { error } = await admin
    .from('sites')
    .update({
      config: rb.config,
      updated_at: new Date().toISOString()
    })
    .eq('id', String(siteId));
  if (error) {
    return { ok: false, error: 'save_failed', message: error.message, persisted: false };
  }

  const updatedPlan = Object.assign({}, plan, {
    status: 'rolled_back',
    rolledBackAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const idx = snap.executionPlans.findIndex((p) => p && p.id === plan.id);
  if (idx >= 0) snap.executionPlans[idx] = updatedPlan;

  await siteBrain.saveSnapshot(siteId, snap, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    expectedVersion: brainGot.brain.version,
    eventType: 'execution_plan_rollback',
    path: 'executionPlans',
    source: o.source || 'forge'
  });

  await siteBrain.addEvidence(siteId, {
    type: 'forge_rollback',
    planId: plan.id,
    rollbackSnapshotId: snapId
  }, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: 'forge'
  });

  return {
    ok: true,
    persisted: true,
    published: false,
    executed: true,
    plan: updatedPlan,
    notice: 'Rolled back to the pre-apply config snapshot. Review in editor, then Publish if needed.'
  };
}

/**
 * Legacy: apply by open task id (execution_plan or forge_draft).
 */
async function applyForgeTask(siteId, taskId, opts) {
  const o = opts || {};
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;

  const tasks = got.brain.snapshot.openTasks || [];
  const task = tasks.find((t) => t && t.id === String(taskId));
  if (!task) return { ok: false, error: 'task_not_found', persisted: false };

  const planId = task.planId || task.executionPlanId;
  if (planId) {
    return applyExecutionPlan(siteId, planId, o);
  }

  // Legacy forge_draft with embedded patch
  if (!task.patch || task.kind !== 'forge_draft') {
    return {
      ok: false,
      error: 'not_forge_task',
      message: 'Preview & apply an Execution Plan, or complete this task manually.',
      persisted: false
    };
  }

  // Wrap legacy patch as a one-step plan apply path
  const siteLoad = await loadSiteConfig(siteId);
  if (!siteLoad.ok) return { ...siteLoad, persisted: false };

  const rollbackId = randomUUID();
  const beforeConfig = deepClone(siteLoad.config);
  const applied = applyPatchToConfig(siteLoad.config, task.patch);
  if (!applied.ok) return { ...applied, persisted: false };

  const admin = getAdmin();
  const { error } = await admin
    .from('sites')
    .update({
      config: applied.config,
      updated_at: new Date().toISOString()
    })
    .eq('id', String(siteId));
  if (error) {
    return { ok: false, error: 'save_failed', message: error.message, persisted: false };
  }

  await siteBrain.completeTask(siteId, taskId, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: o.source || 'forge',
    resultSummary: applied.summary
  });

  const brainGot = await siteBrain.getSiteBrain(siteId);
  if (brainGot.ok) {
    const snap = ensurePlanArrays(deepClone(brainGot.brain.snapshot));
    snap.configRollbackSnapshots.unshift({
      id: rollbackId,
      planId: null,
      taskId: taskId,
      config: beforeConfig,
      createdAt: new Date().toISOString(),
      summary: applied.summary
    });
    snap.configRollbackSnapshots = snap.configRollbackSnapshots.slice(0, 20);
    await siteBrain.saveSnapshot(siteId, snap, {
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      expectedVersion: brainGot.brain.version,
      eventType: 'forge_legacy_apply',
      path: 'configRollbackSnapshots',
      source: o.source || 'forge'
    });
  }

  await siteBrain.addEvidence(siteId, {
    type: 'forge_apply',
    taskId,
    recommendationId: task.recommendationId || null,
    paths: applied.paths,
    summary: applied.summary,
    rollbackSnapshotId: rollbackId
  }, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: 'forge'
  });

  return {
    ok: true,
    persisted: true,
    published: false,
    executed: true,
    summary: applied.summary,
    paths: applied.paths,
    rollbackSnapshotId: rollbackId,
    editorTab: task.editorTab || 'details',
    editorSection: task.editorSection || null,
    notice: 'Saved to site config. Open Page editor to review, then Publish Live Site.'
  };
}

function recommendationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    site_id: row.site_id,
    specialist: row.specialist,
    title: row.title,
    problem: row.problem,
    status: row.status,
    proposed_change: parseJson(row.proposed_change),
    proposedChange: parseJson(row.proposed_change),
    executable: row.executable,
    capability_gap: row.capability_gap
  };
}

async function listExecutionPlans(siteId) {
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = ensurePlanArrays(got.brain.snapshot);
  return {
    ok: true,
    persisted: true,
    plans: snap.executionPlans || []
  };
}

module.exports = {
  createTaskForApprovedRecommendation,
  createExecutionPlanForRecommendations,
  previewExecutionPlan,
  applyExecutionPlan,
  cancelExecutionPlan,
  rollbackExecutionPlan,
  applyForgeTask,
  buildDraftFromRecommendation,
  recommendationFromRow,
  getExecutionPlan,
  listExecutionPlans
};
