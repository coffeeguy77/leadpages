/**
 * Footer text-box card: button fill/outline, readable desktop width, hide on phones.
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

describe('Footer column card button fill / outline', () => {
  it('manage exposes fill and outline controls', () => {
    assert.match(manage, /ft-card-btnfill/);
    assert.match(manage, /ft-card-btnoutline/);
    assert.match(manage, /Fill background/);
    assert.match(manage, /Outline \/ stroke/);
    assert.match(manage, /cardBtnFill/);
    assert.match(manage, /cardBtnOutline/);
    assert.match(manage, /cardBtnStrokeColor/);
  });

  it('renderer applies outline / no-fill button classes', () => {
    assert.match(js, /f-col-card-btn-outline/);
    assert.match(js, /cardBtnFill!==false/);
    assert.match(js, /cardBtnOutline===true/);
    assert.match(css, /\.f-col-card-btn-outline/);
    assert.match(css, /--f-card-btn-stroke-w/);
    assert.match(trade, /f-col-card-btn-outline/);
  });

  it('keeps space between card text and button', () => {
    assert.match(css, /\.f-col-card-box\{[^}]*gap:16px/);
    assert.match(css, /\.f-col-card-btn\{[^}]*margin-top:4px/);
  });
});

describe('Footer column desktop width + phone visibility', () => {
  it('caps span-2 cards on desktop instead of full bleed', () => {
    assert.match(css, /\.f-col\.f-col-span-2 \.f-col-card-box\{max-width:min\(100%,420px\)\}/);
    assert.doesNotMatch(css, /\.f-col\.f-col-span-2 \.f-col-card-box\{max-width:none\}/);
    assert.match(css, /f-nav-has-span\{[^}]*max-content/);
    assert.match(trade, /max-width:min\(100%,420px\)/);
  });

  it('per-column Show on phones uses hideOnMobile / lp-hide-mobile', () => {
    assert.match(manage, /ft-col-showm/);
    assert.match(manage, /Show on phones/);
    assert.match(manage, /hideOnMobile=!t\.checked/);
    assert.match(js, /hideOnMobile===true\?' lp-hide-mobile'/);
    assert.match(trade, /lp-hide-mobile/);
  });
});
