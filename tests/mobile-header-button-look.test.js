/**
 * Mobile header CTA show/hide + site-wide Button look (law).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

describe('Mobile header CTA', () => {
  it('editor exposes Show on phones tick', () => {
    assert.match(manage, /hd-showm/);
    assert.match(manage, /Show on phones/);
    assert.match(manage, /showOnMobile/);
  });

  it('renderer hides header CTA on phones when showOnMobile is false', () => {
    assert.match(js, /lp-hdr-cta-hide-m/);
    assert.match(js, /showOnMobile===false/);
    assert.match(css, /lp-hdr-cta-hide-m/);
    assert.match(css, /header\.site\.lp-hdr-cta-hide-m \.head-call\{display:none!important\}/);
  });

  it('restyles mobile header CTA as a compact card under the logo', () => {
    assert.match(css, /header\.site \.head-call\{[\s\S]*?flex:1 1 100%/);
    assert.match(css, /border-radius:12px/);
    assert.match(trade, /lp-hdr-cta-hide-m/);
  });
});

describe('Site Button look (law)', () => {
  it('defines shared helpers and defaults in manage', () => {
    assert.match(manage, /DEFAULT_BUTTON_LOOK/);
    assert.match(manage, /lpBtnLookFieldsHtml/);
    assert.match(manage, /lpBtnStrokeOptsHtml/);
    assert.match(manage, /lpLandingPageOptsHtml/);
    assert.match(manage, /LP_BTN_STROKE_PRESETS/);
    assert.match(manage, /Fine \(1px\)/);
    assert.match(manage, /Normal \(2\.5px\)/);
  });

  it('exposes Branding → Button look controls', () => {
    assert.match(manage, /site-button-look-card/);
    assert.match(manage, /wireButtonLook/);
    assert.match(manage, /Primary buttons \(Call \/ CTA\)/);
    assert.match(manage, /Secondary \/ outline buttons/);
  });

  it('applies config.buttonLook as CSS variables', () => {
    assert.match(js, /function applyButtonLook/);
    assert.match(js, /--lp-btn-bg/);
    assert.match(js, /--lp-btn-fg/);
    assert.match(js, /--lp-btn-stroke/);
    assert.match(js, /--lp-btn-stroke-w/);
    assert.match(css, /--lp-btn-bg/);
    assert.match(css, /\.btn-call\.lp-btn-outline/);
    assert.match(trade, /applyButtonLook/);
    assert.match(trade, /--lp-btn-bg/);
  });

  it('header CTA uses Button look + link targets (app / landing / URL)', () => {
    assert.match(manage, /lpBtnLinkFieldsHtml\('hd'/);
    assert.match(manage, /Custom app position/);
    assert.match(manage, /Landing page/);
    assert.match(manage, /URL \(_blank\)/);
    assert.match(js, /H\.linkPage/);
    assert.match(js, /H\.linkUrl/);
    assert.match(js, /btnStrokeWidth/);
  });

  it('footer cards include stroke thickness + landing page picker', () => {
    assert.match(manage, /ft-card-btnsw/);
    assert.match(manage, /cardBtnStrokeWidth/);
    assert.match(manage, /lpLandingPageOptsHtml\(page\)/);
    assert.match(js, /cardBtnStrokeWidth/);
  });

  it('hero slides support page / URL actions and stroke thickness', () => {
    assert.match(manage, /primaryCtaPage/);
    assert.match(manage, /primaryCtaStrokeWidth/);
    assert.match(manage, /type:'landingPage'/);
    assert.match(js, /CtaPage/);
    assert.match(js, /CtaStrokeWidth/);
  });
});

describe('Build docs — Button look is law', () => {
  it('documents Button look in design system and coding standards', () => {
    const design = fs.readFileSync(path.join(root, 'docs/11-DESIGN-SYSTEM.md'), 'utf8');
    const standards = fs.readFileSync(path.join(root, 'docs/12-CODING-STANDARDS.md'), 'utf8');
    assert.match(design, /Button look/);
    assert.match(standards, /Button look/);
    assert.match(design, /config\.buttonLook/);
  });
});
