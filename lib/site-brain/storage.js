'use strict';

/**
 * Site Brain storage adapters.
 *
 * Memory adapter: tests + explicit local only (SITE_BRAIN_STORAGE=memory).
 * Database adapter: default for preview/staging/production — fail closed if
 * tables are missing or Supabase is unavailable. No silent process-memory fallback.
 */

const { randomUUID } = require('crypto');

/** @type {Map<string, object>} */
const memBrains = new Map();
/** @type {Map<string, object[]>} */
const memEvents = new Map();
/** @type {Map<string, object>} */
const memRecs = new Map();

let adminClient = null;
let forceMemoryForTests = false;

function isTestEnv() {
  return process.env.NODE_ENV === 'test' || process.env.SITE_BRAIN_TEST === '1';
}

/**
 * Preview / staging / production (and Vercel preview) must never use process memory.
 * Local development may opt into memory via SITE_BRAIN_STORAGE=memory.
 */
function isDeployedEnv() {
  const vercel = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (vercel === 'production' || vercel === 'preview') return true;
  const brainEnv = String(process.env.SITE_BRAIN_ENV || '').trim().toLowerCase();
  if (brainEnv === 'production' || brainEnv === 'preview' || brainEnv === 'staging') {
    return true;
  }
  if (process.env.NODE_ENV === 'production' && !isTestEnv()) return true;
  return false;
}

/**
 * Resolve storage mode.
 * - memory: test harness force, NODE_ENV=test / SITE_BRAIN_TEST=1 (unless forced database),
 *   or SITE_BRAIN_STORAGE=memory on non-deployed local only
 * - database: default for preview/staging/production; also when SITE_BRAIN_STORAGE=database
 *
 * Deployed environments never fall back to process memory — even if SITE_BRAIN_STORAGE=memory.
 */
function resolveStorageMode() {
  if (forceMemoryForTests) return 'memory';
  const explicit = String(process.env.SITE_BRAIN_STORAGE || '')
    .trim()
    .toLowerCase();
  if (explicit === 'database') return 'database';
  if (isDeployedEnv()) return 'database';
  if (explicit === 'memory') return 'memory';
  if (isTestEnv()) return 'memory';
  return 'database';
}

function useMemoryForTests(on) {
  forceMemoryForTests = !!on;
}

function setAdminClientForTests(client) {
  adminClient = client || null;
}

function getAdmin() {
  if (adminClient) return adminClient;
  const { admin } = require('../brain/http');
  adminClient = admin;
  return adminClient;
}

function nowIso() {
  return new Date().toISOString();
}

function storageUnavailable(detail) {
  return {
    ok: false,
    error: 'site_brain_storage_unavailable',
    message:
      'Site Brain database storage is unavailable. Apply db/site_brain.sql and ensure SUPABASE service role is configured.',
    detail: detail || null,
    persisted: false
  };
}

function isMissingTableError(err) {
  if (!err) return false;
  const msg = String(err.message || err.code || err);
  return (
    /relation .*site_brain/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    err.code === '42P01' ||
    err.code === 'PGRST205'
  );
}

function resetMemoryStore() {
  memBrains.clear();
  memEvents.clear();
  memRecs.clear();
}

// --- Memory adapter ---

async function memUpsertBrain(row) {
  const siteId = String(row.site_id);
  const existing = memBrains.get(siteId);
  if (existing && row.expectedVersion != null && existing.version !== row.expectedVersion) {
    return {
      ok: false,
      error: 'version_conflict',
      message: 'Site Brain version conflict',
      currentVersion: existing.version,
      persisted: false
    };
  }
  const version = existing ? existing.version + 1 : 1;
  const brain = {
    id: (existing && existing.id) || row.id || randomUUID(),
    site_id: siteId,
    account_id: row.account_id != null ? row.account_id : (existing && existing.account_id) || null,
    version,
    snapshot: row.snapshot,
    bootstrap_status: row.bootstrap_status || (existing && existing.bootstrap_status) || 'pending',
    created_at: (existing && existing.created_at) || nowIso(),
    updated_at: nowIso(),
    created_by: (existing && existing.created_by) || row.actor_user_id || null,
    updated_by: row.actor_user_id || null
  };
  memBrains.set(siteId, brain);
  return { ok: true, brain, store: 'memory', persisted: true };
}

