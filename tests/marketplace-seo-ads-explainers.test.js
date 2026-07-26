'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appContent = require('../marketplace/app-content.json');
const sellTemplates = require('../marketplace/sell-templates.json');
const fieldDefs = require('../marketplace/playground-field-defs.json');
const { SECTION_CATEGORY } = require('../lib/marketplace-categories');
const featureHtml = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'lib/marketplace-catalog-seed.js'), 'utf8');

describe('marketplace SEO + Advertising explainers and demo gaps', () => {
  it('seeds SEO Command and Advertising as platform explainers without playground', () => {
    assert.equal(appContent.seoCommand.platformFeature, true);
    assert.equal(appContent.advertising.platformFeature, true);
    assert.ok(sellTemplates.seoCommand.blocks.every(function (b) { return b.block_type !== 'playground'; }));
    assert.ok(sellTemplates.advertising.blocks.every(function (b) { return b.block_type !== 'playground'; }));
    assert.equal(SECTION_CATEGORY.seoCommand, 'platform-tools');
    assert.equal(SECTION_CATEGORY.advertising, 'platform-tools');
    assert.match(seed, /isPlatformFeature/);
    assert.match(seed, /platformFeature/);
  });

  it('hides Try the demo CTA when there is no playground block', () => {
    assert.match(featureHtml, /block_type==='playground'/);
    assert.match(featureHtml, /Try the demo/);
  });

  it('has seoText / featureStrip / onlineQuote playground coverage + demos', () => {
    ['seoText', 'featureStrip', 'onlineQuote'].forEach(function (k) {
      assert.ok(appContent[k], k + ' app-content');
      assert.ok(sellTemplates[k], k + ' sell-template');
      assert.ok(fieldDefs[k], k + ' field defs');
      assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-' + k + '.html')), k + ' demo html');
    });
    assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-premiumGallery.html')));
    assert.equal(SECTION_CATEGORY.seoText, 'core-content');
  });

  it('SEO Text → FAQ spacing collapse is present', () => {
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    const tradeHtml = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(css, /seoText"\] \+ section\[data-sec="faq"\]\{padding-top:0\}/);
    assert.match(tradeHtml, /seoText"\] \+ section\[data-sec="faq"\]\{padding-top:0\}/);
    assert.match(css, /\.tb-section \.tb-row\{display:flex;gap:42px;align-items:flex-start\}/);
    assert.match(tradeHtml, /\.tb-section \.tb-row\{display:flex;gap:42px;align-items:flex-start\}/);
  });
});
