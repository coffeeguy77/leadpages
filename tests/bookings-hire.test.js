'use strict';

/**
 * Hire engine unit tests (no DB / Stripe / OAuth).
 * Run: node --test tests/bookings-hire.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeHireWindow,
  DEFAULT_SINGLE_BLOCK_MINUTES,
  listOccupiedDays
} = require('../lib/bookings/hire/duration');
const {
  checkDailyCapacity,
  checkResourceConflict,
  checkHireAvailability,
  maxDailyJobs
} = require('../lib/bookings/hire/capacity');
const { quoteHire, priceChangeDiff } = require('../lib/bookings/hire/pricing');
const {
  calculateCancellation,
  rescheduleFeeFloor,
  defaultRules
} = require('../lib/bookings/hire/cancellation');
const {
  isHireBookingLocked,
  assertMutableSchedule,
  calendarEventFlags,
  unlockPayload,
  relockPayload
} = require('../lib/bookings/hire/lock');
const {
  resolveTerminology,
  applyTemplate,
  defaultEventTitleTemplate
} = require('../lib/bookings/hire/terminology');
const { fundingLabel } = require('../lib/bookings/hire/card-on-file');
const { buildCalendarEvent } = require('../lib/bookings/hire/google');

const system = {
  timezone: 'Australia/Sydney',
  gst_mode: 'inclusive',
  gst_rate_bps: 1000,
  payment_rule: 'card_guarantee',
  currency: 'AUD',
  settings: {
    hire: {
      max_daily_hire_jobs: 4,
      allow_calendar_drag: false,
      terminology: { singular: 'Truck', plural: 'Trucks', customer: 'Hirer' },
      default_duration_minutes: 1435
    }
  }
};

function windowFor(ymd, hm, mode, hireDays) {
  return computeHireWindow({
    pickupYmd: ymd,
    pickupHm: hm || '09:00',
    timezone: 'Australia/Sydney',
    durationMode: mode || 'single_block',
    hireDays: hireDays,
    system: system
  });
}

describe('hire duration', () => {
  it('defaults to 23h55 timed block (not all-day)', () => {
    const w = windowFor('2026-10-01', '09:00');
    assert.equal(w.ok, true);
    assert.equal(w.default_duration_minutes, DEFAULT_SINGLE_BLOCK_MINUTES);
    assert.equal(w.elapsed_minutes, 1435);
    assert.equal(w.google_event.all_day, false);
    assert.ok(w.google_event.start.dateTime);
    assert.ok(!w.google_event.start.date);
    assert.deepEqual(w.occupied_days, ['2026-10-01']);
  });

  it('supports configurable 23h59', () => {
    const w = computeHireWindow({
      pickupYmd: '2026-10-01',
      pickupHm: '08:00',
      timezone: 'Australia/Sydney',
      durationMode: 'single_block',
      system: {
        timezone: 'Australia/Sydney',
        settings: { hire: { default_duration_minutes: 1439 } }
      }
    });
    assert.equal(w.elapsed_minutes, 1439);
  });

  it('multi-day spans occupied days with half-open end', () => {
    const w = windowFor('2026-10-01', '09:00', 'multi_day', 3);
    assert.equal(w.hire_days, 3);
    assert.deepEqual(w.occupied_days, ['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('handles month boundary', () => {
    const w = windowFor('2026-10-31', '10:00', 'multi_day', 2);
    assert.deepEqual(w.occupied_days, ['2026-10-31', '2026-11-01']);
  });

  it('handles year boundary', () => {
    const w = windowFor('2026-12-31', '10:00', 'multi_day', 2);
    assert.deepEqual(w.occupied_days, ['2026-12-31', '2027-01-01']);
  });

  it('keeps timed events across Sydney DST spring-forward', () => {
    // Australia/Sydney DST starts first Sunday in October 2026 (2026-10-04)
    const w = windowFor('2026-10-03', '09:00', 'multi_day', 2);
    assert.equal(w.ok, true);
    assert.equal(w.google_event.all_day, false);
    assert.ok(w.google_event.start.dateTime);
    assert.ok(w.google_event.end.dateTime);
    assert.deepEqual(w.occupied_days, ['2026-10-03', '2026-10-04']);
  });

  it('listOccupiedDays is half-open', () => {
    const w = windowFor('2026-10-02', '09:00');
    assert.deepEqual(
      listOccupiedDays(new Date(w.pickup_at), new Date(w.return_at), 'Australia/Sydney'),
      ['2026-10-02']
    );
  });
});

describe('hire capacity', () => {
  function mk(id, start, end, status) {
    return {
      id: id,
      booking_id: id,
      resource_id: 'truck-1',
      starts_at: start,
      ends_at: end,
      status: status || 'confirmed'
    };
  }

  it('allows first four jobs then blocks the fifth', () => {
    const w = windowFor('2026-10-02', '09:00');
    const existing = [1, 2, 3, 4].map(function (n) {
      return mk('b' + n, w.pickup_at, w.return_at, 'confirmed');
    });
    const blocked = checkDailyCapacity({
      system: system,
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      existingBookings: existing
    });
    assert.equal(blocked.ok, false);
    assert.ok((blocked.over_days || []).length > 0);

    const staff = checkDailyCapacity({
      system: system,
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      existingBookings: existing,
      override: true
    });
    assert.equal(staff.ok, true);
  });

  it('multi-day consumes capacity on every occupied day', () => {
    const w = windowFor('2026-10-02', '09:00', 'multi_day', 3);
    const existing = [1, 2, 3, 4].map(function (n) {
      return mk('x' + n, w.pickup_at, w.return_at, 'confirmed');
    });
    const r = checkDailyCapacity({
      system: system,
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      existingBookings: existing
    });
    assert.equal(r.ok, false);
    assert.ok(r.over_days.indexOf('2026-10-02') >= 0);
    assert.ok(r.over_days.indexOf('2026-10-03') >= 0);
    assert.ok(r.over_days.indexOf('2026-10-04') >= 0);
  });

  it('same resource cannot overlap even under capacity', () => {
    const w = windowFor('2026-10-02', '09:00');
    const r = checkResourceConflict({
      system: system,
      resourceId: 'truck-1',
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      reservations: [mk('existing', w.pickup_at, w.return_at, 'confirmed')]
    });
    assert.equal(r.ok, false);
  });

  it('cancelled bookings do not consume capacity', () => {
    const w = windowFor('2026-10-02', '09:00');
    const existing = [1, 2, 3, 4].map(function (n) {
      return mk('c' + n, w.pickup_at, w.return_at, 'cancelled');
    });
    const r = checkDailyCapacity({
      system: system,
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      existingBookings: existing
    });
    assert.equal(r.ok, true);
    assert.equal(maxDailyJobs(system), 4);
  });

  it('combined availability passes when clear', () => {
    const w = windowFor('2026-10-02', '09:00');
    const ok = checkHireAvailability({
      system: system,
      resourceId: 'truck-1',
      startsAt: w.pickup_at,
      endsAt: w.return_at,
      reservations: [],
      existingBookings: []
    });
    assert.equal(ok.ok, true);
  });
});

describe('hire pricing', () => {
  it('charges per hire day and keeps bond separate', () => {
    const w = windowFor('2026-10-02', '09:00', 'multi_day', 2);
    const q = quoteHire({
      system: system,
      service: { name: 'Truck hire', price_cents: 20000 },
      resource: { name: 'Truck 1', default_daily_rate_cents: 20000, bond_cents: 50000 },
      window: {
        timezone: w.timezone,
        pickup_at: w.pickup_at,
        return_at: w.return_at,
        occupied_days: w.occupied_days,
        chargeable_days: w.chargeable_days
      }
    });
    assert.equal(q.ok, true);
    assert.equal(q.chargeable_days, 2);
    assert.equal(q.total_cents, 40000);
    assert.equal(q.bond_cents, 50000);
    assert.equal(q.amount_payable_cents, 90000);
  });

  it('priceChangeDiff reports additional due and credit', () => {
    const diff = priceChangeDiff(
      { total_cents: 20000, bond_cents: 50000 },
      { total_cents: 40000, bond_cents: 50000 }
    );
    assert.equal(diff.additional_due_cents, 20000);
    assert.equal(diff.credit_cents, 0);
  });
});

describe('hire cancellation + reschedule floor', () => {
  const rental = 25000;
  const bond = 50000;

  it('>48h: no fee', () => {
    const r = calculateCancellation({
      system: system,
      now: new Date('2026-10-01T00:00:00Z'),
      protectedStartsAt: new Date('2026-10-04T00:00:00Z'),
      rentalCents: rental,
      bondCents: bond,
      amountPaidCents: rental
    });
    assert.equal(r.fee_type, 'none');
    assert.equal(r.liability_cents, 0);
  });

  it('24-48h: $50 fee', () => {
    const r = calculateCancellation({
      system: system,
      now: new Date('2026-10-02T12:00:00Z'),
      protectedStartsAt: new Date('2026-10-03T20:00:00Z'),
      rentalCents: rental,
      bondCents: bond,
      amountPaidCents: rental
    });
    assert.equal(r.cancellation_fee_cents, 5000);
  });

  it('<24h: retain rental', () => {
    const r = calculateCancellation({
      system: system,
      now: new Date('2026-10-03T12:00:00Z'),
      protectedStartsAt: new Date('2026-10-03T20:00:00Z'),
      rentalCents: rental,
      bondCents: bond,
      amountPaidCents: rental + bond
    });
    assert.equal(r.rental_retained_cents, rental);
    assert.equal(r.bond_refund_cents, bond);
  });

  it('reschedule preserves fee floor', () => {
    const floor = rescheduleFeeFloor({
      system: system,
      now: new Date('2026-10-03T12:00:00Z'),
      protectedStartsAt: new Date('2026-10-03T20:00:00Z'),
      rentalCents: rental,
      bondCents: bond,
      amountPaidCents: rental,
      feeFloorCents: 0
    });
    assert.equal(floor.new_fee_floor_cents, rental);
    assert.equal(floor.acknowledgement_required, true);

    const later = calculateCancellation({
      system: system,
      now: new Date('2026-11-01T00:00:00Z'),
      protectedStartsAt: new Date('2026-11-10T00:00:00Z'),
      rentalCents: rental,
      bondCents: bond,
      amountPaidCents: rental,
      feeFloorCents: floor.new_fee_floor_cents
    });
    assert.equal(later.liability_cents, rental);
  });

  it('exposes default policy rules', () => {
    assert.ok(defaultRules().length >= 3);
  });
});

describe('hire lock', () => {
  it('locks by default and blocks mutation', () => {
    const hire = { locked: true };
    assert.equal(isHireBookingLocked(hire, system), true);
    const blocked = assertMutableSchedule(hire, system, {});
    assert.equal(blocked.ok, false);
    const flags = calendarEventFlags(hire, system);
    assert.equal(flags.startEditable, false);
    assert.equal(flags.lock_indicator, true);
  });

  it('temporary unlock then relock', () => {
    const unlocked = unlockPayload('user-1', 'adjust dates', 15);
    assert.equal(unlocked.locked, false);
    assert.ok(unlocked.unlocked_until);
    const hire = Object.assign({ locked: true }, unlocked);
    assert.equal(isHireBookingLocked(hire, system), false);
    const relocked = relockPayload();
    assert.equal(relocked.locked, true);
  });
});

describe('terminology + google event shape', () => {
  it('defaults to Truck/Trucks', () => {
    const t = resolveTerminology(system);
    assert.equal(t.singular, 'Truck');
    assert.equal(t.plural, 'Trucks');
  });

  it('builds timed google event payload', () => {
    const w = windowFor('2026-10-02', '09:00');
    const event = buildCalendarEvent(
      system,
      {
        id: 'bk1',
        reference: 'BK-00001',
        status: 'confirmed',
        payment_status: 'unpaid',
        customer_name: 'Alex',
        customer_phone: '0400000000',
        timezone: 'Australia/Sydney',
        starts_at: w.pickup_at,
        ends_at: w.return_at,
        site_id: 'site-1'
      },
      { pickup_at: w.pickup_at, return_at: w.return_at },
      { name: 'Truck 12', public_name: 'Truck 12', calendar_colour: '#112233' },
      { name: 'Alex', phone: '0400000000' }
    );
    assert.ok(event.start.dateTime);
    assert.ok(event.end.dateTime);
    assert.ok(!event.start.date);
    const title = applyTemplate(defaultEventTitleTemplate(system), {
      resource_name: 'Truck 12',
      customer_name: 'Alex',
      booking_reference: 'BK-00001'
    });
    assert.ok(title.indexOf('Truck 12') >= 0);
  });
});

describe('card funding label', () => {
  it('maps provider funding without BIN lookup', () => {
    assert.equal(fundingLabel('credit'), 'credit');
    assert.equal(fundingLabel('debit'), 'debit');
    assert.equal(fundingLabel('prepaid'), 'prepaid');
    assert.equal(fundingLabel('mystery'), 'unknown');
  });
});
