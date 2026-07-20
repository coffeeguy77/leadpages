/**
 * AI Website Team — discuss conversation + plan outline UX (static + unit).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/ai-website-team.js'), 'utf8');
const atlasSrc = fs.readFileSync(path.join(root, 'lib/ai-team/atlas.js'), 'utf8');
const outline = require('../lib/ai-team/plan-outline');
const aiTeam = require('../lib/ai-team');
const siteBrain = require('../lib/site-brain');

assert.ok(ui.includes('async function softRefresh'), 'softRefresh helper exists');
assert.ok(ui.includes('await softRefresh('), 'ask / reject paths use softRefresh');
assert.ok(ui.includes('ai-rec-label">Summary'), 'Summary label in card UI');
assert.ok(ui.includes('ai-rec-suggestion-steps'), 'suggestion steps markup');
assert.ok(ui.includes('ai-step-answer'), 'Answer button on steps');
assert.ok(ui.includes("action: 'answer_step'"), 'answer_step API wired');
assert.ok(ui.includes('openStepAnswer'), 'step answer modal');
assert.ok(ui.includes('openDiscussChat'), 'discuss opens conversation modal');
assert.ok(ui.includes('Draft in Forge'), 'Draft in Forge button');
assert.ok(!ui.includes('Discuss this suggestion:'), 'no prefilled ask dump');
assert.ok(!ui.includes('Why this was suggested'), 'Why section removed');
assert.ok(ui.includes("action: 'discuss'"), 'discuss API wired');
assert.ok(ui.includes('Same suggestion'), 'discuss copy says same suggestion');

assert.ok(atlasSrc.includes('discussRecommendation'), 'discussRecommendation exported');
assert.ok(atlasSrc.includes('answerStepRecommendation'), 'answerStepRecommendation exported');
assert.ok(atlasSrc.includes('attachPlanOutline'), 'plan outlines attached at generation');
assert.ok(atlasSrc.includes('isFocusedLandingAsk'), 'focused landing ask gating');

assert.equal(outline.parseLandingFocus('landing page: cold coffee options'), 'cold coffee options');
assert.ok(outline.isFocusedLandingAsk('landing page: cold coffee options'));

const landingOutline = outline.defaultPlanOutline('plan_seo_landing', {
  topic: 'I need a landing page on wedding coffee events'
});
assert.ok(landingOutline.length >= 4, 'landing outline has concrete steps');
assert.match(landingOutline[0], /wedding coffee events/i);
assert.ok(landingOutline.some((s) => /Landing pages/i.test(s)), 'mentions Landing pages');

const coldSteps = outline.buildPlanSteps('plan_seo_landing', {
  topic: 'landing page: cold coffee options'
});
assert.ok(coldSteps && coldSteps.length === 5, 'five structured landing steps');
assert.match(coldSteps[0].label, /cold coffee options/i);
assert.ok(!/Plan a landing page for:\s*landing page:/i.test(coldSteps[0].label));
assert.equal(coldSteps[1].status, 'needs_answer');
assert.equal(coldSteps[2].status, 'needs_answer');
assert.ok(coldSteps[1].fields && coldSteps[1].fields.length >= 2, 'keywords fields');
assert.ok(coldSteps[2].fields && coldSteps[2].fields.length >= 4, 'brief fields');

siteBrain.useMemoryForTests(true);
siteBrain.resetMemoryStore();

(async () => {
  await siteBrain.syncSiteBrainFromSite({
    id: 'discuss-1',
    business_name: 'Bean Culture',
    config: {
      name: 'Bean Culture',
      services: [{ title: 'Coffee cart' }, { title: 'Weddings' }, { title: 'Corporate' }],
      sections: { hero: { on: true, cta: 'Get a free quote' }, faq: { on: true }, quote: { on: true } },
      sectionOrder: ['hero', 'faq', 'quote']
    }
  });
  await siteBrain.applyBootstrapReview(
    'discuss-1',
    {
      businessName: 'Bean Culture',
      industry: 'Coffee cart',
      mainServices: 'Coffee cart\nWeddings\nCorporate',
      primaryGoal: 'Get more coffee cart hires',
      preferredCta: 'Get a free quote',
      targetAudience: 'Wedding planners',
      brandTone: 'Warm'
    },
    { actorUserId: 'u1' }
  );

  const focused = await aiTeam.runAtlasReview({
    siteId: 'discuss-1',
    requestText: 'landing page: cold coffee options',
    editorContext: { editorTab: 'ai-team', userRole: 'client' },
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(focused.ok, true);
  assert.equal(focused.recommendations.length, 1, 'focused landing ask returns one card');
  const cold = focused.recommendations[0];
  const coldChange = cold.proposed_change || cold.proposedChange || {};
  assert.equal(coldChange.outcome, 'plan_seo_landing');
  assert.equal(coldChange.promptSummary, 'landing page: cold coffee options');
  assert.match(String(cold.problem || ''), /^landing page:\s*cold coffee options$/i);
  assert.ok(!/Strengthen your primary call to action/i.test(String(cold.title || '')));
  const coldPlanSteps = coldChange.planSteps || [];
  assert.equal(coldPlanSteps.length, 5);
  assert.match(String(coldPlanSteps[0].label || ''), /Focus this landing page on:\s*[“"]cold coffee options[”"]/i);
  assert.equal(coldPlanSteps[1].status, 'needs_answer');
  assert.equal(coldPlanSteps[2].status, 'needs_answer');

  const answered = await aiTeam.answerStepRecommendation({
    siteId: 'discuss-1',
    recommendationId: cold.id,
    stepId: 'keywords',
    answers: { searchPhrase: 'cold coffee options', location: 'Canberra' },
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(answered.ok, true);
  const kwStep = (answered.planSteps || []).find((s) => s.id === 'keywords');
  assert.equal(kwStep.status, 'done');
  assert.match(String(kwStep.label || ''), /Canberra/i);

  const brief = await aiTeam.answerStepRecommendation({
    siteId: 'discuss-1',
    recommendationId: cold.id,
    stepId: 'brief',
    answers: {
      headline: 'Iced options that sell',
      proofPoints: 'Fresh\nLocal\nFast',
      objections: 'Too expensive',
      cta: 'Book a tasting'
    },
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(brief.ok, true);
  const briefStep = (brief.planSteps || []).find((s) => s.id === 'brief');
  assert.equal(briefStep.status, 'done');
  const draftStep = (brief.planSteps || []).find((s) => s.id === 'draft');
  assert.equal(draftStep.status, 'ready');

  siteBrain.resetMemoryStore();
  await siteBrain.syncSiteBrainFromSite({
    id: 'discuss-1',
    business_name: 'Bean Culture',
    config: {
      name: 'Bean Culture',
      services: [{ title: 'Coffee cart' }, { title: 'Weddings' }, { title: 'Corporate' }],
      sections: { hero: { on: true, cta: 'Get a free quote' }, faq: { on: true }, quote: { on: true } },
      sectionOrder: ['hero', 'faq', 'quote']
    }
  });
  await siteBrain.applyBootstrapReview(
    'discuss-1',
    {
      businessName: 'Bean Culture',
      industry: 'Coffee cart',
      mainServices: 'Coffee cart\nWeddings\nCorporate',
      primaryGoal: 'Get more coffee cart hires',
      preferredCta: 'Get a free quote',
      targetAudience: 'Wedding planners',
      brandTone: 'Warm'
    },
    { actorUserId: 'u1' }
  );

  const review = await aiTeam.runAtlasReview({
    siteId: 'discuss-1',
    requestText: 'I need a landing page on wedding coffee events',
    editorContext: { editorTab: 'ai-team', userRole: 'client' },
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(review.ok, true);
  assert.equal(review.recommendations.length, 1, 'landing ask returns one card only');
  const beforeCount = review.recommendations.length;
  const landing = review.recommendations.find((r) => {
    const change = r.proposed_change || r.proposedChange || {};
    return change.outcome === 'plan_seo_landing';
  });
  assert.ok(landing, 'landing rec created');
  const outlineSteps =
    (landing.proposed_change || landing.proposedChange || {}).planOutline || [];
  assert.ok(outlineSteps.length >= 4, 'landing rec has planOutline');

  const discussed = await aiTeam.discussRecommendation({
    siteId: 'discuss-1',
    recommendationId: landing.id,
    message: 'Focus on Canberra wedding venues and weekend hires',
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(discussed.ok, true);
  assert.equal(discussed.recommendation.id, landing.id, 'same recommendation id');
  assert.ok(discussed.messages.length >= 2, 'conversation messages present');
  assert.match(String(discussed.planOutline[0] || ''), /Canberra wedding/i);
  const discussedSteps =
    (discussed.recommendation.proposed_change || {}).planSteps || [];
  assert.match(String((discussedSteps[0] && discussedSteps[0].label) || ''), /Canberra wedding/i);

  const asked = await aiTeam.discussRecommendation({
    siteId: 'discuss-1',
    recommendationId: landing.id,
    message: 'What is the primary search phrase?',
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(asked.ok, true);
  assert.equal(asked.intent, 'question');
  assert.match(String(asked.planOutline[0] || ''), /Canberra wedding/i, 'question must not overwrite plan focus');
  assert.ok(!/What is the primary search phrase/i.test(String(asked.planOutline[0] || '')));
  const lastAtlas = (asked.messages || []).filter((m) => m.role === 'atlas').pop();
  assert.match(String(lastAtlas && lastAtlas.body) || '', /primary search phrase|Recommended/i);
  assert.ok(!/I updated the plan/i.test(String(lastAtlas && lastAtlas.body) || ''));

  const listed = await siteBrain.listRecommendations('discuss-1');
  const pending = (listed.recommendations || []).filter((r) => r.status === 'awaiting-review');
  assert.equal(
    pending.filter((r) => {
      const c = r.proposed_change || {};
      return c.outcome === 'plan_seo_landing';
    }).length,
    1,
    'discuss did not create a second landing recommendation'
  );
  assert.ok(pending.length <= beforeCount + 1, 'no discuss-spawned duplicate flood');

  console.log('ai-team-suggest-discuss-ux.test.js: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
