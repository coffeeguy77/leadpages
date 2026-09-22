'use strict';

/**
 * Footer rebuild (LeadPages layout) + Services split intro/listTitle/CTA + title CAPS.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('LeadPages-style tenant footer', () => {
  it('manage.html exposes footer blocks, logo and columns', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /id="ft-logomode"/);
    assert.match(manage, /Custom footer logo/);
    assert.match(manage, /id="ft-cols"/);
    assert.match(manage, /id="ft-showsupport"/);
    assert.match(manage, /id="ft-showtagline"/);
    assert.match(manage, /logoHeight/);
    assert.match(manage, /logoOffsetX/);
  });

  it('trade template has marketing footer structure', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(html, /footer-top/);
    assert.match(html, /f-support/);
    assert.match(html, /f-tagline-accent/);
    assert.match(html, /foot-logo-wrap/);
    assert.match(html, /foot-hide-brand/);
    assert.doesNotMatch(html, /foot-grid/);
  });
});

describe('Services split column structure fixes', () => {
  it('paint includes intro, listTitle and full-width CTA', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(html, /svc-intro/);
    assert.match(html, /svc-list-title/);
    assert.match(html, /s\.listTitle/);
    assert.match(html, /svcs-split \.svc-cta\{[^}]*width:100%/);
  });

  it('manage editor has intro, list title and caps toggles', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /svc-intro/);
    assert.match(manage, /svc-list-title/);
    assert.match(manage, /svc-title-caps/);
    assert.match(manage, /svc-sub-caps/);
    assert.match(manage, /ALL CAPS/);
  });
});

describe('Title CAPS toggles', () => {
  it('secCard wires eyebrowCaps and headingCaps', () => {
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /eyebrowCaps/);
    assert.match(manage, /headingCaps/);
    assert.match(manage, /sec-'\+id\+'-'\+_capsKey/);
  });

  it('templates apply --lp-eyebrow-case / --lp-heading-case', () => {
    const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
    assert.match(html, /--lp-eyebrow-case/);
    assert.match(html, /--lp-heading-case/);
    assert.match(html, /text-transform:var\(--lp-eyebrow-case/);
  });
});
