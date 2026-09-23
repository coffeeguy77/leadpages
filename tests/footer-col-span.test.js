/**
 * Footer columns can span 1 or 2 grid columns (wide text cards).
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

describe('Footer column span (1 or 2)', () => {
  it('manage exposes 1 column / 2 columns wide control', () => {
    assert.match(manage, /ft-col-span/);
    assert.match(manage, /1 column wide/);
    assert.match(manage, /2 columns wide/);
    assert.match(manage, /col\.span=\+t\.value===2\?2:1/);
  });

  it('renderer and CSS apply f-col-span-2 and f-nav-has-span', () => {
    assert.match(js, /f-col-span-2/);
    assert.match(js, /f-nav-has-span/);
    assert.match(js, /\+col\.span===2/);
    assert.match(css, /\.f-col\.f-col-span-2\{grid-column:span 2/);
    assert.match(css, /\.f-nav\.f-nav-has-span/);
    assert.match(css, /\.f-col\.f-col-span-2 \.f-col-card-box\{max-width:none\}/);
    assert.match(trade, /f-col-span-2/);
    assert.match(trade, /f-nav-has-span/);
  });
});
