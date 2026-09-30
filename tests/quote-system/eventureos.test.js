const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildIntakePayload, sendQuoteToEventureOS, settingsFor } = require('../../lib/quote-system/eventureos');

const session = { id: 'sess-1', site_id: 'site-a', contact_name: 'Sam Lee', contact_email: 'sam@example.com', contact_phone: '0400 000 000', progress: {} };
const version = {
  version_number: 3,
  inputs: { eventDate: '2026-12-05', guestCount: 120 },
  breakdown: [
    { label: 'Coffee cart', quantity: 1, unitCents: 25000, totalCents: 25000, kind: 'equipment' },
    { label: 'Barista', quantity: 4, unitCents: 9500, totalCents: 38000, kind: 'labour' },
    { label: 'Zero line', quantity: 0, unitCents: 100, totalCents: 0, kind: 'addon' },
    { label: 'Travel fee', quantity: 1, unitCents: 4000, totalCents: 4000, kind: 'travel' }
  ],
  subtotal_cents: 67000, gst_cents: 6700, total_cents: 73700
};

test('buildIntakePayload maps a quote version to EventureOS contract v1', function() {
  const p = buildIntakePayload({ session: session, version: version, stage: 'submitted' });
  assert.equal(p.external_id, 'sess-1');
  assert.equal(p.external_version, 3);
  assert.equal(p.stage, 'submitted');
  assert.equal(p.customer.email, 'sam@example.com');
  assert.equal(p.event.date, '2026-12-05');
  assert.equal(p.event.guests, 120);
  assert.equal(p.items.length, 3, 'zero-quantity rows are skipped');
  assert.deepEqual(p.items[1], { section: 'Staff', name: 'Barista', description: null, quantity: 4, unit: 'hours', unit_price: 95, tax_rate: 10 });
  assert.equal(p.items[2].section, 'Travel');
  assert.deepEqual(p.totals, { subtotal: 670, gst: 67, total: 737 });
  assert.equal(p.accepted_by, null);
});

test('buildIntakePayload: no GST when the business is not GST registered', function() {
  const p = buildIntakePayload({ session: session, version: Object.assign({}, version, { gst_cents: 0, total_cents: 67000 }) });
  assert.ok(p.items.every(function(i) { return i.tax_rate === 0; }));
});

test('buildIntakePayload: shift date and times, accepted stage', function() {
  const v = Object.assign({}, version, { inputs: { shifts: [{ date: '2026-11-01', startTime: '09:00', endTime: '13:00' }] } });
  const p = buildIntakePayload({ session: session, version: v, stage: 'accepted', acceptedBy: 'Sam Lee', portalUrl: 'https://x/quote-portal?t=1' });
  assert.equal(p.event.date, '2026-11-01');
  assert.equal(p.event.start_time, '09:00');
  assert.equal(p.event.end_time, '13:00');
  assert.equal(p.stage, 'accepted');
  assert.equal(p.accepted_by, 'Sam Lee');
});

test('connector is off unless key and matching site id are set', async function() {
  delete process.env.EVENTUREOS_INTAKE_KEY; delete process.env.EVENTUREOS_INTAKE_SITE_ID;
  assert.equal(settingsFor('site-a'), null);
  process.env.EVENTUREOS_INTAKE_KEY = 'eos_live_test';
  process.env.EVENTUREOS_INTAKE_SITE_ID = 'site-b, site-c';
  assert.equal(settingsFor('site-a'), null, 'other sites never send');
  assert.ok(settingsFor('site-c'));
  const r = await sendQuoteToEventureOS({ siteId: 'site-a', session: session, version: version });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'not_configured');
});

test('sendQuoteToEventureOS posts with the bearer key and never throws', async function() {
  process.env.EVENTUREOS_INTAKE_KEY = 'eos_live_test';
  process.env.EVENTUREOS_INTAKE_SITE_ID = 'site-a';
  process.env.EVENTUREOS_INTAKE_URL = 'https://example.invalid/intake';
  const realFetch = global.fetch;
  let seen = null;
  global.fetch = async function(url, init) {
    seen = { url: url, init: init };
    return { ok: true, status: 200, json: async function() { return { ok: true, outcome: 'created', quote_number: 'Q-1' }; } };
  };
  try {
    const ok = await sendQuoteToEventureOS({ siteId: 'site-a', session: session, version: version });
    assert.deepEqual(ok, { sent: true, outcome: 'created', quoteNumber: 'Q-1' });
    assert.equal(seen.url, 'https://example.invalid/intake');
    assert.equal(seen.init.headers.authorization, 'Bearer eos_live_test');
    assert.equal(JSON.parse(seen.init.body).external_id, 'sess-1');

    global.fetch = async function() { throw new Error('network down'); };
    const bad = await sendQuoteToEventureOS({ siteId: 'site-a', session: session, version: version });
    assert.equal(bad.sent, false);
  } finally {
    global.fetch = realFetch;
    delete process.env.EVENTUREOS_INTAKE_URL;
  }
});
