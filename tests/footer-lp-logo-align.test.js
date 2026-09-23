/**
 * LeadPages logo in site footer aligns with bottom tagline top.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

test('LeadPages footer logo sits beside tagline with top alignment', function () {
  assert.match(css, /foot-lp-logo-slot \.footer-bottom/);
  assert.match(css, /grid-template-areas:"tagline logo" "meta meta"/);
  assert.match(css, /footer-bottom > \.f-links\.f-links-lp-logo\{[^}]*align-self:start/);
  assert.match(js, /insertBefore\(linksNav/);
  assert.match(js, /parentElement!==bottomRow/);
  assert.match(js, /Sit beside the tagline/);
  assert.match(trade, /foot-lp-logo-slot \.footer-bottom/);
  assert.match(trade, /insertBefore\(linksNav/);
});
