'use strict';

/**
 * Product specials (order engine).
 *
 * Stored on the product in options.special (no schema change):
 *   {
 *     on: true,
 *     mode: 'price' | 'percent',
 *     price_cents: 4500,          // mode 'price': the special price (per kg for per-weight products)
 *     percent: 10,                // mode 'percent': % off the normal price (1–95)
 *     timing: 'ongoing' | 'until' | 'scheduled',
 *     start: 'YYYY-MM-DD' | null, // scheduled: first day (business timezone)
 *     end: 'YYYY-MM-DD' | null    // until / scheduled: last day, inclusive
 *   }
 *
 * The special applies when an item is ordered (cart, checkout, staff order, added line).
 * Existing order lines keep the price they were ordered at — they are repriced from their
 * stored unit price, never from the product, so a special ending later does not change them.
 * Products without a price (price confirmed later / quote) never get a special.
 */

const DEFAULT_TZ = 'Australia/Sydney';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRICED_METHODS = ['fixed', 'per_unit', 'per_weight', 'estimated', 'from_price'];

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

function cleanDate(v) {
  var s = String(v == null ? '' : v).trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

/** Normalise raw editor/API input into the stored shape. Returns null when off/empty. */
function normaliseSpecial(raw) {
  if (!isObj(raw) || !raw.on) return null;
  var mode = raw.mode === 'percent' ? 'percent' : 'price';
  var out = { on: true, mode: mode };
  if (mode === 'percent') {
    var pct = Number(raw.percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
    out.percent = Math.round(Math.min(95, pct) * 100) / 100;
  } else {
    var cents = raw.price_cents != null && raw.price_cents !== ''
      ? Number(raw.price_cents)
      : raw.price != null && raw.price !== '' ? Math.round(Number(raw.price) * 100) : NaN;
    if (!Number.isFinite(cents) || cents <= 0) return null;
    out.price_cents = Math.round(cents);
  }
  var timing = raw.timing === 'until' || raw.timing === 'scheduled' ? raw.timing : 'ongoing';
  var start = cleanDate(raw.start);
  var end = cleanDate(raw.end);
  if (timing === 'until' && !end) timing = 'ongoing';
  if (timing === 'scheduled' && !start && !end) timing = 'ongoing';
  if (timing === 'scheduled' && start && end && end < start) { var t = start; start = end; end = t; }
  out.timing = timing;
  out.start = timing === 'scheduled' ? start : null;
  out.end = timing === 'ongoing' ? null : end;
  return out;
}

/** Today's date (YYYY-MM-DD) in the business timezone. */
function localDate(now, tz) {
  var d = now instanceof Date ? now : now != null ? new Date(now) : new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  } catch (_e) {
    return d.toISOString().slice(0, 10);
  }
}

function basePriceField(product) {
  return product && product.pricing_method === 'per_weight' ? 'price_per_kg_cents' : 'price_cents';
}

/**
 * Work out the special for a product right now.
 * @returns {null | {price_cents, was_cents, saving_cents, percent, per_kg, mode, ends, starts, field}}
 *   price_cents/was_cents are per kg for per-weight products.
 */
function specialInfo(product, opts) {
  opts = opts || {};
  if (!product || !isObj(product.options)) return null;
  var sp = normaliseSpecial(product.options.special);
  if (!sp) return null;
  var method = product.pricing_method || 'fixed';
  if (PRICED_METHODS.indexOf(method) < 0) return null;
  var field = basePriceField(product);
  var was = Number(product[field]);
  if (!Number.isFinite(was) || was <= 0) return null;

  if (!opts.ignoreDates) {
    var today = localDate(opts.now, opts.tz);
    if (sp.start && today < sp.start) return null;
    if (sp.end && today > sp.end) return null;
  }

  var price = sp.mode === 'percent' ? Math.round(was * (100 - sp.percent) / 100) : sp.price_cents;
  if (!Number.isFinite(price) || price <= 0 || price >= was) return null;
  var saving = was - price;
  return {
    mode: sp.mode,
    price_cents: price,
    was_cents: was,
    saving_cents: saving,
    percent: sp.mode === 'percent' ? sp.percent : Math.round((saving / was) * 1000) / 10,
    per_kg: field === 'price_per_kg_cents',
    starts: sp.start || null,
    ends: sp.end || null,
    field: field
  };
}

/** Copy of the product priced at its special (or the product itself when none applies). */
function applySpecial(product, opts) {
  var info = specialInfo(product, opts);
  if (!info) return { product: product, special: null };
  var copy = Object.assign({}, product);
  copy[info.field] = info.price_cents;
  return { product: copy, special: info };
}

/** Compact form saved on order lines / sent to the shop. */
function specialSummary(info) {
  if (!info) return null;
  return {
    price_cents: info.price_cents,
    was_cents: info.was_cents,
    saving_cents: info.saving_cents,
    percent: info.percent,
    per_kg: info.per_kg,
    ends: info.ends
  };
}

module.exports = {
  DEFAULT_TZ,
  normaliseSpecial,
  specialInfo,
  applySpecial,
  specialSummary,
  localDate
};
