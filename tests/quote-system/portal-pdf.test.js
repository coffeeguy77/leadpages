const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildQuotePdfBuffer } = require('../../lib/quote-system/pdf');
const { canAccessPortal } = require('../../lib/quote-system/portal');
const { SESSION_STATUS } = require('../../lib/quote-system/constants');

test('canAccessPortal — requires SMS verification or accepted status', function() {
  assert.equal(canAccessPortal(null), false);
  assert.equal(canAccessPortal({ sms_verified_at: null, status: SESSION_STATUS.SUBMITTED }), false);
  assert.equal(canAccessPortal({ sms_verified_at: '2026-01-01', status: SESSION_STATUS.SUBMITTED }), true);
  assert.equal(canAccessPortal({ status: SESSION_STATUS.ACCEPTED }), true);
});

test('buildQuotePdfBuffer — returns a PDF buffer with content', async function() {
  const buf = await buildQuotePdfBuffer({
    businessName: 'Bean Culture Coffee Cart Hire',
    contactName: 'Alex',
    contactEmail: 'alex@example.com',
    quote: {
      breakdown: [
        { label: 'Coffee Cart', quantity: 1, totalCents: 45000 },
        { label: 'Labour', quantity: 3, totalCents: 22500 }
      ],
      subtotalCents: 67500,
      gstCents: 6750,
      totalCents: 74250,
      totalFormatted: '$742.50'
    },
    accepted: false
  });
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 500);
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
});

test('buildQuotePdfBuffer — accepted quote still produces valid PDF', async function() {
  const buf = await buildQuotePdfBuffer({
    businessName: 'Test Co',
    quote: {
      breakdown: [{ label: 'Item', quantity: 1, totalCents: 10000 }],
      subtotalCents: 10000,
      gstCents: 1000,
      totalCents: 11000
    },
    accepted: true,
    acceptedAt: '2026-07-10T12:00:00.000Z'
  });
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 500);
});
