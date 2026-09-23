/**
 * Logo mobile height slider must drive --hdr-logo-mh (static CSS was capping at 48px).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

test('mobile logo height sets --hdr-logo-mh from heightPxM', function () {
  assert.match(js, /heightPxM!=null/);
  assert.match(js, /setProperty\('--hdr-logo-mh'/);
  assert.match(js, /--hdr-logo-mh:'\+_lhm\+'px/);
  assert.match(js, /max-height:'\+\(_cropYM\?_imgHm:_lhm\)\+'px!important|max-height:'\+_lhm\+'px!important/);
  assert.match(css, /max-height:var\(--hdr-logo-mh,48px\)!important/);
  assert.match(manage, /id="lg-hm"/);
  assert.match(manage, /L\.heightPxM=v/);
  assert.match(trade, /--hdr-logo-mh/);
  assert.match(trade, /heightPxM!=null/);
});
