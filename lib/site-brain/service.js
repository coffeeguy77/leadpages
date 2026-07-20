'use strict';

/**
 * Controlled Site Brain service — agents never write snapshots directly.
 */

const { randomUUID } = require('crypto');
const {
  emptySnapshot,
  validateSnapshot,
  makeFact,
  approveFact,
  isProtectedPath,
  AGENT_KEYS
} = require('./schema');
const storage = require('./storage');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function setPath(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function getPath(obj, path) {
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

async function createSiteBrain(input) {
  const siteId = String((input && input.siteId) || '');
  const accountId = (input && input.accountId) || null;
  if (!siteId) {
    return { ok: false, error: 'site_id_required', persisted: false };
  }
  const store = storage.adapter();
  const existing = await store.getBrain(siteId);
  if (existing.ok) {
    return { ok: true, brain: existing.brain, created: false, store: existing.store, persisted: true };
  }
  if (existing.error === 'site_brain_storage_unavailable') return existing;

  const snapshot = emptySnapshot(siteId, accountId);
  if (input && input.snapshot && typeof input.snapshot === 'object') {
    Object.assign(snapshot, input.snapshot, {
      schemaVersion: snapshot.schemaVersion,
      siteId,
      accountId
    });
  }
  const v = validateSnapshot(snapshot);
  if (!v.ok) return { ok: false, error: 'invalid_snapshot', errors: v.errors, persisted: false };

  const saved = await store.upsertBrain({
    site_id: siteId,
    account_id: accountId,
    snapshot,
    bootstrap_status: (input && input.bootstrapStatus) || 'pending',
    actor_user_id: (input && input.actorUserId) || null
  });
  if (!saved.ok) return saved;

  await store.appendEvent({
    site_id: siteId,
    brain_id: saved.brain.id,
    version_before: null,
    version_after: saved.brain.version,
    event_type: 'create',
    source: (input && input.source) || 'system',
    actor_user_id: (input && input.actorUserId) || null,
    actor_role: (input && input.actorRole) || null,
    request_id: (input && input.requestId) || null
  });

  return { ok: true, brain: saved.brain, created: true, store: saved.store, persisted: true };
}

async function getSiteBrain(siteId) {
  const store = storage.adapter();
  return store.getBrain(String(siteId));
}

async function saveSnapshot(siteId, snapshot, opts) {
  const o = opts || {};
  const store = storage.adapter();
  const current = await store.getBrain(siteId);
  if (!current.ok && current.error !== 'not_found') return current;
  if (!current.ok) {
    return createSiteBrain({
      siteId,
      accountId: o.accountId,
      snapshot,
      bootstrapStatus: o.bootstrapStatus,
      actorUserId: o.actorUserId,
      actorRole: o.actorRole,
      source: o.source,
      requestId: o.requestId
    });
  }
  const v = validateSnapshot(snapshot);
  if (!v.ok) return { ok: false, error: 'invalid_snapshot', errors: v.errors, persisted: false };

  const saved = await store.upsertBrain({
    site_id: siteId,
    account_id: o.accountId != null ? o.accountId : current.brain.account_id,
    snapshot,
    bootstrap_status: o.bootstrapStatus || current.brain.bootstrap_status,
    expectedVersion: o.expectedVersion != null ? o.expectedVersion : current.brain.version,
    actor_user_id: o.actorUserId || null
  });
  if (!saved.ok) return saved;

  await store.appendEvent({
    site_id: siteId,
    brain_id: saved.brain.id,
    version_before: current.brain.version,
    version_after: saved.brain.version,
    event_type: o.eventType || 'update',
    path: o.path || null,
    before_value: o.beforeValue != null ? o.beforeValue : null,
    after_value: o.afterValue != null ? o.afterValue : null,
    source: o.source || null,
    actor_user_id: o.actorUserId || null,
    actor_role: o.actorRole || null,
    request_id: o.requestId || null,
    meta: o.meta || {}
  });
  return { ok: true, brain: saved.brain, store: saved.store, persisted: true };
}

async function proposeKnowledgeUpdate(siteId, path, factOrValue, opts) {
  const o = opts || {};
  if (isProtectedPath(path)) {
    return {
      ok: false,
      error: 'protected_field',
      message: 'Cannot mutate protected path: ' + path,
      persisted: false
    };
  }
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const before = getPath(snap, path);
  const fact =
    factOrValue && typeof factOrValue === 'object' && 'status' in factOrValue
      ? { ...factOrValue, status: factOrValue.status === 'verified' ? 'proposed' : factOrValue.status || 'proposed' }
      : makeFact(factOrValue, {
          source: o.source || 'specialist_inference',
          status: 'proposed',
          createdBy: o.actorUserId
        });
  // Never silently mark inferred as verified
  if (fact.status === 'verified' && (o.source === 'specialist_inference' || fact.source === 'specialist_inference')) {
    fact.status = 'proposed';
    fact.confidence = Math.min(fact.confidence || 0.5, 0.7);
  }
  setPath(snap, path, fact);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'propose_knowledge',
    path,
    beforeValue: before,
    afterValue: fact
  });
}

