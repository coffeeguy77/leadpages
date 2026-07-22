'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { logoDisplayUrl } = require('../lib/site-logo-url');

const ROOT = path.join(__dirname, '..');
const demo = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.js'), 'utf8');
const trade = fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8');

describe('logoDisplayUrl', () => {
  it('adds Cloudinary h_ + q_auto:best for small CSS heights', () => {
    const url = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1/leadpages/x/logo/abc.png';
    const out = logoDisplayUrl(url, 44, { dpr: 2 });
    assert.match(out, /\/upload\/h_\d+,q_auto:best,f_auto,c_limit\//);
    const h = Number(out.match(/h_(\d+)/)[1]);
    assert.ok(h >= 64 && h <= 640);
    assert.ok(h > 44); // larger than CSS height for retina
  });

  it('leaves non-Cloudinary and already-transformed URLs alone', () => {
    assert.equal(logoDisplayUrl('https://example.com/logo.png', 44), 'https://example.com/logo.png');
    const done = 'https://res.cloudinary.com/x/image/upload/h_120,q_auto/v1/a.png';
    assert.equal(logoDisplayUrl(done, 44), done);
  });
});

describe('trade logo render uses sized delivery', () => {
  it('demo-shared and trade template call _lpLogoUrl / q_auto:best', () => {
    assert.match(demo, /function _lpLogoUrl/);
    assert.match(demo, /q_auto:best,f_auto,c_limit/);
    assert.match(demo, /_logoSrc2/);
    assert.match(trade, /_lpLogoUrl/);
    assert.match(trade, /q_auto:best/);
  });
});
