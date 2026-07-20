'use strict';

/**
 * Atlas — Website Strategist (Phase 1 advisory).
 * Analyses Site Brain + editor context; returns structured recommendations.
 * Never mutates sites.config.
 */

const { randomUUID } = require('crypto');
const { getRelevantContext, factValue } = require('./context');
const { attachGuardian } = require('./guardian');
const { isSupportedForRecommendation } = require('./capability-registry');
const { getField } = require('./site-knowledge-fields');
const siteBrain = require('../site-brain');

function knowledgeRec(title, problem, fieldKey, reason) {
  const field = getField(fieldKey);
  return attachGuardian({
    id: randomUUID(),
    specialist: 'atlas',
    title,
    problem,
    evidence: ['Site Brain field missing or needs confirmation: ' + fieldKey],
    proposedChange: {
      type: 'site_brain_update',
      fieldKey,
      path: field ? field.brainPath : fieldKey,
      note: 'Answer in Atlas guided chat or Site Knowledge — saves to Site Brain only'
    },
    reason,
    estimatedEffort: 'small',
    affectedAreas: ['Site Brain'],
    requiredPermissions: ['mutate_brain'],
    risk: 'low',
    status: 'proposed',
    executable: false,
    capabilityGap: false,
    interactive: 'site_knowledge_chat'
  });
}

function buildDeterministicRecommendations(ctx, requestText) {
  const recs = [];
  const services = factValue(ctx.offers && ctx.offers.mainServices) || [];
  const goal = factValue(ctx.goals && ctx.goals.primary) || '';
  const cta = factValue(ctx.goals && ctx.goals.preferredCta) || '';
  const sections = factValue(ctx.marketplace && ctx.marketplace.activeSections) || [];
  const q = String(requestText || '').toLowerCase();

  if (!goal) {
    recs.push(
      knowledgeRec(
        'Confirm the primary business goal',
        'Site Brain does not yet have a verified primary goal.',
        'primaryGoal',
        'Specialists need a clear outcome to prioritise improvements. Atlas can ask you this in plain English and save the answer.'
      )
    );
  }

  if (!sections.includes('faq') && isSupportedForRecommendation('faq')) {
    recs.push(
      attachGuardian({
        id: randomUUID(),
        specialist: 'atlas',
        title: 'Add an FAQ section for common objections',
        problem: 'FAQ is not active on the current website structure.',
        evidence: ['marketplace.activeSections does not include faq'],
        proposedChange: {
          type: 'advisory',
          capabilityId: 'faq',
          sectionKey: 'faq',
          note: 'Phase 2 can draft FAQ population; Phase 1 is advisory only'
        },
        reason: 'FAQs improve conversion clarity for service businesses.',
        estimatedEffort: 'medium',
        affectedAreas: ['faq', 'homepage'],
        requiredPermissions: ['editor'],
        risk: 'low',
        status: 'proposed',
        executable: false,
        capabilityGap: false
      })
    );
  }

  if (q.includes('seo') || q.includes('google') || q.includes('canberra') || q.includes('page')) {
    recs.push(
      attachGuardian({
        id: randomUUID(),
        specialist: 'atlas',
        title: 'Plan an SEO landing page with Scout (Phase 2)',
        problem: 'Local/service SEO coverage may be incomplete for the request.',
        evidence: ['User request mentions SEO/location/page intent'],
        proposedChange: {
          type: 'capability_gap_or_phase2',
          capabilityId: 'seoLandingPage',
          note: 'Use existing SEO generator when Scout execution ships'
        },
        reason: 'SEO pages are a proven LeadPages workflow; Atlas will not invent pages in Phase 1.',
        estimatedEffort: 'medium',
        affectedAreas: ['pages', 'seo'],
        requiredPermissions: ['editor'],
        risk: 'low',
        status: 'proposed',
        executable: false,
        capabilityGap: false
      })
    );
  }

  if (!cta || /get in touch|contact us|learn more/i.test(String(cta))) {
    recs.push(
      knowledgeRec(
        'Clarify the primary call to action (CTA)',
        'The main website button wording is missing or too generic (like “Contact us”).',
        'preferredCta',
        'A clear CTA tells visitors exactly what to do next. Atlas can explain what a CTA is and save your preferred wording into Site Knowledge.'
      )
    );
  }

  if (services.length && services.length < 3) {
    recs.push(
      knowledgeRec(
        'Expand the service list in Site Knowledge',
        'Fewer than three main services are recorded.',
        'mainServices',
        'Clearer service inventory improves SEO and homepage structure advice.'
      )
    );
  }

  if (ctx.editorContext && ctx.editorContext.selectedSection === 'hero') {
    recs.push(
      attachGuardian({
        id: randomUUID(),
        specialist: 'atlas',
        title: 'Review the selected hero for goal alignment',
        problem: 'You are editing the hero — ensure it states the primary offer and CTA.',
        evidence: ['editorContext.selectedSection=hero'],
        proposedChange: {
          type: 'advisory',
          capabilityId: 'hero',
          sectionKey: 'hero',
          note: 'Advisory only — no automatic rewrite in Phase 1'
        },
        reason: 'Current-page context lets designers focus on the active section.',
        estimatedEffort: 'small',
        affectedAreas: ['hero'],
        requiredPermissions: ['editor'],
        risk: 'low',
        status: 'proposed',
        executable: false,
        capabilityGap: false,
        editorContext: ctx.editorContext
      })
    );
  }

  if (!recs.length) {
    recs.push(
      attachGuardian({
        id: randomUUID(),
        specialist: 'atlas',
        title: 'Website structure looks usable — refine the brief',
        problem: 'No critical structural gaps detected from current Site Brain signals.',
        evidence: ['Deterministic Atlas pass found no high-priority structural gaps'],
        proposedChange: {
          type: 'advisory',
          note: 'Ask Atlas a more specific outcome (e.g. more commercial enquiries)'
        },
        reason: 'Keep iterating with a clear business outcome.',
        estimatedEffort: 'small',
        affectedAreas: [],
        requiredPermissions: [],
        risk: 'low',
        status: 'proposed',
        executable: false,
        capabilityGap: false
      })
    );
  }

  return recs.slice(0, 8);
}

