/**
 * Bookings — unit tests (no live DB / Stripe).
 * Run: node --test tests/bookings-*.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUSES,
  canTransition,
  assertTransition,
  isBlockingStatus,
} = require('../lib/bookings/status');
const { quoteBooking } = require('../lib/bookings/pricing');
const { getAvailableSlots, explainUnavailable, openIntervalsForDay } = require('../lib/bookings/availability');
const {
  wallTimeToUtc,
  ymdInZone,
  addMinutes,
  rangesOverlap,
  zonedParts,
} = require('../lib/bookings/time');
const { toCents, formatAud } = require('../lib/bookings/money');

describe('status transitions', () => {
  it('allows pending → confirmed', () => {
    assert.equal(canTransition('pending', 'confirmed'), true);
  });
  it('blocks completed → pending', () => {
    assert.equal(canTransition('completed', 'pending'), false);
  });
  it('assertTransition throws', () => {
    assert.throws(() => assertTransition('cancelled', 'confirmed'));
  });
  it('blocking statuses occupy calendar', () => {
    assert.equal(isBlockingStatus('confirmed'), true);
    assert.equal(isBlockingStatus('cancelled'), false);
    assert.ok(STATUSES.includes('awaiting_payment'));
  });
});

describe('pricing', () => {
  const system = { gst_mode: 'inclusive', gst_rate_bps: 1000, payment_rule: 'fixed_deposit', deposit_amount_cents: 5000, currency: 'AUD' };

  it('fixed price with deposit', () => {
    const q = quoteBooking({
      system,
      service: { price_model: 'fixed', price_cents: 20000 },
    });
    assert.equal(q.total_cents, 20000);
    assert.equal(q.deposit_cents, 5000);
    assert.ok(q.gst_cents > 0);
  });

  it('per person', () => {
    const q = quoteBooking({
      system: { gst_mode: 'none', payment_rule: 'none' },
      service: { price_model: 'per_person', price_cents: 5000 },
      attendeeCount: 3,
    });
    assert.equal(q.subtotal_cents, 15000);
    assert.equal(q.total_cents, 15000);
  });

  it('quote required is zero', () => {
    const q = quoteBooking({
      system,
      service: { price_model: 'quote_required', price_cents: 99999 },
    });
    assert.equal(q.total_cents, 0);
    assert.equal(q.quote_required, true);
  });

  it('addons and exclusive GST', () => {
    const q = quoteBooking({
      system: { gst_mode: 'exclusive', gst_rate_bps: 1000, payment_rule: 'full_payment' },
      service: { price_model: 'fixed', price_cents: 10000 },
      addons: [{ price_cents: 2000, quantity: 1 }],
    });
    assert.equal(q.subtotal_cents, 10000);
    assert.equal(q.addons_cents, 2000);
    assert.equal(q.gst_cents, 1200);
    assert.equal(q.total_cents, 13200);
    assert.equal(q.deposit_cents, 13200);
  });
});

describe('time helpers', () => {
  it('Sydney wall time round-trip for a known date', () => {
    const d = wallTimeToUtc('2026-03-15', '09:00', 'Australia/Sydney');
    assert.equal(ymdInZone(d, 'Australia/Sydney'), '2026-03-15');
    const p = zonedParts(d, 'Australia/Sydney');
    assert.equal(p.hour, 9);
    assert.equal(p.minute, 0);
  });

  it('handles AEDT→AEST boundary week without throwing', () => {
    // First Sunday in April 2026 is DST end in AU
    const d = wallTimeToUtc('2026-04-05', '10:00', 'Australia/Sydney');
    assert.ok(d instanceof Date);
    assert.equal(ymdInZone(d, 'Australia/Sydney'), '2026-04-05');
  });

  it('rangesOverlap', () => {
    const a = new Date('2026-01-01T01:00:00Z');
    const b = new Date('2026-01-01T02:00:00Z');
    const c = new Date('2026-01-01T01:30:00Z');
    const d = new Date('2026-01-01T03:00:00Z');
    assert.equal(rangesOverlap(a, b, c, d), true);
    assert.equal(rangesOverlap(a, b, b, d), false);
  });
});

describe('availability', () => {
  const system = {
    timezone: 'Australia/Sydney',
    min_notice_minutes: 0,
    max_advance_days: 90,
    slot_interval_minutes: 30,
  };
  const service = {
    id: 'svc1',
    duration_minutes: 60,
    prep_minutes: 0,
    cleanup_minutes: 0,
    capacity: 1,
  };
  // 2026-06-08 is a Monday
  const businessRules = [
    { weekday: 1, start_time: '09:00', end_time: '12:00', is_break: false, active: true },
    { weekday: 1, start_time: '10:00', end_time: '10:30', is_break: true, active: true },
  ];

  it('openIntervalsForDay subtracts breaks', () => {
    const iv = openIntervalsForDay(businessRules, 1);
    assert.deepEqual(iv, [
      { start: 9 * 60, end: 10 * 60 },
      { start: 10 * 60 + 30, end: 12 * 60 },
    ]);
  });

  it('returns slots on an open day', () => {
    const r = getAvailableSlots({
      system,
      service,
      dateYmd: '2026-06-08',
      businessRules,
      existingBookings: [],
      holds: [],
      now: new Date('2026-06-01T00:00:00Z'),
    });
    assert.ok(r.slots.length > 0);
    assert.ok(r.slots.every((s) => s.localDate === '2026-06-08'));
  });

  it('blocks overlapping booking', () => {
    const occupiedStart = wallTimeToUtc('2026-06-08', '09:00', 'Australia/Sydney');
    const r = getAvailableSlots({
      system,
      service,
      dateYmd: '2026-06-08',
      businessRules,
      existingBookings: [
        {
          id: 'b1',
          status: 'confirmed',
          starts_at: occupiedStart.toISOString(),
          ends_at: addMinutes(occupiedStart, 60).toISOString(),
          service_id: 'svc1',
          attendee_count: 1,
        },
      ],
      holds: [],
      now: new Date('2026-06-01T00:00:00Z'),
    });
    assert.ok(!r.slots.some((s) => s.localTime === '09:00'));
  });

  it('explainUnavailable reports outside hours', () => {
    const start = wallTimeToUtc('2026-06-08', '07:00', 'Australia/Sydney');
    const ex = explainUnavailable({
      system,
      service,
      startsAt: start.toISOString(),
      businessRules,
      existingBookings: [],
      now: new Date('2026-06-01T00:00:00Z'),
    });
    assert.equal(ex.available, false);
    assert.ok(ex.checks.some((c) => c.code === 'hours' && c.blocking));
  });

  it('closed exception yields no slots', () => {
    const dayStart = wallTimeToUtc('2026-06-08', '00:00', 'Australia/Sydney');
    const r = getAvailableSlots({
      system,
      service,
      dateYmd: '2026-06-08',
      businessRules,
      exceptions: [
        {
          kind: 'closed',
          scope: 'business',
          starts_at: dayStart.toISOString(),
          ends_at: addMinutes(dayStart, 24 * 60).toISOString(),
        },
      ],
      now: new Date('2026-06-01T00:00:00Z'),
    });
    assert.equal(r.slots.length, 0);
    assert.equal(r.reasons[0].code, 'closed');
  });
});

describe('money', () => {
  it('toCents and formatAud', () => {
    assert.equal(toCents('70.50'), 7050);
    assert.equal(formatAud(7000), '$70.00');
  });
});
