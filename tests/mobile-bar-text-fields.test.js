'use strict';

/**
 * Mobile action bar editor: text fields (labels, numbers, Directions address) must save.
 * They used a txt() helper that lives in a different function, so every call threw
 * "txt is not defined" and the Directions button opened Google Maps with a blank destination.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

test('mobile bar panel defines its own txt() before wiring the text fields', () => {
  const start = manage.indexOf("} else if(sub==='mobileBar'){");
  assert.ok(start > 0);
  const block = manage.slice(start, manage.indexOf("listEditor($('le-mobileExtras')", start));
  const def = block.indexOf('function txt(id,fn){');
  assert.ok(def > 0, 'local txt helper exists');
  assert.ok(def < block.indexOf("txt('mb-dir-address'"), 'defined before the Directions address is wired');
  assert.match(block, /function txt\(id,fn\)\{[^}]*persist\(\); previewApply\(\);/);
});
