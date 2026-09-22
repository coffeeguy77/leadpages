'use strict';

/**
 * Services — optional split columns mode (left copy + columns with list + links).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Services split columns mode', () => {
  it('manage.html exposes layout mode, split fields, and add column', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /function servicesModeCard/);
    assert.match(manage, /function wireServicesMode/);
    assert.match(manage, /id="svc-mode"/);
    assert.match(manage, /value="split".*Split columns \(text left\)/);
    assert.match(manage, /id="svc-accent-on"/);
    assert.match(manage, /svc-split-only/);
    assert.match(manage, /svc-bull-add/);
    assert.match(manage, /svc-link-act/);
    assert.match(manage, /Landing page on this site/);
    assert.match(manage, /App \/ section on this page/);
    assert.match(manage, /\+ Add column/);
    assert.match(manage, /sideImage/);
    assert.match(manage, /svc-sub/);
  });

  it('trade template renders split CSS and paint branch', () => {
    const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8'));
    const html = tpl.html;
    assert.match(html, /svcs-split/);
    assert.match(html, /svc-accent/);
    assert.match(html, /svc-bullets/);
    assert.match(html, /svc-cta/);
    assert.match(html, /svc-side/);
    assert.match(html, /mode==='split'/);
    assert.match(html, /function _svcLinkHref/);
    assert.match(html, /data-svc-scroll/);
    assert.match(html, /sideImage/);
    assert.match(html, /accentOn/);
    assert.match(html, /accentColor/);
  });

  it('demo-shared mirrors split render + CSS', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /mode==='split'/);
    assert.match(demo, /svc-bullets/);
    assert.match(demo, /function _svcLinkHref/);
    assert.match(demo, /data-svc-scroll/);
    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /svcs-split/);
    assert.match(css, /svc-cta/);
    assert.match(css, /svc-bullets/);
  });

  it('landing shell includes split layout', () => {
    const tpl = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8'));
    const html = tpl.html;
    assert.match(html, /svcs-split/);
    assert.match(html, /mode==='split'/);
    assert.match(html, /svc-cta/);
    assert.match(html, /function _svcLinkHref/);
  });
});
