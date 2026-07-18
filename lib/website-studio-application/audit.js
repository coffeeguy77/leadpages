'use strict';

/**
 * Application audit + idempotency.
 * Phase 6: persists to Supabase (website_studio_application_* tables).
 * Memory + durable-memory fallback for tests / missing tables.
 */

const { randomUUID } = require('crypto');
const { memoryEnabled } = require('../theme-studio/store');

/** Process-local cache (cleared on simulateProcessRestart). */
const memAudit = new Map();
const memIdempotency = new Map();

/**
 * Durable in-process store simulating DB across "restarts" in tests.
 * Cleared only by resetApplicationMemory({ durable: true }).
 */
const durableAudit = new Map();
const durableIdempotency = new Map();

let adminClient = null;

function nowIso() {
  return new Date().toISOString();
}

function getAdmin() {
  if (adminClient) return adminClient;
  const { admin } = require('../brain/http');
  adminClient = admin;
  return adminClient;
}

function makeDiagnosticId() {
  return 'wsapp_' + randomUUID().replace(/-/g, '').slice(0, 16);
}

function toDbAudit(row) {
  return {
    id: row.id,
    diagnostic_id: row.diagnosticId,
    actor_user_id: row.actorUserId,
    role: row.role,
    created_at: row.timestamp,
    source_concept_id: row.sourceConceptId,
    source_version_id: row.sourceVersionId,
    source_draft_id: row.sourceDraftId,
    destination_account_id: row.destinationAccountId,
    destination_site_id: row.destinationSiteId,
    application_mode: row.applicationMode,
    validation_result: row.validationResult,
    warnings_acknowledged: row.warningsAcknowledged,
    override_reason: row.overrideReason,
    apps_installed: row.appsInstalled,
    images_imported: row.imagesImported,
    result_type: row.resultType,
    success: row.success,
    failure_stage: row.failureStage,
    resulting_draft_version_id: row.resultingDraftVersionId,
    resulting_site_id: row.resultingSiteId,
    resulting_template_id: row.resultingTemplateId,
    idempotency_key: row.idempotencyKey,
    notice: row.notice,
    meta: row.meta || {}
  };
}

function fromDbAudit(data) {
  if (!data) return null;
  return {
    id: data.id,
    diagnosticId: data.diagnostic_id,
    actorUserId: data.actor_user_id,
    role: data.role,
    timestamp: data.created_at,
    sourceConceptId: data.source_concept_id,
    sourceVersionId: data.source_version_id,
    sourceDraftId: data.source_draft_id,
    destinationAccountId: data.destination_account_id,
    destinationSiteId: data.destination_site_id,
    applicationMode: data.application_mode,
    validationResult: data.validation_result,
    warningsAcknowledged: !!data.warnings_acknowledged,
    overrideReason: data.override_reason,
    appsInstalled: data.apps_installed || [],
    imagesImported: data.images_imported || [],
    resultType: data.result_type,
    success: !!data.success,
    failureStage: data.failure_stage,
    resultingDraftVersionId: data.resulting_draft_version_id,
    resultingSiteId: data.resulting_site_id,
    resultingTemplateId: data.resulting_template_id,
    idempotencyKey: data.idempotency_key,
    notice: data.notice,
    meta: data.meta || {},
    store: 'supabase'
  };
}

function isMissingTable(error) {
  const msg = String((error && error.message) || error || '');
  const code = error && error.code;
  return code === '42P01' || /does not exist|Could not find the table|schema cache/i.test(msg);
}

async function recordApplicationAudit(entry) {
  const id = entry.id || randomUUID();
  const row = {
    id,
    diagnosticId: entry.diagnosticId || makeDiagnosticId(),
    actorUserId: entry.actorUserId || null,
    role: entry.role || null,
    timestamp: entry.timestamp || nowIso(),
    sourceConceptId: entry.sourceConceptId || null,
    sourceVersionId: entry.sourceVersionId || null,
    sourceDraftId: entry.sourceDraftId || null,
    destinationAccountId: entry.destinationAccountId || null,
    destinationSiteId: entry.destinationSiteId || null,
    applicationMode: entry.applicationMode || null,
    validationResult: entry.validationResult || null,
    warningsAcknowledged: !!entry.warningsAcknowledged,
    overrideReason: entry.overrideReason || null,
    appsInstalled: entry.appsInstalled || [],
    imagesImported: sanitizeImagesImported(entry.imagesImported || []),
    resultType: entry.resultType || null,
    success: !!entry.success,
    failureStage: entry.failureStage || null,
    resultingDraftVersionId: entry.resultingDraftVersionId || null,
    resultingSiteId: entry.resultingSiteId || null,
    resultingTemplateId: entry.resultingTemplateId || null,
    idempotencyKey: entry.idempotencyKey || null,
    notice: entry.notice || null,
    meta: entry.meta || {}
  };

  memAudit.set(id, row);
  durableAudit.set(id, row);

  if (memoryEnabled()) {
    return { ok: true, audit: row, store: 'memory' };
  }

  try {
    const { data, error } = await getAdmin()
      .from('website_studio_application_audits')
      .insert(toDbAudit(row))
      .select('*')
      .single();
    if (error) {
      if (isMissingTable(error)) {
        return { ok: true, audit: row, store: 'durable-memory', notice: error.message };
      }
      return { ok: false, error: error.message || 'audit_insert_failed', audit: row };
    }
    return { ok: true, audit: fromDbAudit(data), store: 'supabase' };
  } catch (err) {
    return {
      ok: true,
      audit: row,
      store: 'durable-memory',
      notice: err && err.message ? err.message : 'audit_fallback'
    };
  }
}

