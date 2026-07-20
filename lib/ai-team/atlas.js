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
  topicFromRecommendation,
  parseLandingFocus,
  isFocusedLandingAsk,
  applyStepAnswers,
  syncOutlineFromPlanSteps,
  buildPlanSteps,
  planOutlineFromSteps
} = require('./plan-outline');
const { parseTopicAsk, topicPromptSummary } = require('./ask-topics');

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
    topic: p._requestText || p.title,
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

function buildTopicRecommendation(topicAsk, ctx) {
  const topic = topicAsk.topic;
  const answer = cleanTopic(topicAsk.answer);
  const summary = topicPromptSummary(topicAsk) || topic.prefix + ': ' + answer;
  const withSpecialist = topic.specialist || 'atlas';

  if (topic.outcome === 'expand_main_services' || topic.knowledgeField === 'mainServices') {
    const rec = knowledgeRec(
      'Expand the list of main services',
      summary,
      'mainServices',
      'Atlas saved your services answer as a suggestion card. Confirm in guided chat or Site Knowledge — Echo can write public copy later.',
      'expand_main_services'
    );
    if (rec.proposedChange) {
      rec.proposedChange.promptSummary = summary;
      rec.proposedChange.withSpecialist = 'echo';
      rec.proposedChange.servicesHint = answer;
    }
    return rec;
  }

  if (topic.outcome === 'strengthen_primary_cta') {
    return outcomeRec({
      _requestText: answer,
      title: 'Strengthen your primary call to action',
      problem: summary,
      evidence: ['User request via ' + topic.label + ' topic', 'Intended specialist: ' + topic.specialistName],
      proposedChange: {
        type: 'outcome',
        outcome: 'strengthen_primary_cta',
        promptSummary: summary,
        withSpecialist: withSpecialist,
        preferredCtaHint: answer,
        note: 'Pulse-led conversion card. Draft in Forge applies the CTA when you are ready.'
      },
      reason: '',
      estimatedEffort: 'small',
      affectedAreas: ['homepage', 'conversion'],
      interactive: 'execution_plan',
      capabilityGap: false
    });
  }

  if (topic.outcome === 'enable_faq_for_objections') {
    return outcomeRec({
      _requestText: answer,
      title: 'Help visitors past common objections',
      problem: summary,
      evidence: ['User request via FAQ topic', 'Objections: ' + answer.slice(0, 160)],
      proposedChange: {
        type: 'outcome',
        outcome: 'enable_faq_for_objections',
        promptSummary: summary,
        withSpecialist: withSpecialist,
        objectionsHint: answer,
        note: 'Echo-led content angle. Draft in Forge can enable FAQ on the homepage.'
      },
      reason: '',
      estimatedEffort: 'medium',
      interactive: 'execution_plan',
      capabilityGap: false,
      affectedAreas: ['homepage', 'faq']
    });
  }

  if (topic.outcome === 'plan_quote_form') {
    return outcomeRec({
      _requestText: answer,
      title: 'Improve the quote / enquiry path',
      problem: summary,
      evidence: ['User request via Quote Form topic', 'Intended specialist: Pulse'],
      proposedChange: {
        type: 'outcome',
        outcome: 'plan_quote_form',
        promptSummary: summary,
        withSpecialist: 'pulse',
        note: 'Pulse conversion brief. Discuss to refine; Forge quote-layout apply expands later.'
      },
      reason: '',
      estimatedEffort: 'medium',
      requiredPermissions: ['editor'],
      interactive: 'discuss',
      capabilityGap: true,
      affectedAreas: ['quote', 'conversion']
    });
  }

  if (topic.outcome === 'plan_hero_slider') {
    return outcomeRec({
      _requestText: answer,
      title: 'Plan the hero slider story',
      problem: summary,
      evidence: ['User request via Slider topic', 'Intended specialist: Nova'],
      proposedChange: {
        type: 'outcome',
        outcome: 'plan_hero_slider',
        promptSummary: summary,
        withSpecialist: 'nova',
        note: 'Nova design brief. Discuss to refine; Forge slider apply expands later.'
      },
      reason: '',
      estimatedEffort: 'medium',
      requiredPermissions: ['editor'],
      interactive: 'discuss',
      capabilityGap: true,
      affectedAreas: ['hero', 'design']
    });
  }

  // Default: landing / SEO style plan
  const focus = parseLandingFocus(answer) || answer;
  return outcomeRec({
    _requestText: focus,
    title:
      (topic.id === 'seo' ? 'Plan SEO coverage for: ' : 'Plan a landing page for: ') +
      focus.slice(0, 72) +
      (focus.length > 72 ? '…' : ''),
    problem: summary,
    evidence: [
      'User request: ' + cleanTopic(topicAsk.requestText),
      'Intended specialist: ' + topic.specialistName
    ],
    proposedChange: {
      type: 'outcome',
      outcome: 'plan_seo_landing',
      promptSummary: summary,
      withSpecialist: withSpecialist,
      note:
        topic.specialistName +
        ' owns this angle — Atlas coordinates. Answer steps, Discuss, then Draft in Forge.'
    },
    reason: '',
    requiredPermissions: ['editor'],
    capabilityGap: false,
    interactive: 'execution_plan',
    affectedAreas: topic.id === 'seo' ? ['seo', 'landing'] : ['landing', 'seo']
  });
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
  const topicAsk = parseTopicAsk(requestText);
  const focusedLanding = isFocusedLandingAsk(requestText);
  const landingFocus = parseLandingFocus(requestText);
  const promptSummary = cleanPromptSummary(requestText);

  // Topic-pill / prefixed asks → one live card (Atlas coordinates; card may name Scout/Nova/…).
  if (topicAsk && topicAsk.topic && topicAsk.answer) {
    return [buildTopicRecommendation(topicAsk, ctx)];
  }

  // Focused landing-page asks → one card only (no CTA / FAQ siblings).
  if (focusedLanding) {
    const focus = landingFocus || promptSummary || 'this campaign';
    return [
      outcomeRec({
        _requestText: focus,
        title: 'Plan a landing page for: ' + focus.slice(0, 72) + (focus.length > 72 ? '…' : ''),
        problem: promptSummary || ('landing page: ' + focus),
        evidence: ['User request: ' + cleanTopic(requestText)],
        proposedChange: {
          type: 'outcome',
          outcome: 'plan_seo_landing',
          promptSummary: promptSummary || ('landing page: ' + focus),
          withSpecialist: 'atlas',
          note: 'Answer the steps that need your input, Discuss to refine, then Draft in Forge.'
        },
        reason: '',
        requiredPermissions: ['editor'],
        capabilityGap: false,
        interactive: 'execution_plan',
        affectedAreas: ['landing', 'seo']
      })
    ];
  }

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
    /\bseo\b/.test(q) ||
    /\bgoogle\b/.test(q) ||
    (/\bpages?\b/.test(q) && !/\bhome\s*pages?\b/.test(q))
  ) {
    const topic = landingFocus || cleanTopic(requestText).slice(0, 140);
    recs.push(
      outcomeRec({
        _requestText: topic || requestText,
        title: topic
          ? 'Plan a landing page for: ' + topic.slice(0, 72) + (topic.length > 72 ? '…' : '')
          : 'Plan a local search / landing page',
        problem: promptSummary || topic || 'Local or service search coverage may be incomplete.',
        evidence: [
          topic ? 'User request: ' + cleanTopic(requestText) : 'User request mentions SEO or page intent'
        ],
        proposedChange: {
          type: 'outcome',
          outcome: 'plan_seo_landing',
          promptSummary: promptSummary || topic,
          note: 'Answer the steps that need your input, then Draft in Forge.'
        },
        reason: '',
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
        reason: '',
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
        reason: '',
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
        reason: '',
        estimatedEffort: 'small',
        requiredPermissions: [],
        affectedAreas: []
      })
    );
  }

  return recs.slice(0, 8);
}

