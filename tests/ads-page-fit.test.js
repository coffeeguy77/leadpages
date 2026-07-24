'use strict';

const assert = require('assert');
const {
  analyzePageFit,
  applyFixesToPage,
  keywordsFromPage,
  suggestRsaFromPage
} = require('../lib/google-ads/page-fit');

const thinPage = {
  id: 'p1',
  slug: 'coffee',
  title: 'Welcome',
  h1: '',
  meta: 'Hi',
  body: 'Short.'
};

const thin = analyzePageFit(thinPage, {
  keywords: [{ keyword: 'coffee cart hire canberra', approved: true, matchType: 'PHRASE' }]
});
assert.ok(thin.score < 55);
assert.ok(thin.fixes.length >= 1);
assert.ok(thin.issues.some((i) => i.id === 'thin_content' || i.id === 'missing_h1'));

const richPage = {
  id: 'p2',
  slug: 'coffee-cart-hire-canberra',
  title: 'Coffee Cart Hire Canberra | Coffee Events',
  h1: 'Coffee Cart Hire Canberra',
  meta: 'Book coffee cart hire in Canberra for events. Fast quotes from Coffee Events.',
  body:
    'Looking for coffee cart hire Canberra? We deliver baristas, machine and a polished guest experience. ' +
    'Request a quote today for weddings, corporates and festivals across the ACT. Call us to book your date. ' +
    Array(40).fill('Professional mobile coffee service for local events. ').join('')
};

const rich = analyzePageFit(richPage, {
  keywords: [{ keyword: 'coffee cart hire canberra', approved: true }],
  brand: 'Coffee Events',
  geo: 'Canberra'
});
assert.ok(rich.score >= 55, 'expected stronger score, got ' + rich.score);
assert.equal(rich.keywordScores[0].verdict === 'strong' || rich.keywordScores[0].score >= 70, true);

const rsa = suggestRsaFromPage(richPage, [{ keyword: 'coffee cart hire canberra' }], 'Canberra', 'Coffee Events');
assert.ok(rsa.headlines.length >= 3);
assert.ok(rsa.descriptions.length >= 2);
assert.ok(rsa.headlines[0].length <= 30);

const kws = keywordsFromPage(richPage, 'Canberra', 'Coffee Events');
assert.ok(kws.length >= 1);

const fixed = applyFixesToPage(thinPage, ['h1', 'meta', 'intro'], {
  keywords: [{ keyword: 'coffee cart hire canberra', approved: true }]
});
assert.ok(fixed.applied.indexOf('h1') >= 0 || fixed.applied.length >= 1);
assert.ok(fixed.page.h1 || fixed.page.meta || (fixed.page.body && fixed.page.body.length > thinPage.body.length));
assert.ok(fixed.analysis.score >= thin.score);

console.log('ads-page-fit.test.js: ok');
