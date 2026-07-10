const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeSiteConfig, shouldSkipTemplateApp } = require('../../lib/quote-system/sanitize');
const { subscriptionIsActive } = require('../../lib/quote-system/billing');

test('sanitizeSiteConfig — disables onlineQuote and strips ghost bindings', function() {
  const cfg = {
    businessName: 'Test Co',
    quoteSystemId: 'qs-123',
    sections: {
      quote: { on: true, heading: 'Quote' },
      onlineQuote: {
        on: true,
        __ghost: true,
        quoteSystemId: 'qs-456',
        heading: 'Get a quote'
      }
    },
    sectionOrder: ['quote', 'onlineQuote']
  };
  const out = sanitizeSiteConfig(cfg);
  assert.equal(out.businessName, 'Test Co');
  assert.equal(out.quoteSystemId, undefined);
  assert.equal(out.sections.quote.on, true);
  assert.equal(out.sections.onlineQuote.on, false);
  assert.equal(out.sections.onlineQuote.__ghost, undefined);
  assert.equal(out.sections.onlineQuote.quoteSystemId, undefined);
  assert.equal(out.sections.onlineQuote.heading, 'Get a quote');
  assert.deepEqual(out.sectionOrder, ['quote', 'onlineQuote']);
});

test('sanitizeSiteConfig — no-op when onlineQuote absent', function() {
  const cfg = { sections: { quote: { on: true } } };
  const out = sanitizeSiteConfig(cfg);
  assert.equal(out.sections.quote.on, true);
  assert.equal(out.sections.onlineQuote, undefined);
});

test('shouldSkipTemplateApp — onlineQuote only', function() {
  assert.equal(shouldSkipTemplateApp('onlineQuote'), true);
  assert.equal(shouldSkipTemplateApp('quote'), false);
});

test('subscriptionIsActive — active and grace-period cancelled', function() {
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(subscriptionIsActive({ status: 'active' }), true);
  assert.equal(subscriptionIsActive({ status: 'trialing' }), true);
  assert.equal(subscriptionIsActive({ status: 'cancelled', access_until: future }), true);
  assert.equal(subscriptionIsActive({ status: 'cancelled', access_until: '2020-01-01' }), false);
  assert.equal(subscriptionIsActive(null), false);
});
