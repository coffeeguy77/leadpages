/**
 * AI Website Team — Ask topic pills + specialist routing (static + unit).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.SITE_BRAIN_STORAGE = 'memory';

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'assets/ai-website-team.js'), 'utf8');
const askTopics = require('../lib/ai-team/ask-topics');
const aiTeam = require('../lib/ai-team');

assert.ok(ui.includes('ai-ask-shell'), 'premium ask shell');
assert.ok(ui.includes('ai-ask-pill'), 'topic pills markup');
assert.ok(ui.includes('ai-ask-thread'), 'chat thread');
assert.ok(ui.includes('selectAskTopic'), 'pill selects topic');
assert.ok(ui.includes('composeAskRequestText'), 'composes prefixed request');
assert.ok(ui.includes("prefix: 'landing page'"), 'landing pill');
assert.ok(ui.includes("prefix: 'seo'"), 'seo pill');
assert.ok(ui.includes("specialist: 'scout'"), 'seo routes to Scout label');
assert.ok(ui.includes("specialist: 'nova'"), 'slider routes to Nova label');
assert.ok(ui.includes("specialist: 'pulse'"), 'quote/cta routes to Pulse');
assert.ok(ui.includes('withSpecialist'), 'cards show withSpecialist');
assert.ok(ui.includes('Building a live suggestion card'), 'conversion to live card copy');

assert.equal(askTopics.listAskTopics().length >= 6, true);
assert.equal(askTopics.composeTopicRequest('landing', 'cold coffee options'), 'landing page: cold coffee options');
assert.equal(askTopics.parseTopicAsk('seo: canberra coffee').topic.specialist, 'scout');
assert.equal(askTopics.parseTopicAsk('slider: iced drinks').topic.specialist, 'nova');

const ctx = {
  goals: {
    primary: { value: 'Get more coffee cart hires' },
    preferredCta: { value: 'Get a free quote' }
  },
  offers: { mainServices: { value: ['Coffee cart', 'Weddings'] } },
  marketplace: { activeSections: { value: ['hero', 'faq', 'quote'] } },
  editorContext: { editorTab: 'ai-team', userRole: 'client' }
};

const landing = aiTeam.buildDeterministicRecommendations(ctx, 'landing page: cold coffee options');
assert.equal(landing.length, 1);
assert.equal((landing[0].proposedChange || {}).outcome, 'plan_seo_landing');
assert.equal((landing[0].proposedChange || {}).withSpecialist, 'atlas');

const seo = aiTeam.buildDeterministicRecommendations(ctx, 'seo: coffee cart hire Canberra');
assert.equal(seo.length, 1);
assert.equal((seo[0].proposedChange || {}).withSpecialist, 'scout');
assert.equal((seo[0].proposedChange || {}).outcome, 'plan_seo_landing');

const slider = aiTeam.buildDeterministicRecommendations(ctx, 'slider: wedding setups');
assert.equal(slider.length, 1);
assert.equal((slider[0].proposedChange || {}).outcome, 'plan_hero_slider');
assert.equal((slider[0].proposedChange || {}).withSpecialist, 'nova');
assert.ok(((slider[0].proposedChange || {}).planSteps || []).length >= 4);

const quote = aiTeam.buildDeterministicRecommendations(ctx, 'quote form: wedding coffee quote');
assert.equal(quote.length, 1);
assert.equal((quote[0].proposedChange || {}).outcome, 'plan_quote_form');
assert.equal((quote[0].proposedChange || {}).withSpecialist, 'pulse');

const cta = aiTeam.buildDeterministicRecommendations(ctx, 'cta: Book a tasting');
assert.equal(cta.length, 1);
assert.equal((cta[0].proposedChange || {}).outcome, 'strengthen_primary_cta');
assert.equal((cta[0].proposedChange || {}).withSpecialist, 'pulse');

console.log('ai-team-ask-pills.test.js: ok');
