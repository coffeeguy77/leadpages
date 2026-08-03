'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const demoShared = fs.readFileSync(
  path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'),
  'utf8'
);
const defaults = fs.readFileSync(
  path.join(__dirname, '..', 'lib/brain/prompts/defaults.js'),
  'utf8'
);

describe('Landing page hero + quote defaults', () => {
  it('removes Call / Get a quote toggles from the LP editor', () => {
    assert.equal(/id="lp-cta-call"/.test(manage), false);
    assert.equal(/id="lp-cta-quote"/.test(manage), false);
    assert.equal(/Show the .Call. button/.test(manage), false);
    assert.equal(/Show the .Get a free quote. button/.test(manage), false);
  });

  it('wires default Hero Slider + Quote apps and AI apply helpers', () => {
    assert.match(manage, /function lpEnsureDefaultLandingApps/);
    assert.match(manage, /function lpPinHeroArticleQuote/);
    assert.match(manage, /function lpApplyDraftHeroAndQuote/);
    assert.match(manage, /lpEnsureDefaultLandingApps\(p\)/);
    assert.match(manage, /lpApplyDraftHeroAndQuote\(draft\)/);
    assert.match(manage, /heroSlider/);
    assert.match(manage, /jobOptions/);
  });

  it('does not render article Call / Quote CTAs in demo-shared', () => {
    const start = demoShared.indexOf('function _lpArticleBlock(p){');
    const end = demoShared.indexOf('function _lpPageLayoutOrder(p){');
    assert.ok(start >= 0 && end > start);
    const block = demoShared.slice(start, end);
    assert.equal(/showCall/.test(block), false);
    assert.equal(/showQuote/.test(block), false);
    assert.equal(/lp-btn lp-call/.test(block), false);
    assert.equal(/Get a free quote/.test(block), false);
  });

  it('activates landing_draft prompt v6 with a single hero slide', () => {
    assert.match(defaults, /version:\s*6/);
    assert.match(defaults, /EXACTLY ONE object/i);
    const { DEFAULT_PROMPTS } = require('../lib/brain/prompts/defaults');
    const landing = DEFAULT_PROMPTS.filter(function (d) {
      return d && d.promptId === 'content.landing_draft';
    });
    const active = landing.filter(function (d) {
      return d.status === 'active';
    });
    assert.ok(active.length >= 1);
    const latest = active[active.length - 1];
    assert.equal(latest.version, 6);
    assert.match(latest.system, /EXACTLY ONE|exactly 1/i);
    const v5 = landing.find(function (d) {
      return d.version === 5;
    });
    assert.ok(v5);
    assert.equal(v5.status, 'deprecated');
  });

  it('applies at most one AI hero slide and defaults wrap-right image placement', () => {
    assert.match(manage, /lpApplyDraftHeroAndQuote[\s\S]{0,2000}\.slice\(0,1\)/);
    assert.match(manage, /imgMode:'wrap-right'/);
    assert.match(manage, /imgMode\|\|'wrap-right'/);
    assert.match(demoShared, /imgMode\|\|'wrap-right'/);
  });
});
