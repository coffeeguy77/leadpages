'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('dashboard recent orders excludes archived queue statuses', function () {
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'order', 'dashboard.js'), 'utf8');
  const recentBlock = src.slice(src.indexOf('const { data: recent }'), src.indexOf('const { data: depositPaidRows }'));
  assert.match(
    recentBlock,
    /\.not\('status',\s*'in',\s*'\("cancelled","draft","archived","completed","refunded"\)'\)/
  );
});
