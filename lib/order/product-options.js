'use strict';

/**
 * Product pack size + selectable extras (order_product_questions).
 * Pack metadata lives on order_products.options jsonb.
 * Paid choices use { label, value, price_cents } in question.options.
 */

function productOptions(product) {
  var o = (product && product.options) || {};
  return o && typeof o === 'object' ? o : {};
}

function isPackSize(product) {
  var o = productOptions(product);
  return o.size_mode === 'pack' || o.size_mode === 'fixed';
}

function isEachSize(product) {
  var o = productOptions(product);
  return o.size_mode === 'each' || o.size_mode === 'unit' || o.size_mode === 'individual';
}

/**
 * Sold by count with no known weight per item ("Individual item", or a pack with no pack weight).
 * Per-kg items like this are priced once weighed — never from a made-up default weight.
 */
function isCountOnlySize(product) {
  if (isEachSize(product)) return true;
  if (isPackSize(product)) {
    var o = productOptions(product);
    var w = o.pack_weight_kg != null ? Number(o.pack_weight_kg) : null;
    return !(w != null && Number.isFinite(w) && w > 0);
  }
  return false;
}

function minimumKgOption(product) {
  var o = productOptions(product);
  if (o.minimum_kg != null) {
    var n = Number(o.minimum_kg);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1000) / 1000;
  }
  return null;
}

function packWeightKg(product) {
  if (!isPackSize(product)) return null;
  var o = productOptions(product);
  var w = o.pack_weight_kg != null ? Number(o.pack_weight_kg) : null;
  return w != null && Number.isFinite(w) && w > 0 ? w : null;
}

function quantityPrompt(product) {
  var o = productOptions(product);
  var raw = o.quantity_prompt != null ? String(o.quantity_prompt).trim() : '';
  if (raw) return raw.slice(0, 120);
  if (!isPackSize(product) && o.pack_label) {
    var orphan = String(o.pack_label).trim();
    if (orphan) return orphan.slice(0, 120);
  }
  return '';
}

function packLabel(product) {
  if (!isPackSize(product)) return '';
  var o = productOptions(product);
  if (o.pack_label) {
    var lbl = String(o.pack_label).trim();
    if (lbl && /[?]/.test(lbl) && !packWeightKg(product)) return '';
    if (lbl) return lbl;
  }
  var w = packWeightKg(product);
  if (w == null) return '';
  if (w >= 1) return w + ' kg';
  return Math.round(w * 1000) + 'g';
}

/** Total requested kg for a line (pack × qty) when product is pack-sized. */
function resolveRequestedWeightKg(product, qty, requestedWeightKg) {
  if (isPackSize(product)) {
    var unit = packWeightKg(product);
    if (unit == null) return requestedWeightKg != null ? Number(requestedWeightKg) : null;
    var q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) q = 1;
    return Math.round(unit * q * 1000) / 1000;
  }
  return requestedWeightKg != null ? Number(requestedWeightKg) : null;
}

function normaliseChoice(opt) {
  if (opt == null) return null;
  if (typeof opt === 'string') {
    return { label: opt, value: opt, price_cents: 0 };
  }
  var label = String(opt.label || opt.value || '').trim();
  if (!label) return null;
  var value = String(opt.value != null ? opt.value : label).trim() || label;
  var price = opt.price_cents != null ? Number(opt.price_cents) : 0;
  if (!Number.isFinite(price) || price < 0) price = 0;
  var out = { label: label, value: value, price_cents: Math.round(price) };
  // Charged per kg at the shop's cooking rate (Settings → Tax & Payments → Cooking rate).
  if (opt.cooking === true) {
    out.cooking = true;
    out.price_cents = 0;
  }
  return out;
}

function questionChoices(question) {
  return (question && Array.isArray(question.options) ? question.options : [])
    .map(normaliseChoice)
    .filter(Boolean);
}

function answerValues(raw) {
  if (raw == null) return [];
  var v = raw;
  if (typeof raw === 'object' && !Array.isArray(raw) && raw.value !== undefined) v = raw.value;
  if (Array.isArray(v)) {
    return v.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
  }
  var s = String(v).trim();
  if (!s) return [];
  if (s.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
      }
    } catch (_e) {}
  }
  if (s.indexOf(',') >= 0) {
    return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  return [s];
}

