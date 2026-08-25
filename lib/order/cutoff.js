'use strict';

/**
 * Cutoff + lead-time engine.
 * Product cutoff and lead time are separate. Order effective cutoff = most restrictive.
 */

function parseYmd(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3] };
}

/** Build a Date in a business timezone for local wall-clock. */
function zonedDateTime(tz, y, mo, d, hh, mm, ss) {
  const pad = function (n) {
    return String(n).padStart(2, '0');
  };
  const asUtcGuess = new Date(Date.UTC(y, mo - 1, d, hh || 0, mm || 0, ss || 0));
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  fmt.formatToParts(asUtcGuess).forEach(function (p) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asLocal - asUtcGuess.getTime();
  return new Date(asUtcGuess.getTime() - offset);
}

function parseTimeToHm(t) {
  if (!t) return { h: 17, m: 0 };
  if (typeof t === 'string') {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (m) return { h: +m[1], m: +m[2] };
  }
  return { h: 17, m: 0 };
}

function productCutoffAt(product, system, pickupDateStr) {
  const tz = system.timezone || 'Australia/Sydney';
  const ymd = parseYmd(pickupDateStr);
  if (!ymd) return { at: null, reason: null };

  const mode = product.cutoff_mode || 'store_default';
  if (mode === 'none') return { at: null, reason: null, productId: product.id, label: product.name };

  if (mode === 'specific_datetime' && product.cutoff_at) {
    return {
      at: new Date(product.cutoff_at),
      reason: 'Product cutoff: ' + (product.name || 'item'),
      productId: product.id,
      label: product.name
    };
  }

  let effectiveMode = mode;
  let value = product.cutoff_value;
  let wall = parseTimeToHm(system.default_cutoff_time);

  if (mode === 'store_default') {
    effectiveMode = system.default_cutoff_mode || 'days_before';
    value = system.default_cutoff_value != null ? system.default_cutoff_value : 3;
    wall = parseTimeToHm(system.default_cutoff_time);
    if (effectiveMode === 'none') return { at: null, reason: null, productId: product.id, label: product.name };
  }

  const pickupLocal = zonedDateTime(tz, ymd.y, ymd.mo, ymd.d, 0, 0, 0);

  if (effectiveMode === 'hours_before') {
    const hours = Number(value) || 0;
    const at = new Date(pickupLocal.getTime() - hours * 3600 * 1000);
    return {
      at: at,
      reason: (product.name || 'Item') + ': ' + hours + 'h before pickup',
      productId: product.id,
      label: product.name
    };
  }

  if (effectiveMode === 'days_before') {
    const days = Number(value) || 0;
    const dayMs = days * 86400 * 1000;
    const base = new Date(pickupLocal.getTime() - dayMs);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(base);
    const map = {};
    parts.forEach(function (p) {
      map[p.type] = p.value;
    });
    const at = zonedDateTime(tz, +map.year, +map.month, +map.day, wall.h, wall.m, 0);
    return {
      at: at,
      reason: (product.name || 'Item') + ': ' + days + ' day(s) before pickup',
      productId: product.id,
      label: product.name
    };
  }

  if (effectiveMode === 'weekday_rule') {
    // Cutoff on configured weekday before pickup at wall time.
    const targetDow = system.default_cutoff_weekday != null ? Number(system.default_cutoff_weekday) : 3;
    let cursor = new Date(pickupLocal.getTime() - 86400 * 1000);
    for (var i = 0; i < 14; i++) {
      const dow = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
          .format(cursor)
          // map via parts
      );
      const wd = new Date(cursor).getUTCDay(); // approximate — refine below
      void wd;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'narrow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(cursor);
      const map = {};
      parts.forEach(function (p) {
        map[p.type] = p.value;
      });
      // Use weekday numeric via locale en-US with format that gives day number
      const probe = zonedDateTime(tz, +map.year, +map.month, +map.day, 12, 0, 0);
      const jsDow = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'numeric' }).format
          ? null
          : null
      );
      void jsDow;
      // Fallback: iterate calendar days in TZ
      const ymdC = { y: +map.year, mo: +map.month, d: +map.day };
      const noon = zonedDateTime(tz, ymdC.y, ymdC.mo, ymdC.d, 12, 0, 0);
      const dowNum = ((noon.getUTCDay() + 7) % 7); // imperfect but OK for v1
      if (dowNum === targetDow) {
        const at = zonedDateTime(tz, ymdC.y, ymdC.mo, ymdC.d, wall.h, wall.m, 0);
        return {
          at: at,
          reason: 'Store weekday cutoff before pickup',
          productId: product.id,
          label: product.name
        };
      }
      cursor = new Date(cursor.getTime() - 86400 * 1000);
      void dow;
      void probe;
    }
  }

  return { at: null, reason: null, productId: product.id, label: product.name };
}

