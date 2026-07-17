'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseNegatives,
  filterServicesSummary,
  findNegativeHits,
  buildLandingBriefInput
} = require('../lib/brain/landing-brief');

describe('landing-brief', () => {
  it('parses comma-separated negatives', () => {
    assert.deepEqual(parseNegatives('coffee, barista, wedding'), [
      'coffee',
      'barista',
      'wedding'
    ]);
  });

  it('filters homepage services that collide with negatives', () => {
    const filtered = filterServicesSummary(
      'Coffee cart hire, Corporate catering, Mobile barista, Office lunches',
      ['coffee', 'barista', 'cart']
    );
    assert.match(filtered, /Corporate catering/i);
    assert.match(filtered, /Office lunches/i);
    assert.equal(/coffee|barista|cart/i.test(filtered), false);
  });

  it('detects negative hits in a coffee-leaking draft', () => {
    const hits = findNegativeHits(
      {
        meta: 'Professional barista service and specialty coffee',
        bodyMarkdown: 'Our mobile barista setup…'
      },
      ['coffee', 'barista', 'wedding']
    );
    assert.ok(hits.includes('coffee'));
    assert.ok(hits.includes('barista'));
    assert.equal(hits.includes('wedding'), false);
  });

  it('builds structured SEO brief with hard ban line', () => {
    const pack = buildLandingBriefInput({
      mode: 'seo',
      primaryKeyword: 'corporate catering',
      location: 'Canberra',
      negativeKeywords: 'coffee, barista, wedding',
      extraInfo: 'Offices only — delivered catering'
    });
    assert.equal(pack.mode, 'seo');
    assert.match(pack.brief, /corporate catering/i);
    assert.match(pack.brief, /NEGATIVE KEYWORDS/i);
    assert.match(pack.brief, /coffee/i);
    assert.equal(pack.primaryKeywordHint, 'corporate catering');
    assert.equal(pack.location, 'Canberra');
    assert.ok(pack.uniquenessSeed);
  });
});

describe('landing draft prompt v4', () => {
  it('is active and requires negative keyword compliance', () => {
    const { createPromptRegistry } = require('../lib/brain');
    const def = createPromptRegistry().get('content.landing_draft');
    assert.equal(def.version, 4);
    assert.match(def.system, /NEGATIVE KEYWORDS/i);
    assert.match(def.system, /SCOPE LOCK/i);
    assert.ok(def.variables.includes('negativeKeywords'));
    assert.ok(def.variables.includes('primaryKeywordHint'));
  });
});