function sanitizeImagesImported(list) {
  return (Array.isArray(list) ? list : []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    delete copy.apiSecret;
    delete copy.apiKey;
    delete copy.signature;
    delete copy.authorization;
    if (copy.plan && typeof copy.plan === 'object') {
      copy.plan = {
        publicId: copy.plan.publicId,
        assetFolder: copy.plan.assetFolder,
        sourceProvider: copy.plan.sourceProvider,
        importStatus: copy.plan.importStatus,
        photographerName: copy.plan.photographerName
      };
    }
    return copy;
  });
}

async function listApplicationAudits(limit) {
  const lim = limit || 100;
  if (memoryEnabled()) {
    return [...durableAudit.values()]
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, lim);
  }
  try {
    const { data, error } = await getAdmin()
      .from('website_studio_application_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (error) {
      if (isMissingTable(error)) {
        return [...durableAudit.values()]
          .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
          .slice(0, lim);
      }
      return [];
    }
    return (data || []).map(fromDbAudit);
  } catch {
    return [...durableAudit.values()]
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, lim);
  }
}

async function getIdempotentResult(key) {
  if (!key) return null;
  const k = String(key);
  if (memIdempotency.has(k)) return memIdempotency.get(k);
  if (durableIdempotency.has(k)) return durableIdempotency.get(k);

  if (memoryEnabled()) return null;

  try {
    const { data, error } = await getAdmin()
      .from('website_studio_application_idempotency')
      .select('*')
      .eq('idempotency_key', k)
      .maybeSingle();
    if (error || !data) {
      if (error && isMissingTable(error) && durableIdempotency.has(k)) {
        return durableIdempotency.get(k);
      }
      return null;
    }
    const packed = { storedAt: data.created_at, result: data.result, store: 'supabase' };
    memIdempotency.set(k, packed);
    durableIdempotency.set(k, packed);
    return packed;
  } catch {
    return durableIdempotency.get(k) || null;
  }
}

async function setIdempotentResult(key, result, opts) {
  if (!key) return;
  const k = String(key);
  const packed = {
    storedAt: nowIso(),
    result,
    actorUserId: (opts && opts.actorUserId) || (result && result.audit && result.audit.actorUserId) || null
  };
  memIdempotency.set(k, packed);
  durableIdempotency.set(k, packed);

  if (memoryEnabled()) return { ok: true, store: 'memory' };

  try {
    const { error } = await getAdmin().from('website_studio_application_idempotency').upsert(
      {
        idempotency_key: k,
        actor_user_id: packed.actorUserId,
        result,
        updated_at: nowIso()
      },
      { onConflict: 'idempotency_key' }
    );
    if (error) {
      if (isMissingTable(error)) return { ok: true, store: 'durable-memory' };
      return { ok: false, error: error.message };
    }
    return { ok: true, store: 'supabase' };
  } catch (err) {
    return { ok: true, store: 'durable-memory', notice: err && err.message };
  }
}

/** Clear process-local cache only — durable/DB remain (simulates serverless cold start). */
function simulateProcessRestart() {
  memAudit.clear();
  memIdempotency.clear();
}

function resetApplicationMemory(opts) {
  memAudit.clear();
  memIdempotency.clear();
  if (opts && opts.durable) {
    durableAudit.clear();
    durableIdempotency.clear();
  }
}

module.exports = {
  recordApplicationAudit,
  listApplicationAudits,
  getIdempotentResult,
  setIdempotentResult,
  resetApplicationMemory,
  simulateProcessRestart,
  makeDiagnosticId
};
