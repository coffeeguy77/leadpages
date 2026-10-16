'use strict';

/**
 * Mobile bar Directions: never opens Google Maps with a blank destination. It uses the button's
 * address, then the site / Map & Hours address, then the business name; with none, it is hidden.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shared = fs.readFileSync(path.join(root, 'marketplace', 'demos', 'demo-shared.js'), 'utf8');
const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

test('directions falls back to Map & Hours address and business name, else hides', () => {
  for (const src of [shared, tpl]) {
    assert.match(src, /var _mhAd=\(_SC\.sections&&_SC\.sections\.mapHours&&_SC\.sections\.mapHours\.address\)\|\|''/);
    assert.match(src, /String\(_SC\.businessName\|\|_SC\.name\|\|''\)\.trim\(\); if\(_d\.on&&_addr\)\{/);
    assert.doesNotMatch(src, /_SC\.address\|\|_SC\.businessName\|\|''; _btns\.push/);
  }
});

test('editor warns when Directions is on without an address', () => {
  assert.match(manage, /id="mb-dir-warn"/);
  assert.match(manage, /function _mbDirWarn\(\)/);
});
