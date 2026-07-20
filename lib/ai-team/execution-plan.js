'use strict';

/**
 * Execution Plan — Forge-owned object between Recommendation and Apply.
 *
 * Pipeline:
 *   Recommendation(s) → Execution Plan (Forge) → Guardian → Preview → Apply → Editor → User Publish
 *
 * Atlas / other specialists never write sites.config. Only Forge does.
 */

const { randomUUID } = require('crypto');

const PLAN_STATUSES = Object.freeze([
  'draft',
  'guardian_validated',
  'preview_ready',
  'applied',
  'cancelled',
  'rolled_back',
  'failed'
]);

/**
 * Outcome keys Atlas may propose. Forge maps these to config steps.
 * Atlas must not emit config paths, section ids, or renderer details.
 */
const BUSINESS_OUTCOMES = Object.freeze({
  strengthen_primary_cta: {
    label: 'Strengthen primary call to action',
    forgeOps: ['hero_cta', 'sticky_cta', 'footer_cta']
  },
  enable_faq_for_objections: {
    label: 'Answer common objections with FAQ',
    forgeOps: ['enable_faq']
  },
  confirm_business_goal: {
    label: 'Confirm primary business goal',
    forgeOps: [],
    knowledgeOnly: true,
    fieldKey: 'primaryGoal'
  },
  clarify_preferred_cta: {
    label: 'Clarify preferred call to action',
    forgeOps: [],
    knowledgeOnly: true,
    fieldKey: 'preferredCta'
  },
  expand_main_services: {
    label: 'Expand main services list',
    forgeOps: [],
    knowledgeOnly: true,
    fieldKey: 'mainServices'
  },
  plan_seo_landing: {
    label: 'Plan SEO / landing page',
    forgeOps: ['checklist'],
    knowledgeOnly: false
  }
});

function emptyPlan(partial) {
  const p = partial || {};
  return {
    id: p.id || randomUUID(),
    recommendationIds: Array.isArray(p.recommendationIds) ? p.recommendationIds.slice() : [],
    generatedBy: p.generatedBy || 'forge',
    siteId: p.siteId ? String(p.siteId) : null,
    status: p.status || 'draft',
    affectedPages: Array.isArray(p.affectedPages) ? p.affectedPages.slice() : ['Home'],
    steps: Array.isArray(p.steps) ? p.steps.slice() : [],
    configPaths: Array.isArray(p.configPaths) ? p.configPaths.slice() : [],
    risk: p.risk || 'low',
    validationRequirements: Array.isArray(p.validationRequirements)
      ? p.validationRequirements.slice()
      : [],
    rollbackStrategy: p.rollbackStrategy || {
      type: 'config_snapshot',
      snapshotId: null,
      note: 'Restore sites.config from snapshot captured before Apply'
    },
    dependencies: Array.isArray(p.dependencies) ? p.dependencies.slice() : [],
    guardian: p.guardian || null,
    preview: p.preview || null,
    editorContext: p.editorContext || {},
    title: p.title || 'Execution Plan',
    summary: p.summary || '',
    estimatedTime: p.estimatedTime || 'Instant',
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
    appliedAt: p.appliedAt || null,
    rolledBackAt: p.rolledBackAt || null,
    rollbackSnapshotId: p.rollbackSnapshotId || null
  };
}

function makeStep(partial) {
  const s = partial || {};
  return {
    id: s.id || randomUUID(),
    title: s.title || 'Step',
    label: s.label || s.title || 'Change',
    operation: s.operation || null,
    recommendationId: s.recommendationId || null,
    outcome: s.outcome || null,
    configPaths: Array.isArray(s.configPaths) ? s.configPaths.slice() : [],
    before: s.before != null ? s.before : null,
    after: s.after != null ? s.after : null,
    risk: s.risk || 'low',
    validationRequirements: Array.isArray(s.validationRequirements)
      ? s.validationRequirements.slice()
      : [],
    affectedPages: Array.isArray(s.affectedPages) ? s.affectedPages.slice() : ['Home']
  };
}

/**
 * Build the Change Preview payload shown before Apply.
 */
function buildChangePreview(plan) {
  const p = plan || emptyPlan();
  const changes = (p.steps || [])
    .filter(function (s) {
      return s && s.operation;
    })
    .map(function (s) {
      return {
        id: s.id,
        label: s.label || s.title,
        operation: s.operation,
        before: formatPreviewValue(s.before),
        after: formatPreviewValue(s.after),
        configPaths: s.configPaths || [],
        risk: s.risk || 'low'
      };
    });
  return {
    title: 'Changes Ready',
    planId: p.id,
    changes: changes,
    affectedPages: p.affectedPages || ['Home'],
    risk: p.risk || 'low',
    estimatedTime: p.estimatedTime || 'Instant',
    rollbackNote: 'One rollback point covers this whole batch.',
    publishNote: 'AI never publishes. Review in the editor, then Publish Live Site yourself.'
  };
}

function formatPreviewValue(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Enabled' : 'Disabled';
  if (typeof v === 'object') {
    if (Object.prototype.hasOwnProperty.call(v, 'cta')) return String(v.cta);
    if (Object.prototype.hasOwnProperty.call(v, 'on')) return v.on ? 'Enabled' : 'Disabled';
    try {
      return JSON.stringify(v);
    } catch (_e) {
      return String(v);
    }
  }
  return String(v);
}

function collectConfigPaths(plan) {
  const paths = [];
  (plan.steps || []).forEach(function (s) {
    (s.configPaths || []).forEach(function (p) {
      if (paths.indexOf(p) < 0) paths.push(p);
    });
  });
  return paths;
}

function highestRisk(steps) {
  const order = { low: 0, medium: 1, high: 2 };
  let best = 'low';
  (steps || []).forEach(function (s) {
    const r = (s && s.risk) || 'low';
    if ((order[r] || 0) > (order[best] || 0)) best = r;
  });
  return best;
}

module.exports = {
  PLAN_STATUSES,
  BUSINESS_OUTCOMES,
  emptyPlan,
  makeStep,
  buildChangePreview,
  formatPreviewValue,
  collectConfigPaths,
  highestRisk
};
