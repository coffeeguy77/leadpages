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

  it('UI wires briefing chips, generate, and create-site', () => {
    assert.match(html, /id="btn-start-brief"/);
    assert.match(html, /id="interview-chips"/);
    assert.match(html, /id="btn-create-site"/);
    assert.match(html, /\/api\/layout-composer\/interview/);
    assert.match(html, /\/api\/layout-composer\/create-site/);
    assert.match(html, /understanding/);
    const interviewApi = fs.readFileSync(path.join(root, 'api/layout-composer/interview.js'), 'utf8');
    const createApi = fs.readFileSync(path.join(root, 'api/layout-composer/create-site.js'), 'utf8');
    const generateApi = fs.readFileSync(path.join(root, 'api/layout-composer/generate.js'), 'utf8');
    assert.match(interviewApi, /startInterview/);
    assert.match(createApi, /fillConfigFromUnderstanding/);
    assert.match(generateApi, /understanding/);
  });
});