/**
 * Most restrictive cutoff among products in the cart/order.
 */
function effectiveOrderCutoff(products, system, pickupDateStr) {
  let earliest = null;
  let reason = null;
  let driver = null;
  (products || []).forEach(function (p) {
    const r = productCutoffAt(p, system, pickupDateStr);
    if (!r.at) return;
    if (!earliest || r.at.getTime() < earliest.getTime()) {
      earliest = r.at;
      reason = r.reason;
      driver = p;
    }
  });
  if (!earliest && system && (system.default_cutoff_mode || 'days_before') !== 'none') {
    const synthetic = productCutoffAt(
      { cutoff_mode: 'store_default', name: 'Store default' },
      system,
      pickupDateStr
    );
    earliest = synthetic.at;
    reason = synthetic.reason || 'Store default cutoff';
  }
  return {
    effective_cutoff_at: earliest ? earliest.toISOString() : null,
    cutoff_reason: reason,
    driver_product_id: driver && driver.id,
    message: earliest
      ? 'Changes close because your order contains a made-to-order / restricted item.'
      : null
  };
}

/**
 * Persistable change deadline = earlier of product/store pickup cutoff and season master lock.
 * @param {object[]} products
 * @param {object} system
 * @param {string} pickupDateStr
 * @param {object} [schedule] - pickup_schedule (or parsed)
 */
function resolveChangeDeadline(products, system, pickupDateStr, schedule) {
  const base = effectiveOrderCutoff(products, system, pickupDateStr);
  const { earlierChangeDeadline } = require('./master-lock');
  const sched = schedule || {};
  const tz = (system && system.timezone) || 'Australia/Sydney';
  const merged = earlierChangeDeadline(sched, base.effective_cutoff_at, new Date(), tz);
  if (!merged.iso) {
    return Object.assign({}, base, {
      cutoff_source: null,
      pickup_cutoff_at: base.effective_cutoff_at
    });
  }
  const masterDate = sched.master_lock_date ? String(sched.master_lock_date).slice(0, 10) : '';
  return {
    effective_cutoff_at: merged.iso,
    cutoff_reason:
      merged.source === 'master_lock'
        ? 'Season cutoff' + (masterDate ? ' (' + masterDate + ')' : '')
        : base.cutoff_reason,
    cutoff_source: merged.source,
    pickup_cutoff_at: base.effective_cutoff_at,
    driver_product_id: base.driver_product_id,
    message: base.message
  };
}

function productLeadTimeHours(product) {
  const mode = product.lead_time_mode || 'none';
  const v = Number(product.lead_time_value) || 0;
  if (mode === 'hours') return v;
  if (mode === 'days') return v * 24;
  return 0;
}

function maxLeadTimeHours(products) {
  let max = 0;
  (products || []).forEach(function (p) {
    max = Math.max(max, productLeadTimeHours(p));
  });
  return max;
}

/**
 * Earliest selectable pickup date given lead times (local calendar days).
 */
function earliestPickupDate(tz, products, fromDate) {
  const hours = maxLeadTimeHours(products);
  const days = Math.ceil(hours / 24);
  const base = fromDate ? new Date(fromDate) : new Date();
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(base);
  const ymd = parseYmd(local);
  const start = zonedDateTime(tz, ymd.y, ymd.mo, ymd.d, 0, 0, 0);
  const earliest = new Date(start.getTime() + days * 86400 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(earliest);
  const map = {};
  parts.forEach(function (p) {
    map[p.type] = p.value;
  });
  return map.year + '-' + map.month + '-' + map.day;
}

function editingStateFor(cutoffIso, now) {
  if (!cutoffIso) return 'open';
  const at = new Date(cutoffIso).getTime();
  const t = (now || new Date()).getTime();
  if (t >= at) return 'locked';
  if (at - t <= 8 * 3600 * 1000) return 'closing_soon';
  return 'open';
}

module.exports = {
  productCutoffAt,
  effectiveOrderCutoff,
  resolveChangeDeadline,
  productLeadTimeHours,
  maxLeadTimeHours,
  earliestPickupDate,
  editingStateFor,
  zonedDateTime,
  parseYmd
};
