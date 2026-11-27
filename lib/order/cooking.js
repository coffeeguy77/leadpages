'use strict';

/**
 * Cooking (kitchen) rules for the order engine.
 *
 * Settings live in order_systems.settings.cooking:
 *   rate_cents_per_kg  cooking rate, cents per kg (inc. GST)            — existing
 *   min_on             minimum fee switched on (default false)
 *   min_cents          minimum cooking fee per item (cents, inc. GST)
 *   words              words that mean "cooked" on an option, e.g. ["cooked","glazed"]
 *   minutes_per_kg     { "<word in product name>": minutes } for "in the oven by" times (optional)
 *
 * Charge per item = the greater of (kg × rate) and the minimum (× quantity).
 */

const { mulWeightRate } = require('./money');

const DEFAULT_WORDS = ['cooked', 'cook', 'glazed', 'glaze'];

function cookingSettings(system) {
  const c = (system && system.settings && system.settings.cooking) || {};
  const rate = c.rate_cents_per_kg != null && Number.isFinite(Number(c.rate_cents_per_kg)) ? Math.max(0, Math.round(Number(c.rate_cents_per_kg))) : null;
  const min = c.min_on === true && c.min_cents != null && Number(c.min_cents) > 0 ? Math.round(Number(c.min_cents)) : null;
  const words = Array.isArray(c.words) && c.words.length
    ? c.words.map(function (w) { return String(w || '').trim().toLowerCase(); }).filter(Boolean).slice(0, 30)
    : DEFAULT_WORDS.slice();
  const mpk = {};
  if (c.minutes_per_kg && typeof c.minutes_per_kg === 'object') {
    Object.keys(c.minutes_per_kg).forEach(function (k) {
      const n = Number(c.minutes_per_kg[k]);
      const key = String(k || '').trim().toLowerCase();
      if (key && Number.isFinite(n) && n > 0 && n < 600) mpk[key] = n;
    });
  }
  // Options are charged by their words only once the shop has saved its word list (Settings → Cooking);
  // until then only options ticked "Charge cooking rate" are charged. The Kitchen list always uses the words.
  const wordsSaved = Array.isArray(c.words) && c.words.length > 0;
  return { rate_cents_per_kg: rate, min_cents: min, words: words, words_saved: wordsSaved, minutes_per_kg: mpk };
}

/** Options for optionExtrasPerUnitCents(): the shop rate and minimum. */
function cookingOpts(system) {
  const s = cookingSettings(system);
  return { cooking_rate_cents: s.rate_cents_per_kg, cooking_min_cents: s.min_cents, cooking_words: s.words_saved ? s.words : null };
}

/**
 * Cooking charge on a weight: max(kg × per-kg, min × qty). No per-kg → 0.
 * Unknown weight → the minimum when there is one, else null.
 */
function cookingChargeCents(weightKg, perKgCents, minCents, qty) {
  const perKg = Number(perKgCents) || 0;
  if (!perKg) return 0;
  const q = Math.max(1, Number(qty) || 1);
  const min = minCents > 0 ? Math.round(Number(minCents) * q) : 0;
  const w = Number(weightKg);
  if (!(w > 0)) return min > 0 ? min : null;
  return Math.max(mulWeightRate(w, perKg), min);
}

