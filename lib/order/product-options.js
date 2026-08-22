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

/** Individual / each — qty only, no pack weight or “X pack” label. */
function isEachSize(product) {
  var o = productOptions(product);
  return o.size_mode === 'each' || o.size_mode === 'unit' || o.size_mode === 'individual';
}

function packWeightKg(product) {
  if (!isPackSize(product)) return null;
  var o = productOptions(product);
  var w = o.pack_weight_kg != null ? Number(o.pack_weight_kg) : null;
  return w != null && Number.isFinite(w) && w > 0 ? w : null;
}

/**
 * Customisable prompt under the product name (e.g. "How many would you like?").
 * Independent of pack size — works for individual / pack / weight items.
 * Also recovers prompts mistakenly saved as pack_label (appended with " pack" on the shop).
 */
function quantityPrompt(product) {
  var o = productOptions(product);
  var raw = o.quantity_prompt != null ? String(o.quantity_prompt).trim() : '';
  if (raw) return raw.slice(0, 120);
  // Recover: pack_label used as under-item copy on a non-pack product
  if (!isPackSize(product) && o.pack_label) {
    var orphan = String(o.pack_label).trim();
    if (orphan) return orphan.slice(0, 120);
  }
  if (isPackSize(product) && o.pack_label && !packWeightKg(product)) {
    var maybe = String(o.pack_label).trim();
    if (maybe && /[?]/.test(maybe) && !/^\d+(\.\d+)?\s*(g|kg)$/i.test(maybe)) {
      return maybe.slice(0, 120);
    }
  }
  return '';
}

/**
 * Pack size label (e.g. "800g") — only when Sold as = Fixed pack size.
 * Never treat quantity prompts / short copy as a pack label.
 */
function packLabel(product) {
  if (!isPackSize(product)) return '';
  var o = productOptions(product);
  if (o.pack_label) {
    var lbl = String(o.pack_label).trim();
    // Don't treat a quantity prompt stuck in pack_label as a pack size
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
  var rawMode = body.size_mode != null ? String(body.size_mode) : 'variable';
  var sizeMode =
    rawMode === 'pack' || rawMode === 'fixed'
      ? 'pack'
      : rawMode === 'each' || rawMode === 'unit' || rawMode === 'individual'
        ? 'each'
        : 'variable';
  var packKg = body.pack_weight_kg != null && body.pack_weight_kg !== ''
    ? Number(body.pack_weight_kg)
    : null;
  if (!Number.isFinite(packKg) || packKg <= 0) packKg = null;
  var packLbl = body.pack_label != null ? String(body.pack_label).trim().slice(0, 40) : '';
  var qtyPrompt =
    body.quantity_prompt != null
      ? String(body.quantity_prompt).trim().slice(0, 120)
      : body.options && body.options.quantity_prompt != null
        ? String(body.options.quantity_prompt).trim().slice(0, 120)
        : '';
  var prev = body.options && typeof body.options === 'object' ? Object.assign({}, body.options) : {};
  prev.size_mode = sizeMode;
  if (qtyPrompt) prev.quantity_prompt = qtyPrompt;
  else delete prev.quantity_prompt;
  if (sizeMode === 'pack') {
    prev.pack_weight_kg = packKg;
    prev.pack_label = packLbl || null;
  } else {
    delete prev.pack_weight_kg;
    delete prev.pack_label;
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
  isEachSize: isEachSize,
  packWeightKg: packWeightKg,
  packLabel: packLabel,
  quantityPrompt: quantityPrompt,
  resolveRequestedWeightKg: resolveRequestedWeightKg,
  normaliseChoice: normaliseChoice,
  questionChoices: questionChoices,
  answerValues: answerValues,
  optionExtrasPerUnitCents: optionExtrasPerUnitCents,
  buildProductOptionsPatch: buildProductOptionsPatch,
  slugKey: slugKey
};
