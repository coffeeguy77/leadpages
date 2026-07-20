'use strict';

/**
 * Atlas — Website Strategist.
 * Thinks in business outcomes. Never knows config paths, section ids, or renderer details.
 * Produces Recommendations only. Forge owns Execution Plans and configuration.
 */

const { randomUUID } = require('crypto');
const { getRelevantContext, factValue, summarizeForUi } = require('./context');
const { attachGuardian } = require('./guardian');
const { isSupportedForRecommendation } = require('./capability-registry');
const { getField } = require('./site-knowledge-fields');
const siteBrain = require('../site-brain');
const {
  attachPlanOutline,
  defaultPlanOutline,
  refinePlanOutline,
  discussReply,
  classifyDiscussIntent,
  sanitizeOutline,
  topicFromRecommendation
} = require('./plan-outline');

function knowledgeRec(title, problem, fieldKey, reason, outcome) {
  const field = getField(fieldKey);
  const out = outcome || 'confirm_business_goal';
  return attachGuardian({
    id: randomUUID(),
    specialist: 'atlas',
    title,
    problem,
    evidence: ['Site Knowledge needs confirmation: ' + (field ? field.label : fieldKey)],
    proposedChange: attachPlanOutline(
      {
        type: 'outcome',
        outcome: out,
        fieldKey: fieldKey,
        note: 'Answer in Atlas guided chat or Site Knowledge — saves approved business truth only (not page copy)'
      },
      out,
      { fieldKey: fieldKey, fieldLabel: field && field.label }
    ),
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
  const p = Object.assign({}, partial || {});
  const change = p.proposedChange || p.proposed_change || {};
  const outcome = change.outcome || null;
  p.proposedChange = attachPlanOutline(change, outcome, {
    topic: p.title,
    requestText: p._requestText || ''
  });
  delete p._requestText;
  delete p.proposed_change;
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
      p
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

  if (
    /\blanding\s*pages?\b/.test(q) ||
    q.includes('landingpage') ||
    /\bseo\b/.test(q) ||
    /\bgoogle\b/.test(q) ||
    /\bcanberra\b/.test(q) ||
    (/\b(wedding|event|hire|cart|coffee)\b/.test(q) && /\b(page|landing|seo)\b/.test(q)) ||
    (/\bpages?\b/.test(q) && !/\bhome\s*pages?\b/.test(q))
  ) {
    const topic = String(requestText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    recs.push(
      outcomeRec({
        _requestText: topic || requestText,
        title: topic
          ? 'Plan a landing page for: ' + topic.slice(0, 72) + (topic.length > 72 ? '…' : '')
          : 'Plan a local search / landing page',
        problem: topic
          ? 'You asked for a focused page/campaign, but there is not yet an agreed how-we-will-do-it plan for that request.'
          : 'Local or service search coverage may be incomplete for this request.',
        evidence: [
          topic ? 'User request: ' + topic : 'User request mentions SEO, location, or page intent'
        ],
        proposedChange: {
          type: 'outcome',
          outcome: 'plan_seo_landing',
          note:
            'Atlas proposes a concrete checklist. Discuss to refine it on this same card, then Draft in Forge. Creating the live page still happens in Landing pages / Scout — AI never publishes.'
        },
        reason: topic
          ? 'Generated because you asked: “' +
            topic +
            '”. Open Discuss to refine the checklist on this same suggestion — Ask the Team will not replace this card.'
          : 'You asked about search or a page — here is a concrete checklist of what would be done next.',
        requiredPermissions: ['editor'],
        capabilityGap: false,
        interactive: 'execution_plan',
        affectedAreas: ['landing', 'seo']
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
          'Draft in Forge prepares an exact Change Preview (Hero/Sticky/Footer CTA). Discuss this card to refine first — Ask the Team will not spawn a duplicate.',
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
        reason:
          'You are editing the hero right now, so Atlas prioritised first-impression clarity. Approve to let Forge plan CTA/offer changes; Discuss to refine what visitors should see first.',
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

async function discussRecommendation(input) {
  const siteId = String((input && input.siteId) || '');
  const recommendationId = String((input && input.recommendationId) || '').trim();
  const message = String((input && input.message) || '').trim();
  const actorUserId = (input && input.actorUserId) || null;
  const actorRole = (input && input.actorRole) || null;

  if (!siteId) return { ok: false, error: 'site_id_required', persisted: false };
  if (!recommendationId) return { ok: false, error: 'recommendation_id_required', persisted: false };

  const got = await siteBrain.getSiteBrain(siteId);
  const siteSummary = got.ok ? summarizeForUi(got.brain.snapshot) : {};
  // Extra area facts if present on snapshot (summarizeForUi may omit them).
  if (got.ok && got.brain && got.brain.snapshot) {
    const areas = factValue(got.brain.snapshot.audience && got.brain.snapshot.audience.serviceAreas);
    if (Array.isArray(areas) && areas.length) siteSummary.serviceAreas = areas;
    else {
      const alt = factValue(got.brain.snapshot.serviceAreas);
      if (Array.isArray(alt)) siteSummary.serviceAreas = alt;
    }
  }

  const intent = message ? classifyDiscussIntent(message) : 'ack';

  const patched = await siteBrain.patchRecommendation(
    siteId,
    recommendationId,
    function (rec) {
      const change = Object.assign({}, rec.proposed_change || rec.proposedChange || {});
      const outcome = change.outcome || null;
      const topic =
        topicFromRecommendation(rec) ||
        (outcome === 'plan_seo_landing' ? '' : '') ||
        '';
      let outline = Array.isArray(change.planOutline) ? change.planOutline.slice() : [];
      if (!outline.length) {
        outline = defaultPlanOutline(outcome, {
          topic: topic,
          requestText: topic
        });
      } else {
        outline = sanitizeOutline(outline, outcome, { topic: topic, requestText: topic });
      }

      // Only mutate the checklist when the user clearly edits the plan.
      if (message && intent === 'edit') {
        outline = refinePlanOutline(outline, message, outcome, { topic: topic });
      }

      change.planOutline = outline;
      const discussion = Object.assign({}, change.discussion || {});
      const messages = Array.isArray(discussion.messages) ? discussion.messages.slice() : [];
      if (!messages.length) {
        messages.push({
          role: 'atlas',
          body: discussReply(rec, '', outline, { site: siteSummary }),
          at: new Date().toISOString()
        });
      }
      if (message) {
        messages.push({ role: 'user', body: message, at: new Date().toISOString() });
        messages.push({
          role: 'atlas',
          body: discussReply(rec, message, outline, { site: siteSummary, intent: intent }),
          at: new Date().toISOString()
        });
      }
      discussion.messages = messages.slice(-40);
      change.discussion = discussion;
      return { proposed_change: change };
    },
    { actorUserId, actorRole, source: 'specialist_inference' }
  );

  if (!patched.ok) return Object.assign({}, patched, { persisted: !!patched.persisted });
  const change = (patched.recommendation && patched.recommendation.proposed_change) || {};
  return {
    ok: true,
    persisted: true,
    recommendation: patched.recommendation,
    messages: (change.discussion && change.discussion.messages) || [],
    planOutline: change.planOutline || [],
    intent: intent
  };
}

module.exports = {
  runAtlasReview,
  buildDeterministicRecommendations,
  discussRecommendation
};
