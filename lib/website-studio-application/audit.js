'use strict';

const { randomUUID } = require('crypto');

/** @type {Map<string, object>} */
const memAudit = new Map();
/** @type {Map<string, object>} */
const memIdempotency = new Map();

function nowIso() {
  return new Date().toISOString();
}

function recordApplicationAudit(entry) {
  const id = entry.id || randomUUID();
  const row = {
    id,
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
    imagesImported: entry.imagesImported || [],
    resultType: entry.resultType || null,
    success: !!entry.success,
    failureStage: entry.failureStage || null,
    resultingDraftVersionId: entry.resultingDraftVersionId || null,
    resultingSiteId: entry.resultingSiteId || null,
    resultingTemplateId: entry.resultingTemplateId || null,
    idempotencyKey: entry.idempotencyKey || null,
    notice: entry.notice || null
  };
  memAudit.set(id, row);
  return { ok: true, audit: row };
}

function listApplicationAudits(limit) {
  const rows = [...memAudit.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return rows.slice(0, limit || 100);
}

function getIdempotentResult(key) {
  if (!key) return null;
  return memIdempotency.get(String(key)) || null;
}

function setIdempotentResult(key, result) {
  if (!key) return;
  memIdempotency.set(String(key), {
    storedAt: nowIso(),
    result
  });
}

function resetApplicationMemory() {
  memAudit.clear();
  memIdempotency.clear();
}

module.exports = {
  recordApplicationAudit,
  listApplicationAudits,
  getIdempotentResult,
  setIdempotentResult,
  resetApplicationMemory
};