function hasWord(text, words) {
  const s = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  return words.some(function (w) {
    const t = String(w || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return t && s.indexOf(' ' + t + ' ') >= 0;
  });
}

/** Words in notes that are NOT a cooking request ("uncooked", "I'll cook it", "don't need to cook"). */
function negatedInNote(text) {
  const t = String(text || '').replace(/[\u2018\u2019]/g, "'");
  return /\b(un-?cooked|raw|not cooked|no cooking|(don'?t|do not|won'?t) (need|want) (it |them )?(to )?(be )?cook|i'?ll cook|we'?ll cook|cook (it|them) (myself|ourselves)|until we cook|before we cook|need to cook)\b/i.test(t);
}

/** Is a product option choice charged as cooking (flagged, or its label is one of the shop's cooking words)? */
function isCookingChoice(choice, words) {
  if (!choice) return false;
  if (choice.cooking === true) return true;
  if (!words || !words.length) return false;
  if (/^(no|none|raw|uncooked|not)\b/i.test(String(choice.label || choice.value || ''))) return false;
  return hasWord(choice.label, words) || hasWord(choice.value, words);
}

/** Is this selected option a cooking choice (flagged, or its words match)? */
function isCookingSelection(sel, words) {
  if (!sel) return false;
  if (sel.cooking === true) return true;
  if (/^(no|none|raw|uncooked|not)\b/i.test(String(sel.label || sel.value || ''))) return false;
  // "Cooking? → Yes": the question names it and the answer is a plain yes.
  if (hasWord(sel.question, words) && /^(yes|y|please|yes please)$/i.test(String(sel.label || sel.value || '').trim())) return true;
  return hasWord(sel.label, words) || hasWord(sel.value, words);
}

function selectedOptions(item) {
  const sel = (item && item.options_snapshot && item.options_snapshot.selected) ||
    (item && item.product_snapshot && item.product_snapshot.selected_options) || [];
  return Array.isArray(sel) ? sel : [];
}

/**
 * How an order line relates to the kitchen.
 * @returns {{cook:boolean, check:boolean, source:string, labels:string[], charged:boolean, note:string}}
 *   cook  — on the kitchen list (option chosen, or staff marked it)
 *   check — a note mentions cooking but nothing is chosen: staff should confirm
 */
function itemCookInfo(item, order, settings) {
  const words = settings.words;
  const k = item.kitchen || {};
  const sel = selectedOptions(item);
  const cookSel = sel.filter(function (o) { return isCookingSelection(o, words); });
  const labels = cookSel.map(function (o) { return String(o.label || o.value || ''); });
  const charged = cookSel.some(function (o) { return o.cooking === true && Number(o.per_kg_cents) > 0; });
  if (k.excluded === true) return { cook: false, check: false, source: 'excluded', labels: labels, charged: charged, note: '' };
  if (cookSel.length) return { cook: true, check: false, source: 'option', labels: labels, charged: charged, note: '' };
  if (k.added === true) return { cook: true, check: false, source: 'staff', labels: [k.label || 'Cooked'], charged: charged, note: '' };
  if (hasWord(item.product_name, words.filter(function (w) { return w !== 'cook'; })) && /\bcooked\b/i.test(String(item.product_name || ''))) {
    return { cook: true, check: false, source: 'product', labels: ['Cooked'], charged: false, note: '' };
  }
  if (k.check_dismissed === true) return { cook: false, check: false, source: '', labels: labels, charged: charged, note: '' };
  const itemNote = String(item.notes || '');
  if (itemNote && hasWord(itemNote, words) && !negatedInNote(itemNote)) {
    return { cook: false, check: true, source: 'item_note', labels: [], charged: false, note: itemNote };
  }
  const orderNote = String((order && order.customer_notes) || '');
  if (orderNote && hasWord(orderNote, words) && !negatedInNote(orderNote)) {
    // Only point at lines whose product the note names (e.g. "cooked turkey pls" → the turkey line).
    const name = String(item.product_name || '').toLowerCase();
    const first = name.split(/[\s\-–,(]+/).filter(Boolean)[0] || '';
    if (first && first.length > 2 && orderNote.toLowerCase().indexOf(first) >= 0) {
      return { cook: false, check: true, source: 'order_note', labels: [], charged: false, note: orderNote };
    }
  }
  return { cook: false, check: false, source: '', labels: labels, charged: charged, note: '' };
}

/** Product "kind" for the kitchen summary: TURKEY, HAM, PORK… from "TURKEY - Whole 4-4.8 kg". */
function productKind(name) {
  const s = String(name || '').trim();
  const m = /^([A-Za-z][A-Za-z &]{1,30}?)\s*[-–:]\s+/.exec(s);
  const k = (m ? m[1] : s.split(/\s+/)[0] || 'Other').trim();
  return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
}

/** Size / cut after the kind: "Whole 4-4.8 kg". */
function productVariant(name) {
  const s = String(name || '').trim();
  const m = /^[A-Za-z][A-Za-z &]{1,30}?\s*[-–:]\s+(.*)$/.exec(s);
  return (m ? m[1] : s).trim();
}

/** Planning weight for one line: actual, else requested, else the middle of the name's range. */
function planningWeightKg(item) {
  if (item.actual_weight_kg != null && Number(item.actual_weight_kg) > 0) return { kg: Number(item.actual_weight_kg), basis: 'weighed' };
  if (item.requested_weight_kg != null && Number(item.requested_weight_kg) > 0) return { kg: Number(item.requested_weight_kg), basis: 'requested' };
  const { nameWeightRangeKg } = require('./pricing');
  const r = nameWeightRangeKg(item.product_name);
  const q = Math.max(1, Number(item.quantity) || 1);
  if (r) return { kg: Math.round(((r.low + r.high) / 2) * q * 100) / 100, basis: 'size', low: r.low * q, high: r.high * q };
  return { kg: null, basis: 'unknown' };
}

/** Minutes per kg for a product from settings (longest matching word wins). */
function minutesPerKgFor(name, settings) {
  const n = String(name || '').toLowerCase();
  let best = null;
  let bestLen = 0;
  Object.keys(settings.minutes_per_kg || {}).forEach(function (k) {
    if (n.indexOf(k) >= 0 && k.length > bestLen) { best = settings.minutes_per_kg[k]; bestLen = k.length; }
  });
  return best;
}

function hhmm(t) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  return m ? (m[1].length === 1 ? '0' + m[1] : m[1]) + ':' + m[2] : null;
}

function minusMinutes(time, mins) {
  const m = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!m) return null;
  let total = Number(m[1]) * 60 + Number(m[2]) - Math.round(mins);
  let dayBefore = false;
  while (total < 0) { total += 24 * 60; dayBefore = true; }
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return { time: (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm, day_before: dayBefore };
}

/** Value of the cooking on a line (charged per-kg options, with the minimum). */
function lineCookingValueCents(item, w) {
  const { lineOptionExtras } = require('./product-options');
  const ex = lineOptionExtras(item);
  if (!ex.per_kg) return null;
  return cookingChargeCents(w, ex.per_kg, ex.cook_min, item.quantity);
}

/**
 * Kitchen board from orders (each with .items).
 * @returns {{days:[], check:[], totals:{}}}
 */
function buildKitchenBoard(orders, system, opts) {
  const settings = cookingSettings(system);
  const today = (opts && opts.today) || null;
  const days = {};
  const check = [];
  (orders || []).forEach(function (o) {
    (o.items || []).forEach(function (it) {
      const info = itemCookInfo(it, o, settings);
      if (info.check) {
        check.push({
          order_id: o.id, order_number: o.order_number, customer_name: o.customer_name,
          pickup_date: o.pickup_date, pickup_time: hhmm(o.pickup_time), item_id: it.id,
          product_name: it.product_name, quantity: Number(it.quantity) || 1, note: info.note, source: info.source
        });
      }
      if (!info.cook) return;
      const pw = planningWeightKg(it);
      const k = it.kitchen || {};
      const date = o.pickup_date || 'no-date';
      const pickT = hhmm(o.pickup_time) || hhmm(o.pickup_window_start);
      const mpk = minutesPerKgFor(it.product_name, settings);
      let ovenBy = null;
      if (mpk && pw.kg && pickT) {
        // Cook time + 30 min rest/pack, before pickup.
        ovenBy = minusMinutes(pickT, mpk * pw.kg + 30);
      }
      const row = {
        order_id: o.id, order_number: o.order_number, status: o.status,
        customer_name: o.customer_name, customer_phone: o.customer_phone,
        pickup_date: o.pickup_date, pickup_time: pickT, fulfilment_type: o.fulfilment_type,
        item_id: it.id, product_name: it.product_name, kind: productKind(it.product_name), variant: productVariant(it.product_name),
        quantity: Number(it.quantity) || 1, weight_kg: pw.kg, weight_basis: pw.basis, weight_low: pw.low || null, weight_high: pw.high || null,
        options: selectedOptions(it).map(function (s) { return String(s.label || s.value || ''); }).filter(Boolean),
        cook_labels: info.labels, source: info.source, charged: info.charged,
        notes: [it.notes, o.customer_notes].filter(function (x) { return x && String(x).trim(); }).join(' · '),
        internal_notes: o.internal_notes || '',
        cooking_value_cents: lineCookingValueCents(it, pw.kg),
        done: k.done === true, done_at: k.done_at || null, done_by: k.done_by || null,
        oven_by: ovenBy ? ovenBy.time : null, oven_day_before: ovenBy ? ovenBy.day_before : false,
        minutes_per_kg: mpk,
        important: !!o.is_important
      };
      if (!days[date]) days[date] = { date: date, items: [] };
      days[date].items.push(row);
    });
  });
  const out = Object.keys(days).sort().map(function (d) {
    const day = days[d];
    day.items.sort(function (a, b) {
      return String(a.pickup_time || '99').localeCompare(String(b.pickup_time || '99')) ||
        String(a.kind).localeCompare(String(b.kind)) || String(a.order_number).localeCompare(String(b.order_number));
    });
    const kinds = {};
    let kg = 0;
    let kgKnown = true;
    let value = 0;
    let done = 0;
    let units = 0;
    let earliest = null;
    let firstOven = null;
    day.items.forEach(function (r) {
      const k = kinds[r.kind] || (kinds[r.kind] = { kind: r.kind, units: 0, kg: 0, variants: {} });
      k.units += r.quantity;
      units += r.quantity;
      if (r.weight_kg) { k.kg += r.weight_kg; kg += r.weight_kg; } else kgKnown = false;
      const v = k.variants[r.variant] || (k.variants[r.variant] = { variant: r.variant, units: 0, options: {} });
      v.units += r.quantity;
      r.options.forEach(function (op) {
        if (settings.words.some(function (w) { return hasWord(op, [w]); })) return;
        v.options[op] = (v.options[op] || 0) + r.quantity;
      });
      if (r.cooking_value_cents) value += r.cooking_value_cents;
      if (r.done) done += r.quantity;
      if (r.pickup_time && (!earliest || r.pickup_time < earliest)) earliest = r.pickup_time;
      if (r.oven_by && !r.oven_day_before && (!firstOven || r.oven_by < firstOven)) firstOven = r.oven_by;
    });
    day.summary = {
      units: units, done: done, to_do: units - done,
      kg: Math.round(kg * 10) / 10, kg_complete: kgKnown, cooking_value_cents: value,
      earliest_pickup: earliest, first_in_oven: firstOven,
      kinds: Object.keys(kinds).sort().map(function (n) {
        const k = kinds[n];
        return {
          kind: n, units: k.units, kg: Math.round(k.kg * 10) / 10,
          variants: Object.keys(k.variants).sort().map(function (vn) {
            const v = k.variants[vn];
            return { variant: vn, units: v.units, options: Object.keys(v.options).sort().map(function (on) { return { label: on, units: v.options[on] }; }) };
          })
        };
      })
    };
    day.is_today = today && d === today;
    day.is_past = today && d !== 'no-date' && d < today;
    return day;
  });
  check.sort(function (a, b) { return String(a.pickup_date).localeCompare(String(b.pickup_date)); });
  const totals = { units: 0, done: 0, cooking_value_cents: 0, kg: 0 };
  out.forEach(function (d) {
    totals.units += d.summary.units; totals.done += d.summary.done;
    totals.cooking_value_cents += d.summary.cooking_value_cents; totals.kg += d.summary.kg;
  });
  totals.kg = Math.round(totals.kg * 10) / 10;
  return { days: out, check: check, totals: totals, settings: settings };
}

/**
 * Turn the cooking options on a stored line into charged cooking (rate per kg + minimum)
 * and reprice the line. Returns a patch for order_items, or null when nothing changes.
 * @param {object} item order_items row
 * @param {object} system order system
 * @param {{force?:boolean, label?:string}} [opts] force: add a cooking choice when none is chosen
 */
function chargeCookingPatch(item, system, opts) {
  const s = cookingSettings(system);
  if (s.rate_cents_per_kg == null) return null;
  const sel = selectedOptions(item).map(function (o) { return Object.assign({}, o); });
  let changed = false;
  let any = false;
  const words = s.words_saved ? s.words : [];
  sel.forEach(function (o) {
    if (!isCookingSelection(o, words)) return;
    any = true;
    if (o.cooking === true && Number(o.per_kg_cents) === s.rate_cents_per_kg && Number(o.cook_min_cents || 0) === Number(s.min_cents || 0) && !o.price_cents) return;
    o.cooking = true;
    o.per_kg_cents = s.rate_cents_per_kg;
    if (s.min_cents) o.cook_min_cents = s.min_cents; else delete o.cook_min_cents;
    if (o.price_cents) { o.replaced_price_cents = o.price_cents; o.price_cents = 0; }
    o.gst_inclusive = true;
    changed = true;
  });
  if (!any && opts && opts.force) {
    sel.push({
      key: 'cooking', question: 'Cooking', label: (opts.label || 'Cooked'), value: (opts.label || 'Cooked'),
      price_cents: 0, per_kg_cents: s.rate_cents_per_kg, cooking: true, gst_inclusive: true,
      cook_min_cents: s.min_cents || undefined, added_by_staff: true
    });
    changed = true;
  }
  if (!changed) return null;
  const snap = Object.assign({}, item.options_snapshot || {}, { selected: sel });
  const next = Object.assign({}, item, { options_snapshot: snap });
  const patch = { options_snapshot: snap };
  Object.assign(patch, repriceFromSnapshot(next));
  return patch;
}

/** Line money after its options changed, from what is stored on the line (never invents a price). */
function repriceFromSnapshot(item) {
  const { lineOptionExtras } = require('./product-options');
  const { finaliseWeightLine, priceLineAtOrder } = require('./pricing');
  const ex = lineOptionExtras(item);
  const method = item.pricing_method || 'fixed';
  if (item.price_status === 'finalised' && item.actual_weight_kg != null && item.unit_price_cents != null &&
    (method === 'per_weight' || method === 'price_tbc' || method === 'quote_required' || method === 'estimated')) {
    const f = finaliseWeightLine(item, item.actual_weight_kg, item.unit_price_cents);
    return { line_final_cents: f.line_final_cents };
  }
  if (method === 'per_weight') {
    const p = priceLineAtOrder({ pricing_method: 'per_weight', price_per_kg_cents: item.unit_price_cents }, item.quantity,
      item.requested_weight_kg, ex, { ignoreSpecial: true });
    if (item.price_status === 'estimated' || item.price_status === 'tbc') {
      return { line_known_cents: p.lineKnownCents, price_status: p.priceStatus };
    }
    return {};
  }
  if (method === 'price_tbc' || method === 'quote_required') {
    const q = Math.max(1, Number(item.quantity) || 1);
    const flat = Math.round(ex.flat * q);
    return { line_known_cents: flat > 0 ? flat : null };
  }
  // Fixed / per unit: unit price includes flat extras. Cooking per kg needs a weight: added on weighing.
  return {};
}

module.exports = {
  DEFAULT_WORDS,
  cookingSettings,
  cookingOpts,
  cookingChargeCents,
  isCookingSelection,
  isCookingChoice,
  itemCookInfo,
  hasWord,
  negatedInNote,
  productKind,
  productVariant,
  planningWeightKg,
  buildKitchenBoard,
  chargeCookingPatch,
  repriceFromSnapshot
};
