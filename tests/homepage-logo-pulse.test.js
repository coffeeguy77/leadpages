/**
 * Homepage logos should not pulse forever (reads as "still loading").
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'home.html'), 'utf8');

test('homepage header and footer logos do not use perpetual pulse', () => {
  assert.match(home, /class="leadpages-logo"/);
  assert.doesNotMatch(home, /data-lp-logo-pulse/);
  assert.equal((home.match(/data-lp-logo="auto"/g) || []).length >= 2, true);
});

test('connected wire sync skips duplicate ResizeObserver sizes', () => {
  assert.match(home, /lastWireSize/);
  assert.match(home, /if \(key === lastWireSize\) return;/);
});
