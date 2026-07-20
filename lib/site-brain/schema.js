'use strict';

/**
 * Site Brain schema v1.0 — validated structure + provenance helpers.
 * Separate from sites.config (renderer).
 */

const SCHEMA_VERSION = '1.0';

const FACT_STATUSES = Object.freeze([
  'verified',
  'inferred',
  'proposed',
  'stale',
  'rejected',
  'needs-confirmation'
]);

const FACT_SOURCES = Object.freeze([
  'user',
  'partner',
  'superuser',
  'site_config',
  'imported',
  'crm',
  'analytics',
  'search_console',
  'google_ads',
  'specialist_inference',
  'manual_editor'
]);

const AGENT_KEYS = Object.freeze([
  'atlas',
  'nova',
  'scout',
  'pulse',
  'forge',
  'lens',
  'echo',
  'guardian',
  'beacon'
]);

const PROTECTED_PATHS = Object.freeze([
  'siteId',
  'accountId',
  'schemaVersion'
]);

function emptyAgentMemory() {
  const out = {};
  for (const k of AGENT_KEYS) out[k] = {};
  return out;
}

function makeFact(value, opts) {
  const o = opts || {};
  const now = new Date().toISOString();
  const status = FACT_STATUSES.includes(o.status) ? o.status : 'needs-confirmation';
  const source = FACT_SOURCES.includes(o.source) ? o.source : 'imported';
  return {
    value: value == null ? null : value,
    source,
    sourceId: o.sourceId || null,
    confidence: typeof o.confidence === 'number' ? o.confidence : status === 'verified' ? 1 : 0.5,
    status,
    createdAt: o.createdAt || now,
    updatedAt: o.updatedAt || now,
    createdBy: o.createdBy || null,
    updatedBy: o.updatedBy || null
  };
}

function emptySnapshot(siteId, accountId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    siteId: String(siteId || ''),
    accountId: accountId == null ? null : String(accountId),
    business: {},
    brand: {},
    audience: {},
    offers: {},
    goals: {},
    locations: {},
    seo: {},
    conversion: {},
    content: {},
    imagery: {},
    marketplace: {},
    websiteState: {},
    campaigns: {},
    constraints: [],
    verifiedFacts: [],
    agentMemory: emptyAgentMemory(),
    recommendations: [],
    openTasks: [],
    /** Forge-owned Execution Plans (Recommendation → Plan → Preview → Apply) */
    executionPlans: [],
    /** Pre-apply sites.config snapshots for rollback (one per Apply batch) */
    configRollbackSnapshots: [],
    decisions: [],
    evidence: [],
    history: []
  };
}

/**
 * Shallow structural validation — returns { ok, errors[] }.
 */
function validateSnapshot(snap) {
  const errors = [];
  if (!snap || typeof snap !== 'object') {
    return { ok: false, errors: [{ code: 'snapshot_missing', message: 'Snapshot required' }] };
  }
  if (snap.schemaVersion !== SCHEMA_VERSION) {
    errors.push({
      code: 'schema_version',
      message: 'Expected schemaVersion ' + SCHEMA_VERSION
    });
  }
  if (!snap.siteId) {
    errors.push({ code: 'site_id_required', message: 'siteId is required' });
  }
  if (!snap.agentMemory || typeof snap.agentMemory !== 'object') {
    errors.push({ code: 'agent_memory', message: 'agentMemory object required' });
  } else {
    for (const k of AGENT_KEYS) {
      if (snap.agentMemory[k] == null) snap.agentMemory[k] = {};
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Promote a fact only via explicit approval — never silently inferred→verified.
 */
function approveFact(fact, actorId) {
  if (!fact || typeof fact !== 'object') return null;
  const now = new Date().toISOString();
  return {
    ...fact,
    status: 'verified',
    confidence: 1,
    updatedAt: now,
    updatedBy: actorId || fact.updatedBy || null
  };
}

function isProtectedPath(path) {
  const p = String(path || '').split('.')[0];
  return PROTECTED_PATHS.includes(p);
}

module.exports = {
  SCHEMA_VERSION,
  FACT_STATUSES,
  FACT_SOURCES,
  AGENT_KEYS,
  PROTECTED_PATHS,
  makeFact,
  emptySnapshot,
  emptyAgentMemory,
  validateSnapshot,
  approveFact,
  isProtectedPath
};
