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

function packWeightKg(product) {
  var o = productOptions(product);
  var w = o.pack_weight_kg != null ? Number(o.pack_weight_kg) : null;
  return w != null && Number.isFinite(w) && w > 0 ? w : null;
}

function packLabel(product) {
  var o = productOptions(product);
  if (o.pack_label) return String(o.pack_label);
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
  return { label: label, value: value, price_cents: Math.round(price) };
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

/** Extra cents per unit from selected paid options. */
function optionExtrasPerUnitCents(questions, answers) {
  var extra = 0;
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
  return { extra_cents: extra, selected: selected };
}

function buildProductOptionsPatch(body) {
  var sizeMode = body.size_mode === 'pack' || body.size_mode === 'fixed' ? 'pack' : 'variable';
  var packKg = body.pack_weight_kg != null && body.pack_weight_kg !== ''
    ? Number(body.pack_weight_kg)
    : null;
  if (!Number.isFinite(packKg) || packKg <= 0) packKg = null;
  var packLbl = body.pack_label != null ? String(body.pack_label).trim().slice(0, 40) : '';
  var prev = body.options && typeof body.options === 'object' ? Object.assign({}, body.options) : {};
  prev.size_mode = sizeMode;
  if (sizeMode === 'pack') {
    prev.pack_weight_kg = packKg;
    prev.pack_label = packLbl || null;
  } else {
    delete prev.pack_weight_kg;
    delete prev.pack_label;
    prev.size_mode = 'variable';
  }
  return prev;
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
  productOptions: productOptions,
  isPackSize: isPackSize,
  packWeightKg: packWeightKg,
  packLabel: packLabel,
  resolveRequestedWeightKg: resolveRequestedWeightKg,
  normaliseChoice: normaliseChoice,
  questionChoices: questionChoices,
  answerValues: answerValues,
  optionExtrasPerUnitCents: optionExtrasPerUnitCents,
  buildProductOptionsPatch: buildProductOptionsPatch,
  slugKey: slugKey
};