function cleanTopic(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPromptSummary(requestText) {
  const t = cleanTopic(requestText);
  if (!t) return '';
  // Prefer "landing page: cold coffee options" style
  if (/^landing\s*pages?\s*[:\-–]/i.test(t)) return t.slice(0, 140);
  const focus = parseLandingFocus(t);
  if (focus && isFocusedLandingAsk(t)) return ('landing page: ' + focus).slice(0, 140);
  return t.slice(0, 140);
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
        // Keep structured planSteps in sync when focus is edited.
        if (outcome === 'plan_seo_landing') {
          let steps = Array.isArray(change.planSteps) ? change.planSteps.map(function (s) {
            return Object.assign({}, s);
          }) : [];
          if (!steps.length) steps = buildPlanSteps(outcome, { topic: topic }) || [];
          const focusMatch = String(outline[0] || '').match(
            /Focus this landing page on:\s*[“"](.+?)[”"]/i
          );
          const focusVal = focusMatch
            ? cleanTopic(focusMatch[1])
            : parseLandingFocus(message) || topic;
          if (focusVal && steps[0]) {
            steps[0] = Object.assign({}, steps[0], {
              id: 'focus',
              status: 'done',
              value: focusVal,
              label: 'Focus this landing page on: “' + focusVal.slice(0, 100) + '”.',
              fields: []
            });
            const kw = steps.find(function (s) {
              return s && s.id === 'keywords';
            });
            if (kw && kw.status === 'needs_answer') {
              kw.label =
                'Lock the primary search phrase: “' +
                focusVal.slice(0, 80) +
                '” and location (keywords + suburb/city).';
              if (Array.isArray(kw.fields) && kw.fields[0]) {
                kw.fields[0] = Object.assign({}, kw.fields[0], {
                  placeholder: focusVal.slice(0, 60)
                });
              }
            }
            change.promptSummary = 'landing page: ' + focusVal.slice(0, 120);
          }
          change.planSteps = steps;
          change.planOutline = planOutlineFromSteps(steps);
          outline = change.planOutline;
        } else {
          change.planOutline = outline;
        }
      } else {
        change.planOutline = outline;
      }
      if (!Array.isArray(change.planSteps) || !change.planSteps.length) {
        const built = buildPlanSteps(outcome, { topic: topic, requestText: topic });
        if (built) {
          change.planSteps = built;
          change.planOutline = planOutlineFromSteps(built);
          outline = change.planOutline;
        }
      }
      Object.assign(change, syncOutlineFromPlanSteps(change));
      outline = change.planOutline || outline;
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

async function answerStepRecommendation(input) {
  const siteId = String((input && input.siteId) || '');
  const recommendationId = String((input && input.recommendationId) || '').trim();
  const stepId = String((input && input.stepId) || '').trim();
  const answers = (input && input.answers) || {};
  const actorUserId = (input && input.actorUserId) || null;
  const actorRole = (input && input.actorRole) || null;

  if (!siteId) return { ok: false, error: 'site_id_required', persisted: false };
  if (!recommendationId) return { ok: false, error: 'recommendation_id_required', persisted: false };
  if (!stepId) return { ok: false, error: 'step_id_required', persisted: false };

  const patched = await siteBrain.patchRecommendation(
    siteId,
    recommendationId,
    function (rec) {
      const change = Object.assign({}, rec.proposed_change || rec.proposedChange || {});
      const next = applyStepAnswers(change, stepId, answers);
      const discussion = Object.assign({}, next.discussion || {});
      const messages = Array.isArray(discussion.messages) ? discussion.messages.slice() : [];
      const step = (next.planSteps || []).find(function (s) {
        return s && s.id === stepId;
      });
      messages.push({
        role: 'atlas',
        body:
          'Saved your answer for step “' +
          ((step && step.label) || stepId) +
          '”. The suggestion checklist is updated on this same card.',
        at: new Date().toISOString()
      });
      discussion.messages = messages.slice(-40);
      next.discussion = discussion;
      return { proposed_change: next };
    },
    { actorUserId, actorRole, source: 'user' }
  );

  if (!patched.ok) return Object.assign({}, patched, { persisted: !!patched.persisted });
  const change = (patched.recommendation && patched.recommendation.proposed_change) || {};
  return {
    ok: true,
    persisted: true,
    recommendation: patched.recommendation,
    planSteps: change.planSteps || [],
    planOutline: change.planOutline || [],
    messages: (change.discussion && change.discussion.messages) || []
  };
}

module.exports = {
  runAtlasReview,
  buildDeterministicRecommendations,
  discussRecommendation,
  answerStepRecommendation
};