/**
 * Run Atlas review for a site.
 */
async function runAtlasReview(input) {
  const siteId = String((input && input.siteId) || '');
  const requestText = (input && input.requestText) || '';
  const editorContext = (input && input.editorContext) || {};
  const actorUserId = (input && input.actorUserId) || null;
  const actorRole = (input && input.actorRole) || null;

  if (!siteId) return { ok: false, error: 'site_id_required', persisted: false };

  const got = await siteBrain.getSiteBrain(siteId);
  if (!got.ok) return { ...got, persisted: !!got.persisted };

  const ctx = getRelevantContext(got.brain.snapshot, 'atlas', { editorContext });
  const recommendations = buildDeterministicRecommendations(ctx, requestText);

  const saved = [];
  for (const rec of recommendations) {
    const r = await siteBrain.recordRecommendation(siteId, {
      ...rec,
      editorContext,
      status: 'awaiting-review'
    }, {
      actorUserId,
      actorRole,
      source: 'specialist_inference'
    });
    if (!r.ok) {
      return {
        ok: false,
        error: r.error,
        message: r.message || 'Failed to persist recommendation',
        persisted: false,
        partial: saved
      };
    }
    saved.push(r.recommendation);
  }

  await siteBrain.recordAgentObservation(
    siteId,
    'atlas',
    {
      kind: 'review',
      requestText: String(requestText).slice(0, 500),
      conclusions: {
        lastReviewAt: new Date().toISOString(),
        recommendationCount: saved.length
      }
    },
    { actorUserId, actorRole, source: 'specialist_inference' }
  );

  return {
    ok: true,
    persisted: true,
    specialist: 'atlas',
    contextUsed: Object.keys(ctx),
    recommendations: saved,
    bootstrapStatus: got.brain.bootstrap_status
  };
}

module.exports = {
  runAtlasReview,
  buildDeterministicRecommendations
};