async function memGetBrain(siteId) {
  const brain = memBrains.get(String(siteId));
  if (!brain) return { ok: false, error: 'not_found', persisted: true };
  return { ok: true, brain, store: 'memory', persisted: true };
}

async function memAppendEvent(ev) {
  const siteId = String(ev.site_id);
  const list = memEvents.get(siteId) || [];
  const row = {
    id: randomUUID(),
    ...ev,
    created_at: nowIso()
  };
  list.push(row);
  memEvents.set(siteId, list);
  return { ok: true, event: row, store: 'memory', persisted: true };
}

async function memListEvents(siteId, limit) {
  const list = (memEvents.get(String(siteId)) || []).slice().reverse();
  return { ok: true, events: list.slice(0, limit || 50), store: 'memory', persisted: true };
}

async function memUpsertRecommendation(rec) {
  const id = rec.id || randomUUID();
  const row = {
    ...rec,
    id,
    created_at: rec.created_at || nowIso(),
    updated_at: nowIso()
  };
  memRecs.set(id, row);
  return { ok: true, recommendation: row, store: 'memory', persisted: true };
}

async function memListRecommendations(siteId, opts) {
  const all = [...memRecs.values()].filter((r) => r.site_id === String(siteId));
  all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  let out = all;
  if (opts && opts.status) out = out.filter((r) => r.status === opts.status);
  return {
    ok: true,
    recommendations: out.slice(0, (opts && opts.limit) || 50),
    store: 'memory',
    persisted: true
  };
}

async function memGetRecommendation(id) {
  const row = memRecs.get(String(id));
  if (!row) return { ok: false, error: 'not_found', persisted: true };
  return { ok: true, recommendation: row, store: 'memory', persisted: true };
}

// --- Database adapter ---

async function dbUpsertBrain(row) {
  const admin = getAdmin();
  const siteId = String(row.site_id);
  const { data: existing, error: getErr } = await admin
    .from('site_brains')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();
  if (getErr) {
    if (isMissingTableError(getErr)) return storageUnavailable(getErr.message);
    return { ok: false, error: 'db_error', message: getErr.message, persisted: false };
  }
  if (existing && row.expectedVersion != null && existing.version !== row.expectedVersion) {
    return {
      ok: false,
      error: 'version_conflict',
      message: 'Site Brain version conflict',
      currentVersion: existing.version,
      persisted: false
    };
  }
  const version = existing ? existing.version + 1 : 1;
  const payload = {
    site_id: siteId,
    account_id: row.account_id != null ? row.account_id : (existing && existing.account_id) || null,
    version,
    snapshot: row.snapshot,
    bootstrap_status: row.bootstrap_status || (existing && existing.bootstrap_status) || 'pending',
    updated_at: nowIso(),
    updated_by: row.actor_user_id || null
  };
  if (!existing) {
    payload.created_by = row.actor_user_id || null;
    payload.created_at = nowIso();
  }
  const q = existing
    ? admin.from('site_brains').update(payload).eq('site_id', siteId).eq('version', existing.version)
    : admin.from('site_brains').insert(payload);
  const { data, error } = await q.select('*').maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  if (!data) {
    return {
      ok: false,
      error: 'version_conflict',
      message: 'Site Brain version conflict',
      persisted: false
    };
  }
  return { ok: true, brain: data, store: 'database', persisted: true };
}

async function dbGetBrain(siteId) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('site_brains')
    .select('*')
    .eq('site_id', String(siteId))
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  if (!data) return { ok: false, error: 'not_found', persisted: true };
  return { ok: true, brain: data, store: 'database', persisted: true };
}

