'use strict';

const assert = require('assert');
const { normalizeAdsTagId } = require('../lib/google-ads/tag-id');

assert.equal(normalizeAdsTagId('AW-1234567890'), 'AW-1234567890');
assert.equal(normalizeAdsTagId('aw-999'), 'AW-999');
assert.equal(normalizeAdsTagId('1234567890'), 'AW-1234567890');
assert.equal(normalizeAdsTagId('  AW-5555555555  '), 'AW-5555555555');
assert.equal(normalizeAdsTagId('gtag("config", "AW-1112223333");'), 'AW-1112223333');
assert.equal(normalizeAdsTagId(''), '');
assert.equal(normalizeAdsTagId('G-XXXX'), '');

console.log('ads-tag-id.test.js: ok');