async function approveKnowledgeUpdate(siteId, path, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const before = getPath(snap, path);
  if (!before || typeof before !== 'object') {
    return { ok: false, error: 'fact_not_found', persisted: false };
  }
  const after = approveFact(before, o.actorUserId);
  setPath(snap, path, after);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'approve_knowledge',
    path,
    beforeValue: before,
    afterValue: after,
    source: o.source || 'user'
  });
}

async function rejectKnowledgeUpdate(siteId, path, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const before = getPath(snap, path);
  if (!before || typeof before !== 'object') {
    return { ok: false, error: 'fact_not_found', persisted: false };
  }
  const after = {
    ...before,
    status: 'rejected',
    updatedAt: new Date().toISOString(),
    updatedBy: o.actorUserId || null
  };
  setPath(snap, path, after);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'reject_knowledge',
    path,
    beforeValue: before,
    afterValue: after,
    source: o.source || 'user'
  });
}

async function recordAgentObservation(siteId, agentKey, observation, opts) {
  const o = opts || {};
  const key = String(agentKey || '').toLowerCase();
  if (!AGENT_KEYS.includes(key)) {
    return { ok: false, error: 'unknown_agent', persisted: false };
  }
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  if (!snap.agentMemory[key] || typeof snap.agentMemory[key] !== 'object') {
    snap.agentMemory[key] = {};
  }
  // Agents may only write their own namespace
  const mem = snap.agentMemory[key];
  const observations = Array.isArray(mem.observations) ? mem.observations.slice() : [];
  observations.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    ...observation
  });
  mem.observations = observations.slice(-40);
  if (observation && observation.conclusions && typeof observation.conclusions === 'object') {
    mem.conclusions = { ...(mem.conclusions || {}), ...observation.conclusions };
  }
  snap.agentMemory[key] = mem;
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'agent_observation',
    path: 'agentMemory.' + key,
    source: o.source || 'specialist_inference'
  });
}

async function recordRecommendation(siteId, recommendation, opts) {
  const o = opts || {};
  const store = storage.adapter();
  const got = await store.getBrain(siteId);
  if (!got.ok) return got;
  const rec = {
    id: recommendation.id || randomUUID(),
    site_id: String(siteId),
    brain_id: got.brain.id,
    specialist: recommendation.specialist || 'atlas',
    title: recommendation.title || 'Recommendation',
    problem: recommendation.problem || '',
    evidence: recommendation.evidence || [],
    proposed_change: recommendation.proposedChange || recommendation.proposed_change || {},
    reason: recommendation.reason || '',
    estimated_effort: recommendation.estimatedEffort || recommendation.estimated_effort || 'unknown',
    affected_areas: recommendation.affectedAreas || recommendation.affected_areas || [],
    required_permissions: recommendation.requiredPermissions || recommendation.required_permissions || [],
    risk: recommendation.risk || 'low',
    status: recommendation.status || 'proposed',
    executable: !!recommendation.executable,
    capability_gap: !!recommendation.capabilityGap || !!recommendation.capability_gap,
    editor_context: recommendation.editorContext || recommendation.editor_context || {},
    guardian: recommendation.guardian || null,
    created_by: o.actorUserId || null,
    updated_by: o.actorUserId || null
  };
  const saved = await store.upsertRecommendation(rec);
  if (!saved.ok) return saved;

  // Mirror into snapshot list (best-effort summary)
  const snap = deepClone(got.brain.snapshot);
  const list = Array.isArray(snap.recommendations) ? snap.recommendations.slice() : [];
  list.unshift({
    id: rec.id,
    specialist: rec.specialist,
    title: rec.title,
    status: rec.status,
    executable: rec.executable,
    capabilityGap: rec.capability_gap,
    createdAt: saved.recommendation.created_at
  });
  snap.recommendations = list.slice(0, 50);
  await saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'record_recommendation',
    path: 'recommendations',
    afterValue: { id: rec.id },
    source: o.source || 'specialist_inference'
  });

  return { ok: true, recommendation: saved.recommendation, persisted: true, store: saved.store };
}

async function updateRecommendationStatus(siteId, recommendationId, status, opts) {
  const o = opts || {};
  const store = storage.adapter();
  const got = await store.getRecommendation(recommendationId);
  if (!got.ok) return got;
  if (got.recommendation.site_id !== String(siteId)) {
    return { ok: false, error: 'tenant_mismatch', persisted: false };
  }
  const updated = {
    ...got.recommendation,
    status,
    updated_by: o.actorUserId || null
  };
  const saved = await store.upsertRecommendation(updated);
  if (!saved.ok) return saved;
  await store.appendEvent({
    site_id: siteId,
    brain_id: got.recommendation.brain_id,
    event_type: status === 'approved' ? 'approve_recommendation' : 'reject_recommendation',
    path: 'recommendations.' + recommendationId,
    after_value: { status },
    source: o.source || 'user',
    actor_user_id: o.actorUserId || null,
    actor_role: o.actorRole || null
  });
  return { ok: true, recommendation: saved.recommendation, persisted: true };
}

