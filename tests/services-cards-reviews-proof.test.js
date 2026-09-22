'use strict';

/**
 * Homepage-style Services image cards + Reviews proof cards.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Services image cards (homepage)', () => {
  it('manage.html exposes cards layout and size/colour controls', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /Image cards \(homepage\)/);
    assert.match(manage, /id="svc-cards-opts"/);
    assert.match(manage, /id="svc-ico-sz"/);
    assert.match(manage, /iconCircleSize/);
    assert.match(manage, /cardTitleColor/);
    assert.match(manage, /sectionBg/);
  });

  it('trade template renders svcs-cards CSS and paint', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(html, /svcs-cards/);
    assert.match(html, /svc-cap-media/);
    assert.match(html, /svc-cap-ico/);
    assert.match(html, /svc-cap-body/);
    assert.match(html, /mode==='cards'/);
    assert.match(html, /--svc-ico-size/);
  });

  it('demo-shared mirrors cards layout', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /svc-cap-media/);
    assert.match(demo, /mode==='cards'/);
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /svcs-cards/);
    assert.match(css, /svc-cap-ico/);
  });
});

describe('Reviews homepage proof cards', () => {
  it('manage.html exposes proof layout and review photo/metric fields', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /function reviewsModeCard/);
    assert.match(manage, /function wireReviewsMode/);
    assert.match(manage, /Homepage proof cards/);
    assert.match(manage, /id="rv-mode"/);
    assert.match(manage, /id="rv-proof-opts"/);
    assert.match(manage, /k:'metric'/);
    assert.match(manage, /k:'metricLabel'/);
    assert.match(manage, /Photo \(proof layout\)/);
  });

  it('trade template renders rv-proof / tcard markup', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(html, /rv-proof/);
    assert.match(html, /rv-tcard/);
    assert.match(html, /t-metric/);
    assert.match(html, /avatar-col/);
    assert.match(html, /mode==='proof'/);
    assert.match(html, /demo-note/);
  });

  it('demo-shared mirrors proof reviews', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /rv-tcard/);
    assert.match(demo, /mode==='proof'/);
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /rv-proof/);
    assert.match(css, /t-metric/);
  });

  it('landing shell includes both new layouts', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8')).html;
    assert.match(html, /svcs-cards/);
    assert.match(html, /rv-proof/);
    assert.match(html, /svc-cap-ico/);
    assert.match(html, /rv-tcard/);
  });
});
