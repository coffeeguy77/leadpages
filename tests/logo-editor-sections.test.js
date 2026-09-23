/**
 * Logo editor restructured into Logo image / Desktop / Mobile / Header cards,
 * with independent mobile trim, offsets, padding — and mobile CSS that no longer
 * forces height:auto (which strangled cropped logos).
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

describe('Logo editor section cards', () => {
  it('manage exposes four standalone cards', () => {
    assert.match(manage, /<h2[^>]*>Logo image<\/h2>/);
    assert.match(manage, /<h2[^>]*>Desktop<\/h2>/);
    assert.match(manage, /<h2[^>]*>Mobile<\/h2>/);
    assert.match(manage, /<h2[^>]*>Header bar<\/h2>/);
    assert.doesNotMatch(manage, /Size, position &amp; background/);
  });

  it('desktop and mobile each have height, trim and placement', () => {
    assert.match(manage, /id="lg-hd"/);
    assert.match(manage, /id="lg-hm"/);
    assert.match(manage, /id="lg-crop"/);
    assert.match(manage, /id="lg-cropm"/);
    assert.match(manage, /id="lg-cropm-focus"/);
    assert.match(manage, /id="lg-offxm"/);
    assert.match(manage, /id="lg-offym"/);
    assert.match(manage, /id="lg-hbar-padm"/);
    assert.match(manage, /id="lg-valign-m"/);
    assert.match(manage, /Trim unused space <span class="hint">\(desktop\)<\/span>/);
    assert.match(manage, /Trim unused space <span class="hint">\(mobile\)<\/span>/);
  });
});

describe('Independent mobile logo paint', () => {
  it('mobile offsets default to 0 (not desktop) and cropYM is separate', () => {
    assert.match(js, /offsetXM!=null&&L\.offsetXM!==''\)\?Math\.max\(-120,Math\.min\(120,\+L\.offsetXM\|\|0\)\):0/);
    assert.match(js, /offsetYM!=null&&L\.offsetYM!==''\)\?Math\.max\(-120,Math\.min\(120,\+L\.offsetYM\|\|0\)\):0/);
    assert.match(js, /cropYM!=null/);
    assert.match(js, /_cropScaleM/);
    assert.match(js, /headerBarPaddingM/);
    assert.match(js, /headerLogoAlignM/);
    assert.match(trade, /cropYM!=null/);
    assert.match(trade, /headerBarPaddingM/);
  });

  it('static mobile CSS no longer forces height:auto on logos', () => {
    assert.match(css, /max-width:min\(92vw,440px\)/);
    assert.match(css, /height:var\(--hdr-logo-mh,48px\)!important/);
    assert.doesNotMatch(css, /a\.brand img\.lp-logo\{[^}]*height:auto!important/);
    assert.match(trade, /max-width:min\(92vw,440px\)/);
    assert.doesNotMatch(trade, /a\.brand img\.lp-logo\{[^}]*height:auto!important/);
  });

  it('wireLogoSize persists mobile trim and bar padding', () => {
    assert.match(manage, /L\.cropYM=v/);
    assert.match(manage, /L\.cropFocusM=/);
    assert.match(manage, /L\.headerBarPaddingM=/);
    assert.match(manage, /L\.headerLogoAlignM=/);
  });
});