async function approveRecommendation(siteId, recommendationId, opts) {
  return updateRecommendationStatus(siteId, recommendationId, 'approved', opts);
}

async function rejectRecommendation(siteId, recommendationId, opts) {
  return updateRecommendationStatus(siteId, recommendationId, 'rejected', opts);
}

async function recordDecision(siteId, decision, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const list = Array.isArray(snap.decisions) ? snap.decisions.slice() : [];
  list.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    ...decision,
    actorUserId: o.actorUserId || null
  });
  snap.decisions = list.slice(0, 100);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'record_decision',
    path: 'decisions',
    source: o.source || 'user'
  });
}

async function addEvidence(siteId, evidence, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const list = Array.isArray(snap.evidence) ? snap.evidence.slice() : [];
  list.unshift({ id: randomUUID(), at: new Date().toISOString(), ...evidence });
  snap.evidence = list.slice(0, 100);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'add_evidence',
    path: 'evidence',
    source: o.source || 'user'
  });
}

async function createTask(siteId, task, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const list = Array.isArray(snap.openTasks) ? snap.openTasks.slice() : [];
  const row = {
    id: randomUUID(),
    status: 'open',
    createdAt: new Date().toISOString(),
    ...task
  };
  list.unshift(row);
  snap.openTasks = list.slice(0, 50);
  const saved = await saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'create_task',
    path: 'openTasks',
    source: o.source || 'specialist_inference'
  });
  if (!saved.ok) return saved;
  return { ...saved, task: row };
}

async function completeTask(siteId, taskId, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const list = Array.isArray(snap.openTasks) ? snap.openTasks : [];
  const idx = list.findIndex((t) => t.id === taskId);
  if (idx < 0) return { ok: false, error: 'task_not_found', persisted: false };
  list[idx] = {
    ...list[idx],
    status: 'completed',
    completedAt: new Date().toISOString()
  };
  snap.openTasks = list.filter((t) => t.status !== 'completed').concat(list.filter((t) => t.status === 'completed')).slice(0, 50);
  // Keep completed out of openTasks
  snap.openTasks = list.filter((t) => t.status !== 'completed');
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'complete_task',
    path: 'openTasks',
    source: o.source || 'user'
  });
}

async function invalidateKnowledge(siteId, path, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  const snap = deepClone(got.brain.snapshot);
  const before = getPath(snap, path);
  if (!before || typeof before !== 'object') {
    return { ok: false, error: 'fact_not_found', persisted: false };
  }
  const after = {
    ...before,
    status: 'stale',
    updatedAt: new Date().toISOString(),
    updatedBy: o.actorUserId || null
  };
  setPath(snap, path, after);
  return saveSnapshot(siteId, snap, {
    ...o,
    expectedVersion: got.brain.version,
    eventType: 'invalidate_knowledge',
    path,
    beforeValue: before,
    afterValue: after,
    source: o.source || 'system'
  });
}

async function listHistory(siteId, limit) {
  return storage.adapter().listEvents(String(siteId), limit);
}

async function listRecommendations(siteId, opts) {
  return storage.adapter().listRecommendations(String(siteId), opts);
}

async function restoreVersion(siteId, targetVersion, opts) {
  const o = opts || {};
  const history = await listHistory(siteId, 200);
  if (!history.ok) return history;
  // Phase 1: restore is only supported when an event carries a full snapshot in meta
  const event = (history.events || []).find(
    (e) => e.version_after === targetVersion && e.meta && e.meta.fullSnapshot
  );
  if (!event) {
    return {
      ok: false,
      error: 'restore_snapshot_unavailable',
      message: 'No full snapshot available for that version in Phase 1 history.',
      persisted: false
    };
  }
  return saveSnapshot(siteId, event.meta.fullSnapshot, {
    ...o,
    eventType: 'restore_version',
    source: o.source || 'user',
    meta: { restoredFrom: targetVersion }
  });
}

async function setBootstrapStatus(siteId, status, opts) {
  const o = opts || {};
  const got = await getSiteBrain(siteId);
  if (!got.ok) return got;
  return saveSnapshot(siteId, got.brain.snapshot, {
    ...o,
    expectedVersion: got.brain.version,
    bootstrapStatus: status,
    eventType: 'bootstrap_status',
    source: o.source || 'user'
  });
}

module.exports = {
  createSiteBrain,
  getSiteBrain,
  saveSnapshot,
  proposeKnowledgeUpdate,
  approveKnowledgeUpdate,
  rejectKnowledgeUpdate,
  recordAgentObservation,
  recordRecommendation,
  approveRecommendation,
  rejectRecommendation,
  recordDecision,
  addEvidence,
  createTask,
  completeTask,
  invalidateKnowledge,
  restoreVersion,
  listHistory,
  listRecommendations,
  setBootstrapStatus
};
