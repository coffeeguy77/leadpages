'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');

test('staff New Order can add the same product again with different options', function () {
  assert.match(html, /data-fast-another/);
  assert.match(html, /\+ Another/);
  assert.match(html, /noExtraLines: \[\]/);
  // Kept lines go to the order, are listed in the cart and can be removed.
  assert.match(html, /var kept = \(state\.noExtraLines \|\| \[\]\)/);
  assert.match(html, /key: 'extra:' \+ x\.key/);
  assert.match(html, /key\.indexOf\('extra:'\) === 0/);
});

test('kept lines are saved in the draft and cleared with the cart', function () {
  assert.match(html, /noExtraLines: state\.noExtraLines \|\| \[\]/);
  assert.match(html, /state\.noExtraLines = Array\.isArray\(pf\.noExtraLines\)/);
  const resets = html.match(/state\.noFastAdded = \{\};\s*state\.noExtraLines = \[\];/g) || [];
  assert.equal(resets.length, 3);
  // "Anything in the cart" checks include kept lines.
  assert.match(html, /function noHasItems\(\)/);
});
