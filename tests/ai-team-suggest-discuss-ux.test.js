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
assert.ok(ui.includes('How we will do it'), 'plan outline label in UI');
assert.ok(ui.includes('ai-rec-outline'), 'outline list styles/markup');
assert.ok(ui.includes('openDiscussChat'), 'discuss opens conversation modal');
assert.ok(ui.includes('Draft in Forge'), 'Draft in Forge button');
assert.ok(!ui.includes('Discuss this suggestion:'), 'no prefilled ask dump');
assert.ok(ui.includes("action: 'discuss'"), 'discuss API wired');
assert.ok(ui.includes('Same suggestion'), 'discuss copy says same suggestion');

assert.ok(atlasSrc.includes('discussRecommendation'), 'discussRecommendation exported');
assert.ok(atlasSrc.includes('attachPlanOutline'), 'plan outlines attached at generation');

const landingOutline = outline.defaultPlanOutline('plan_seo_landing', {
  topic: 'I need a landing page on wedding coffee events'
});
assert.ok(landingOutline.length >= 4, 'landing outline has concrete steps');
assert.match(landingOutline[0], /wedding coffee events/i);
assert.ok(landingOutline.some((s) => /Landing pages/i.test(s)), 'mentions Landing pages');

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

  const review = await aiTeam.runAtlasReview({
    siteId: 'discuss-1',
    requestText: 'I need a landing page on wedding coffee events',
    editorContext: { editorTab: 'ai-team', userRole: 'client' },
    actorUserId: 'u1',
    actorRole: 'client'
  });
  assert.equal(review.ok, true);
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
