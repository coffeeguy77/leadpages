'use strict';

/**
 * Guardian — validates recommendations and (later) draft executions.
 * Phase 1: structure + safety invariants; no live mutation allowed.
 */

const { getCapability, isExecutableCapability } = require('./capability-registry');

const PROTECTED_PATH_PATTERNS = [
  /form.*recipient/i,
  /leadRouting/i,
  /tracking/i,
  /gtm/i,
  /fbq/i,
  /domain/i,
  /billing/i,
  /permissions/i,
  /auth/i,
  /webhook/i
];

function validateRecommendation(rec, opts) {
  const o = opts || {};
  const critical = [];
  const warnings = [];
  const r = rec || {};

  if (!r.title || !String(r.title).trim()) {
    critical.push({ code: 'title_required', message: 'Recommendation title is required' });
  }
  if (!r.specialist) {
    critical.push({ code: 'specialist_required', message: 'Specialist id is required' });
  }
  if (r.publish === true || (r.proposedChange && r.proposedChange.publish === true)) {
    critical.push({ code: 'publish_forbidden', message: 'AI Team cannot publish' });
  }
  if (r.applyLive === true || (r.proposedChange && r.proposedChange.applyLive === true)) {
    critical.push({ code: 'live_mutation_forbidden', message: 'Live site mutation is forbidden' });
  }

  const change = r.proposedChange || r.proposed_change || {};
  const paths = []
    .concat(change.paths || [])
    .concat(change.configPaths || [])
    .concat(Array.isArray(r.affectedAreas) ? r.affectedAreas : r.affected_areas || []);

  for (const p of paths) {
    const s = String(p);
    if (PROTECTED_PATH_PATTERNS.some((re) => re.test(s))) {
      critical.push({
        code: 'protected_path',
        message: 'Protected path cannot be changed via AI Team: ' + s
      });
    }
  }

  if (r.executable === true) {
    const target = change.capabilityId || change.sectionKey || change.appId;
    if (!target || !isExecutableCapability(target)) {
      critical.push({
        code: 'not_executable_phase1',
        message:
          'Phase 1 is advisory only — executable flag must be false until Phase 2 tools ship'
      });
    }
  }

  if (change.sectionKey || change.capabilityId) {
    const cap = getCapability(change.sectionKey || change.capabilityId);
    if (!cap && !r.capabilityGap && !r.capability_gap) {
      warnings.push({
        code: 'unknown_capability',
        message:
          'Target capability is not on the real Marketplace allowlist — mark as capability_gap'
      });
    }
  }

  if (o.requireTenantSiteId && r.siteId && r.siteId !== o.requireTenantSiteId) {
    critical.push({ code: 'tenant_mismatch', message: 'Recommendation siteId mismatch' });
  }

  return {
    ok: critical.length === 0,
    critical,
    warnings
  };
}

function attachGuardian(rec) {
  const forced = { ...rec, executable: false };
  const result = validateRecommendation(forced);
  return {
    ...forced,
    guardian: result
  };
}

module.exports = {
  validateRecommendation,
  attachGuardian,
  PROTECTED_PATH_PATTERNS
};
