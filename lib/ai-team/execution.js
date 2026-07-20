'use strict';

/**
 * Phase 2 — recommendation approval → open tasks (+ Forge drafts when supported).
 */

const { randomUUID } = require('crypto');
const siteBrain = require('../site-brain');
const { buildDraftFromRecommendation, applyPatchToConfig } = require('./forge');

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

async function loadSiteConfig(siteId) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('sites')
    .select('id, config, business_name, slug')
    .eq('id', String(siteId))
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'site_not_found', message: error && error.message };
  return { ok: true, site: data, config: data.config || {} };
}

/**
 * After approve: create an open task describing the next step.
 */
async function createTaskForApprovedRecommendation(siteId, recommendation, opts) {
  const o = opts || {};
  const rec = recommendation || {};
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;

  const plan = buildDraftFromRecommendation(rec, got.brain.snapshot);
  if (!plan.ok && plan.error) return plan;

  const task = {
    id: randomUUID(),
    status: 'open',
    createdAt: new Date().toISOString(),
    title: plan.title || rec.title || 'Follow up',
    recommendationId: rec.id,
    kind: plan.kind || 'manual',
    executable: !!plan.executable,
    editorTab: plan.editorTab || 'details',
    editorSection: plan.editorSection || null,
    fieldKey: plan.fieldKey || null,
    message: plan.message || null,
    patch: plan.patch || null,
    capabilityId: plan.capabilityId || null,
    sectionKey: plan.sectionKey || null
  };

  const created = await siteBrain.createTask(siteId, task, {
    actorUserId: o.actorUserId,
    actorRole: o.actorRole,
    source: o.source || 'user'
  });
  if (!created.ok) return created;

  return {
    ok: true,
    task,
    plan,
    persisted: true
  };
}

/**
 * Apply a Forge draft task to sites.config (not publish).
 */
async function applyForgeTask(siteId, taskId, opts) {
  const o = opts || {};
  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return got;

  const tasks = got.brain.snapshot.openTasks || [];
  const task = tasks.find((t) => t && t.id === String(taskId));
  if (!task) return { ok: false, error: 'task_not_found', persisted: false };
  if (!task.patch || task.kind !== 'forge_draft') {
    return {
      ok: false,
      error: 'not_forge_task',
      message: 'This task must be completed manually in the editor.',
      persisted: false
    };
  }

  const siteLoad = await loadSiteConfig(siteId);
  if (!siteLoad.ok) return { ...siteLoad, persisted: false };

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

  await siteBrain.addEvidence(siteId, {
    type: 'forge_apply',
    taskId,
    recommendationId: task.recommendationId || null,
    paths: applied.paths,
    summary: applied.summary
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

module.exports = {
  createTaskForApprovedRecommendation,
  applyForgeTask,
  buildDraftFromRecommendation,
  recommendationFromRow
};