/**
 * Extras from selected options: flat cents per unit, plus cents per kg (cooking choices,
 * charged at `opts.cooking_rate_cents` per kg of the item's weight).
 */
function optionExtrasPerUnitCents(questions, answers, opts) {
  var extra = 0;
  var perKg = 0;
  var cookRate = opts && opts.cooking_rate_cents != null ? Math.max(0, Math.round(Number(opts.cooking_rate_cents) || 0)) : 0;
  // Minimum cooking fee per item (Settings → Cooking): the charge is the greater of kg × rate and this.
  var cookMin = opts && Number(opts.cooking_min_cents) > 0 ? Math.round(Number(opts.cooking_min_cents)) : 0;
  var minUsed = 0;
  var cookWords = opts && Array.isArray(opts.cooking_words) ? opts.cooking_words : null;
  var isCook = function (choice) {
    if (choice.cooking) return true;
    return !!(cookRate && cookWords && require('./cooking').isCookingChoice(choice, cookWords));
  };
  var selected = [];
  (questions || []).forEach(function (q) {
    if (!q || q.staff_only) return;
    var ans = answers && (answers[q.key] != null ? answers[q.key] : answers[q.id]);
    var vals = answerValues(ans);
    if (!vals.length) return;
    questionChoices(q).forEach(function (choice) {
      var hit = vals.some(function (v) {
        return v === choice.value || v === choice.label;
      });
      if (!hit) return;
      if (isCook(choice)) {
        // One cooking charge per line, even if two options both mean cooking (e.g. cooked + glazed).
        perKg = Math.max(perKg, cookRate);
        var cs = {
          key: q.key,
          question: q.label,
          label: choice.label,
          value: choice.value,
          price_cents: 0,
          per_kg_cents: cookRate,
          cooking: true,
          gst_inclusive: true
        };
        if (cookMin && cookRate) { cs.cook_min_cents = cookMin; minUsed = Math.max(minUsed, cookMin); }
        selected.push(cs);
        return;
      }
      extra += choice.price_cents || 0;
      selected.push({
        key: q.key,
        question: q.label,
        label: choice.label,
        value: choice.value,
        price_cents: choice.price_cents || 0
      });
    });
  });
  return { extra_cents: extra, per_kg_cents: perKg, cook_min_cents: minUsed, selected: selected };
}

/** Flat cents per unit and cents per kg from a line's stored selected options. */
function lineOptionExtras(item) {
  var sel = (item && item.options_snapshot && item.options_snapshot.selected) ||
    (item && item.product_snapshot && item.product_snapshot.selected_options) || [];
  var flat = 0;
  var perKg = 0;
  var cookMin = 0;
  (Array.isArray(sel) ? sel : []).forEach(function (o) {
    if (!o) return;
    flat += Number(o.price_cents) || 0;
    perKg = Math.max(perKg, Number(o.per_kg_cents) || 0);
    if (Number(o.per_kg_cents) > 0 && Number(o.cook_min_cents) > cookMin) cookMin = Number(o.cook_min_cents);
  });
  return { flat: flat, per_kg: perKg, cook_min: cookMin };
}

