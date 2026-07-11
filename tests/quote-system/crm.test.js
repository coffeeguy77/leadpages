const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildQuoteLeadContent } = require('../../lib/quote-system/crm');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../../lib/quote-system/bean-culture-config');
const { calculateQuote } = require('../../lib/quote-system/calculator');

test('buildQuoteLeadContent — includes quote summary and breakdown', function() {
  const calc = calculateQuote(BEAN_CULTURE_QUOTE_CONFIG, {
    productId: 'coffee-cart',
    hours: 3,
    guestCount: 80,
    beverageId: 'espresso-package',
    addonIds: ['cup-branding'],
    travelZoneId: 'greater-sydney'
  });
  const session = {
    id: 'sess-1',
    contact_name: 'Shaun Test',
    email_verified_at: new Date().toISOString(),
    sms_verified_at: null
  };
  const payload = buildQuoteLeadContent(session, calc, BEAN_CULTURE_QUOTE_CONFIG);

  assert.match(payload.message, /Online quote — \$[\d,]+\.\d{2}/);
  assert.match(payload.message, /Coffee Cart/);
  assert.match(payload.message, /Espresso-based drinks package/);
  assert.match(payload.message, /Custom cup branding/);
  assert.equal(payload.details.productLabel, 'Coffee Cart');
  assert.equal(payload.details.totalFormatted, payload.details.totalFormatted);
  assert.ok(payload.details.breakdownSummary.length > 0);
  assert.equal(payload.details.emailVerified, true);
  assert.equal(payload.details.smsVerified, false);
});
