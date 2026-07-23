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

  it('activates landing_draft prompt v5 with hero + quote instructions', () => {
    assert.match(defaults, /version:\s*5/);
    assert.match(defaults, /heroSlides/);
    assert.match(defaults, /jobOptions/);
    assert.match(defaults, /status:\s*'active'/);
  });
});
