'use strict';

const assert = require('assert');
const { digits } = require('../lib/google-ads/metrics-scope');

assert.equal(digits('386-242-0047'), '3862420047');
assert.equal(digits('8375352023'), '8375352023');
assert.equal(digits(null), '');

console.log('ads-metrics-scope.test.js: ok');
