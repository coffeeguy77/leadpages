'use strict';

/**
 * AI Website Team permission matrix — server-side enforcement.
 */

function canViewSiteBrain(role) {
  return role === 'super' || role === 'partner' || role === 'client';
}

function canMutateSiteBrain(role) {
  return role === 'super' || role === 'partner' || role === 'client';
}

function canViewDiagnostics(role) {
  return role === 'super';
}

function canApproveRecommendation(role) {
  // Phase 1: approve/reject recommendation status only (no execution)
  return role === 'super' || role === 'partner' || role === 'client';
}

function canRunAtlas(role) {
  return role === 'super' || role === 'partner' || role === 'client';
}

function canRunForge(role) {
  return role === 'super' || role === 'partner' || role === 'client';
}

function assertAction(role, action) {
  const map = {
    view_brain: canViewSiteBrain,
    mutate_brain: canMutateSiteBrain,
    diagnostics: canViewDiagnostics,
    approve_recommendation: canApproveRecommendation,
    atlas_review: canRunAtlas,
    forge_apply: canRunForge
  };
  const fn = map[action];
  if (!fn) return { ok: false, error: 'unknown_action' };
  if (!fn(role)) return { ok: false, error: 'forbidden', action, role };
  return { ok: true };
}

module.exports = {
  canViewSiteBrain,
  canMutateSiteBrain,
  canViewDiagnostics,
  canApproveRecommendation,
  canRunAtlas,
  canRunForge,
  assertAction
};