/** Shop cooking rate in cents per kg (order_systems.settings.cooking.rate_cents_per_kg), or null. */
function cookingRateCents(system) {
  var c = system && system.settings && system.settings.cooking;
  var n = c && c.rate_cents_per_kg != null ? Number(c.rate_cents_per_kg) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** { cooking_rate_cents, cooking_min_cents } for optionExtrasPerUnitCents(). */
function cookingOpts(system) {
  return require('./cooking').cookingOpts(system);
}

/** Decorate question choices for display: cooking choices get per_kg_cents = the shop rate. */
function withCookingRate(questions, system) {
  var rate = cookingRateCents(system);
  var cs = require('./cooking').cookingSettings(system);
  var isCook = function (o) {
    if (!o || typeof o !== 'object') return false;
    return o.cooking === true || (rate != null && cs.words_saved && require('./cooking').isCookingChoice(o, cs.words));
  };
  return (questions || []).map(function (q) {
    if (!q || !Array.isArray(q.options) || !q.options.some(isCook)) return q;
    return Object.assign({}, q, {
      options: q.options.map(function (o) {
        if (!isCook(o)) return o;
        var min = cs.min_cents;
        return Object.assign({}, o, { cooking: true, price_cents: 0, per_kg_cents: rate != null ? rate : 0 }, min && rate ? { cook_min_cents: min } : {});
      })
    });
  });
}

function buildProductOptionsPatch(body) {
  var prev = body.options && typeof body.options === 'object' ? Object.assign({}, body.options) : {};
  var rawMode = body.size_mode;
  if (rawMode == null || rawMode === '') rawMode = prev.size_mode || 'variable';
  var sizeMode =
    rawMode === 'pack' || rawMode === 'fixed'
      ? 'pack'
      : rawMode === 'each' || rawMode === 'unit' || rawMode === 'individual'
        ? 'each'
        : 'variable';
  var touchingSize =
    body.size_mode !== undefined ||
    body.pack_weight_kg !== undefined ||
    body.pack_label !== undefined;
  if (touchingSize || prev.size_mode == null) {
    var packKg = body.pack_weight_kg != null && body.pack_weight_kg !== ''
      ? Number(body.pack_weight_kg)
      : prev.pack_weight_kg != null
        ? Number(prev.pack_weight_kg)
        : null;
    if (!Number.isFinite(packKg) || packKg <= 0) packKg = null;
    var packLbl =
      body.pack_label !== undefined
        ? String(body.pack_label || '').trim().slice(0, 40)
        : prev.pack_label
          ? String(prev.pack_label).trim().slice(0, 40)
          : '';
    prev.size_mode = sizeMode;
    if (sizeMode === 'pack') {
      prev.pack_weight_kg = packKg;
      prev.pack_label = packLbl || null;
    } else {
      delete prev.pack_weight_kg;
      delete prev.pack_label;
    }
    if (sizeMode === 'each') delete prev.minimum_kg;
  }
  if (body.minimum_kg !== undefined) {
    var minKg =
      body.minimum_kg != null && body.minimum_kg !== ''
        ? Number(body.minimum_kg)
        : null;
    if (Number.isFinite(minKg) && minKg > 0) prev.minimum_kg = Math.round(minKg * 1000) / 1000;
    else delete prev.minimum_kg;
  }
  if (body.quantity_prompt !== undefined) {
    var qp = String(body.quantity_prompt || '').trim().slice(0, 120);
    if (qp) prev.quantity_prompt = qp;
    else delete prev.quantity_prompt;
  }
  if (body.special !== undefined) {
    // Special price (see lib/order/specials.js). Turning it off keeps the settings for next time.
    var { normaliseSpecial } = require('./specials');
    var rawSp = body.special && typeof body.special === 'object' ? body.special : null;
    var sp = rawSp ? normaliseSpecial(Object.assign({}, rawSp, { on: true })) : null;
    if (sp) {
      sp.on = !!rawSp.on;
      prev.special = sp;
    } else {
      delete prev.special;
    }
  }
  var { applyAdditionalCategoriesToOptions } = require('./product-categories');
  return applyAdditionalCategoriesToOptions(prev, body);
}

function slugKey(label, fallback) {
  var s = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return s || fallback || 'option';
}

module.exports = {
  isCountOnlySize,
  productOptions: productOptions,
  isPackSize: isPackSize,
  isEachSize: isEachSize,
  minimumKgOption: minimumKgOption,
  packWeightKg: packWeightKg,
  packLabel: packLabel,
  quantityPrompt: quantityPrompt,
  resolveRequestedWeightKg: resolveRequestedWeightKg,
  normaliseChoice: normaliseChoice,
  questionChoices: questionChoices,
  answerValues: answerValues,
  optionExtrasPerUnitCents: optionExtrasPerUnitCents,
  lineOptionExtras: lineOptionExtras,
  cookingRateCents: cookingRateCents,
  cookingOpts: cookingOpts,
  withCookingRate: withCookingRate,
  buildProductOptionsPatch: buildProductOptionsPatch,
  slugKey: slugKey
};
