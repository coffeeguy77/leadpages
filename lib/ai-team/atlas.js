'use strict';

/**
 * Atlas — Website Strategist.
 * Thinks in business outcomes. Never knows config paths, section ids, or renderer details.
 * Produces Recommendations only. Forge owns Execution Plans and configuration.
 */

const { randomUUID } = require('crypto');
const { getRelevantContext, factValue } = require('./context');
const { attachGuardian } = require('./guardian');
const { isSupportedForRecommendation } = require('./capability-registry');
const { getField } = require('./site-knowledge-fields');
const siteBrain = require('../site-brain');

function knowledgeRec(title, problem, fieldKey, reason, outcome) {
  const field = getField(fieldKey);
  return attachGuardian({
    id: randomUUID(),
    specialist: 'atlas',
    title,
    problem,
    evidence: ['Site Knowledge needs confirmation: ' + (field ? field.label : fieldKey)],
    proposedChange: {
      type: 'outcome',
      outcome: outcome || 'confirm_business_goal',
      fieldKey: fieldKey,
      note: 'Answer in Atlas guided chat or Site Knowledge — saves approved business truth only (not page copy)'
    },
    reason,
    estimatedEffort: 'small',
    affectedAreas: ['Site Knowledge'],
    requiredPermissions: ['mutate_brain'],
    risk: 'low',
    status: 'proposed',
    executable: false,
    capabilityGap: false,
    interactive: 'site_knowledge_chat'
  });
}

function outcomeRec(partial) {
  return attachGuardian(
    Object.assign(
      {
        id: randomUUID(),
        specialist: 'atlas',
        status: 'proposed',
        executable: false,
        capabilityGap: false,
        estimatedEffort: 'medium',
        requiredPermissions: ['forge_apply'],
        risk: 'low',
        affectedAreas: ['homepage']
      },
      partial
    )
  );
}

function buildDeterministicRecommendations(ctx, requestText) {
  const recs = [];
  const services = factValue(ctx.offers && ctx.offers.mainServices) || [];
  const goal = factValue(ctx.goals && ctx.goals.primary) || '';
  const cta = factValue(ctx.goals && ctx.goals.preferredCta) || '';
  const sections = factValue(ctx.marketplace && ctx.marketplace.activeSections) || [];
  const q = String(requestText || '').toLowerCase();
  const pagePurpose =
    (ctx.editorContext && ctx.editorContext.pagePurpose) ||
    (ctx.editorContext && ctx.editorContext.editorTab === 'landing' ? 'landing' : 'homepage');

  if (!goal) {
    recs.push(
      knowledgeRec(
        'Confirm the primary business goal',
        'We do not yet have an approved business goal for this site.',
        'primaryGoal',
        'Atlas needs a clear outcome to prioritise improvements. Your answer becomes Site Knowledge — approved business truth — not website copy.',
        'confirm_business_goal'
      )
    );
  }

  // Business outcome: visitors lack objection-handling content
  if (!sections.includes('faq') && isSupportedForRecommendation('faq')) {
    recs.push(
      outcomeRec({
        title: 'Help visitors past common objections',
        problem:
          'The homepage does not clearly answer the questions people ask before they enquire.',
        evidence: ['Site Knowledge / website state suggests FAQ coverage is missing'],
        proposedChange: {
          type: 'outcome',
          outcome: 'enable_faq_for_objections',
          note: 'Forge will plan how to surface FAQ content. Echo can write answers later.'
        },
        reason:
          'Service businesses convert better when common objections are answered before the quote request.',
        estimatedEffort: 'medium',
        interactive: 'execution_plan'
      })
    );
  }

  if (q.includes('seo') || q.includes('google') || q.includes('canberra') || q.includes('page')) {
    recs.push(
      outcomeRec({
        title: 'Plan local search coverage with Scout',
        problem: 'Local or service search coverage may be incomplete for this request.',
        evidence: ['User request mentions SEO, location, or page intent'],
        proposedChange: {
          type: 'outcome',
          outcome: 'plan_seo_landing',
          note: 'Scout owns SEO strategy; Forge executes when Scout ships'
        },
        reason: 'SEO pages are a proven workflow — Atlas recommends the outcome; Scout plans the strategy.',
        requiredPermissions: ['editor'],
        capabilityGap: false,
        interactive: null
      })
    );
  }

  if (!cta || /get in touch|contact us|learn more/i.test(String(cta))) {
    recs.push(
      knowledgeRec(
        'Clarify what visitors should do next',
        'The preferred call to action is missing or too vague (for example “Contact us”).',
        'preferredCta',
        'A clear next step tells visitors exactly what to do. This is business truth in Site Knowledge — Forge applies it to the site later.',
        'clarify_preferred_cta'
      )
    );
  } else {
    recs.push(
      outcomeRec({
        title: 'Strengthen your primary call to action',
        problem:
          pagePurpose === 'homepage'
            ? 'The homepage may not clearly direct visitors to request a quote (or your preferred next step).'
            : 'This page may not clearly direct visitors toward your preferred next step.',
        evidence: ['Site Knowledge has an approved preferred CTA', 'Apply via Forge Execution Plan'],
        proposedChange: {
          type: 'outcome',
          outcome: 'strengthen_primary_cta',
          note: 'Forge builds an Execution Plan (hero / sticky / footer as needed). Atlas does not touch configuration.'
        },
        reason:
          'Approve so Forge can prepare a Change Preview. You review, Apply Changes, then Publish Live Site yourself.',
        estimatedEffort: 'small',
        affectedAreas: ['homepage', 'conversion'],
        interactive: 'execution_plan'
      })
    );
  }

  if (services.length && services.length < 3) {
    recs.push(
      knowledgeRec(
        'Expand the list of main services',
        'Fewer than three main services are recorded as approved business truth.',
        'mainServices',
        'A clearer service inventory improves strategy advice. Site Knowledge stores the facts — Echo writes public copy later.',
        'expand_main_services'
      )
    );
  }

  // Current page / section context — still outcome language, no config paths
  if (ctx.editorContext && ctx.editorContext.selectedSection === 'hero') {
    recs.push(
      outcomeRec({
        title: 'Improve the offer visitors see first',
        problem:
          'You are focused on the first impression of this page — make sure the offer and next step are unmistakable.',
        evidence: ['Editor context: current section is the page’s primary introduction'],
        proposedChange: {
          type: 'outcome',
          outcome: 'strengthen_primary_cta',
          note: 'Advisory + Forge plan when preferred CTA is approved'
        },
        reason: 'Current-page context lets Atlas advise on what you are looking at — without naming implementation details.',
        estimatedEffort: 'small',
        requiredPermissions: ['editor'],
        editorContext: ctx.editorContext,
        interactive: 'execution_plan'
      })
    );
  }

  if (!recs.length) {
    recs.push(
      outcomeRec({
        title: 'Refine the business outcome you want next',
        problem: 'No critical strategic gaps stood out from current Site Knowledge.',
        evidence: ['Deterministic Atlas pass found no high-priority outcome gaps'],
        proposedChange: {
          type: 'outcome',
          outcome: 'refine_brief',
          note: 'Ask Atlas for a more specific business result'
        },
        reason: 'Keep iterating with a clear business outcome.',
        estimatedEffort: 'small',
        requiredPermissions: [],
        affectedAreas: []
      })
    );
  }

  return recs.slice(0, 8);
}

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
    const r = await siteBrain.recordRecommendation(
      siteId,
      {
        ...rec,
        editorContext,
        status: 'awaiting-review'
      },
      {
        actorUserId,
        actorRole,
        source: 'specialist_inference'
      }
    );
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