async function dbAppendEvent(ev) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('site_brain_events')
    .insert({
      site_id: ev.site_id,
      brain_id: ev.brain_id || null,
      version_before: ev.version_before != null ? ev.version_before : null,
      version_after: ev.version_after != null ? ev.version_after : null,
      event_type: ev.event_type,
      path: ev.path || null,
      before_value: ev.before_value != null ? ev.before_value : null,
      after_value: ev.after_value != null ? ev.after_value : null,
      source: ev.source || null,
      actor_user_id: ev.actor_user_id || null,
      actor_role: ev.actor_role || null,
      request_id: ev.request_id || null,
      meta: ev.meta || {}
    })
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  return { ok: true, event: data, store: 'database', persisted: true };
}

async function dbListEvents(siteId, limit) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('site_brain_events')
    .select('*')
    .eq('site_id', String(siteId))
    .order('created_at', { ascending: false })
    .limit(limit || 50);
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  return { ok: true, events: data || [], store: 'database', persisted: true };
}

async function dbUpsertRecommendation(rec) {
  const admin = getAdmin();
  const id = rec.id || randomUUID();
  const payload = {
    id,
    site_id: rec.site_id,
    brain_id: rec.brain_id || null,
    specialist: rec.specialist,
    title: rec.title,
    problem: rec.problem || null,
    evidence: rec.evidence || [],
    proposed_change: rec.proposed_change || {},
    reason: rec.reason || null,
    estimated_effort: rec.estimated_effort || null,
    affected_areas: rec.affected_areas || [],
    required_permissions: rec.required_permissions || [],
    risk: rec.risk || null,
    status: rec.status || 'proposed',
    executable: !!rec.executable,
    capability_gap: !!rec.capability_gap,
    editor_context: rec.editor_context || {},
    guardian: rec.guardian || null,
    updated_by: rec.updated_by || null,
    updated_at: nowIso()
  };
  if (!rec.id) {
    payload.created_by = rec.created_by || null;
    payload.created_at = nowIso();
  }
  const { data, error } = await admin
    .from('site_brain_recommendations')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  return { ok: true, recommendation: data, store: 'database', persisted: true };
}

async function dbListRecommendations(siteId, opts) {
  const admin = getAdmin();
  let q = admin
    .from('site_brain_recommendations')
    .select('*')
    .eq('site_id', String(siteId))
    .order('created_at', { ascending: false })
    .limit((opts && opts.limit) || 50);
  if (opts && opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  return { ok: true, recommendations: data || [], store: 'database', persisted: true };
}

async function dbGetRecommendation(id) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('site_brain_recommendations')
    .select('*')
    .eq('id', String(id))
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return storageUnavailable(error.message);
    return { ok: false, error: 'db_error', message: error.message, persisted: false };
  }
  if (!data) return { ok: false, error: 'not_found', persisted: true };
  return { ok: true, recommendation: data, store: 'database', persisted: true };
}

function adapter() {
  const mode = resolveStorageMode();
  if (mode === 'memory') {
    return {
      mode: 'memory',
      upsertBrain: memUpsertBrain,
      getBrain: memGetBrain,
      appendEvent: memAppendEvent,
      listEvents: memListEvents,
      upsertRecommendation: memUpsertRecommendation,
      listRecommendations: memListRecommendations,
      getRecommendation: memGetRecommendation
    };
  }
  return {
    mode: 'database',
    upsertBrain: dbUpsertBrain,
    getBrain: dbGetBrain,
    appendEvent: dbAppendEvent,
    listEvents: dbListEvents,
    upsertRecommendation: dbUpsertRecommendation,
    listRecommendations: dbListRecommendations,
    getRecommendation: dbGetRecommendation
  };
}

module.exports = {
  resolveStorageMode,
  useMemoryForTests,
  setAdminClientForTests,
  resetMemoryStore,
  adapter,
  storageUnavailable,
  isMissingTableError
};
