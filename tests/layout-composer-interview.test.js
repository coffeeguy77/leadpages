'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  startInterview,
  answerInterview,
  suggestApps,
  confidenceFromUnderstanding,
} = require('../lib/layout-composer/interview');
const { fillConfigFromUnderstanding } = require('../lib/layout-composer/rich-fill');
const { scratchBlueprint } = require('../lib/layout-composer/section-catalogue');
const { compileBlueprintToConfig } = require('../lib/layout-composer/compile');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'layout-composer.html'), 'utf8');

function driveToReady(brief, blueprint) {
  let cur = startInterview(brief, blueprint);
  let guard = 0;
  while (!cur.ready && guard < 20) {
    guard += 1;
    const opts = cur.turn.options || [];
    const pick = opts.filter(function (o) { return o.recommended; }).slice(0, cur.turn.multi ? 2 : 1);
    const ids = (pick.length ? pick : opts.slice(0, 1)).map(function (o) { return o.id; });
    cur = answerInterview(cur.session, { selectedIds: ids });
  }
  return cur;
}

describe('Layout Composer interview + rich fill', () => {
  it('starts with recommended chips and free-text allowed', () => {
    const started = startInterview({
      businessName: 'Acme Plumbing',
      trade: 'Plumber',
      location: 'Canberra',
    });
    assert.equal(started.turn.stepId, 'services');
    assert.ok(started.turn.options.length >= 3);
    assert.ok(started.turn.options.some(function (o) { return o.recommended; }));
    assert.equal(started.turn.allowFreeText, true);
    assert.ok(started.turn.question.indexOf('Acme Plumbing') >= 0);
  });

  it('builds understanding through chip answers then marks ready', () => {
    const done = driveToReady({
      businessName: 'Acme Plumbing',
      trade: 'Plumber',
      location: 'Canberra',
    });
    assert.equal(done.ready, true);
    assert.ok(done.understanding.services.length >= 1);
    assert.ok(done.understanding.differentiator);
    assert.ok(done.understanding.preferredCta);
    assert.ok(confidenceFromUnderstanding(done.understanding) >= 0.7);
    assert.ok(Array.isArray(done.appSuggestions));
    assert.ok(done.appSuggestions.length >= 1);
  });

  it('fills every enabled blueprint section from understanding', () => {
    const bp = scratchBlueprint('Acme Plumbing');
    const done = driveToReady({
      businessName: 'Acme Plumbing',
      trade: 'Plumber',
      location: 'Canberra',
    }, bp);
    const compiled = compileBlueprintToConfig(bp, {
      identity: { name: 'Acme Plumbing', trade: 'Plumber', location: 'Canberra' },
    });
    const beforeOrder = (compiled.config.sectionOrder || []).slice();
    const filled = fillConfigFromUnderstanding(
      compiled.config,
      bp,
      { businessName: 'Acme Plumbing', trade: 'Plumber', location: 'Canberra' },
      done.understanding
    );
    assert.ok(filled.filledKeys.length >= 8);
    assert.equal(
      JSON.stringify(filled.config.sectionOrder),
      JSON.stringify(beforeOrder)
    );
    assert.ok(filled.config.sections.hero.title || filled.config.sections.hero.heading);
    assert.ok(filled.config.sections.services.items.length >= 1);
  });

  it('suggestApps marks in-layout vs suggested without mutating structure', () => {
    const suggestions = suggestApps(
      { trade: 'Electrician', location: 'Hobart' },
      ['hero', 'services', 'faq']
    );
    const faq = suggestions.find(function (s) { return s.key === 'faq'; });
    assert.ok(faq);
    assert.equal(faq.inLayout, true);
    assert.ok(suggestions.some(function (s) { return s.inLayout === false; }));
  });

  it('prefers free-text answers over chips on single-select steps', () => {
    let cur = startInterview({
      businessName: 'Metal Roof Vents',
      trade: 'Roof Ventilation',
      location: 'Australia',
    });
    // services (multi) — free text splits
    cur = answerInterview(cur.session, {
      freeText: 'Ridge vents, turbine vents, custom flashings',
    });
    assert.ok(cur.understanding.services.indexOf('Ridge vents') >= 0);
    assert.ok(cur.understanding.services.indexOf('turbine vents') >= 0);
    // skip to differentiator
    while (cur.turn.stepId !== 'differentiator' && !cur.turn.terminal) {
      const opts = cur.turn.options || [];
      const pick = opts.filter(function (o) { return o.recommended; }).slice(0, cur.turn.multi ? 2 : 1);
      cur = answerInterview(cur.session, {
        selectedIds: (pick.length ? pick : opts.slice(0, 1)).map(function (o) { return o.id; }),
      });
    }
    cur = answerInterview(cur.session, {
      selectedIds: [(cur.turn.options[0] || {}).id],
      freeText: 'Custom metal vents made in Australia',
    });
    assert.equal(cur.understanding.differentiator, 'Custom metal vents made in Australia');
  });

  it('ready "one more thing" asks a single follow-up then returns to ready', () => {
    const done = driveToReady({
      businessName: 'Metal Roof Vents',
      trade: 'Roof Ventilation',
      location: 'Australia',
    });
    // driveToReady confirms ready-yes — restart to ready terminal without completing
    let cur = startInterview({
      businessName: 'Metal Roof Vents',
      trade: 'Roof Ventilation',
      location: 'Australia',
    });
    while (!cur.turn.terminal) {
      const opts = cur.turn.options || [];
      const pick = opts.filter(function (o) { return o.recommended; }).slice(0, cur.turn.multi ? 2 : 1);
      cur = answerInterview(cur.session, {
        selectedIds: (pick.length ? pick : opts.slice(0, 1)).map(function (o) { return o.id; }),
      });
    }
    assert.equal(cur.turn.stepId, 'ready');
    cur = answerInterview(cur.session, { selectedIds: ['ready-more'] });
    assert.match(cur.turn.stepId, /^followup-/);
    assert.equal(cur.ready, false);
    const step = cur.session.steps.find(function (s) { return s.id === cur.turn.stepId; });
    assert.equal(step.oneShot, true);
    cur = answerInterview(cur.session, { freeText: 'Colorbond ridge vents' });
    assert.equal(cur.turn.stepId, 'ready');
    assert.equal(cur.ready, false);
    assert.ok(cur.understanding.services.indexOf('Colorbond ridge vents') >= 0);
    assert.ok(done.ready);
  });

  it('suggestApps includes sample SEO for expand UI', () => {
    const suggestions = suggestApps(
      {
        businessName: 'Metal Roof Vents',
        trade: 'Roof Ventilation',
        location: 'Australia',
        services: ['Ridge vents'],
      },
      ['hero']
    );
    assert.ok(suggestions[0].sampleSeo);
    assert.ok(suggestions[0].sampleSeo.h1);
    assert.equal(typeof suggestions[0].defaultSelected, 'boolean');
  });

  it('UI wires briefing chips, generate, create-site, auth, and app toggles', () => {
    assert.match(html, /id="btn-start-brief"/);
    assert.match(html, /id="interview-chips"/);
    assert.match(html, /id="btn-create-site"/);
    assert.match(html, /id="auth-status"/);
    assert.match(html, /createClient/);
    assert.match(html, /data-app-key/);
    assert.match(html, /Sample SEO/);
    assert.match(html, /\/api\/layout-composer\/interview/);
    assert.match(html, /\/api\/layout-composer\/create-site/);
    assert.match(html, /understanding/);
    const interviewApi = fs.readFileSync(path.join(root, 'api/layout-composer/interview.js'), 'utf8');
    const createApi = fs.readFileSync(path.join(root, 'api/layout-composer/create-site.js'), 'utf8');
    const generateApi = fs.readFileSync(path.join(root, 'api/layout-composer/generate.js'), 'utf8');
    const researchApi = fs.readFileSync(path.join(root, 'api/layout-composer/research.js'), 'utf8');
    assert.match(interviewApi, /startInterview/);
    assert.match(interviewApi, /generateInterviewTurn/);
    assert.match(interviewApi, /ai\.options/);
    assert.match(interviewApi, /understandingPatch/);
    assert.match(createApi, /fillConfigFromUnderstanding/);
    assert.match(generateApi, /understanding/);
    assert.match(generateApi, /generateResearchBrief/);
    assert.match(researchApi, /generateResearchBrief/);
  });

  it('never seeds roof-repair/gutter chips for roof ventilation manufacturers', () => {
    const { defaultServices } = require('../lib/layout-composer/interview');
    const started = startInterview({
      businessName: 'Corrugated Roof Vents',
      trade: 'Roof Ventilation Products',
      location: 'Australia',
    });
    const labels = (started.turn.options || []).map(function (o) { return o.label; });
    assert.ok(labels.length >= 3);
    labels.forEach(function (label) {
      assert.equal(/roof repairs|re-roofing|guttering|leak detection|skylights/i.test(label), false, label);
    });
    assert.ok(labels.some(function (l) { return /vent/i.test(l); }));
    assert.ok(/ventilation products/i.test(started.turn.question));

    // Free-text product line must refresh upcoming chips away from roofing-contractor defaults.
    const next = answerInterview(started.session, {
      freeText: 'We manufacture metal roof ventilators - a roof ventilation product.',
    });
    assert.ok(next.understanding.services.some(function (s) { return /ventilat/i.test(s); }));
    const q2 = (next.turn.options || []).map(function (o) { return o.label; }).join(' | ');
    assert.equal(/guttering|re-roofing|leak detection/i.test(q2), false, q2);

    const seeded = defaultServices({
      businessName: 'Corrugated Roof Vents',
      trade: 'Roof Ventilation Products',
      location: 'Australia',
      services: ['We manufacture metal roof ventilators'],
    });
    assert.ok(seeded.every(function (l) {
      return !/roof repairs|re-roofing|guttering|leak detection|skylights/i.test(l);
    }));
  });
});
