'use strict';

/**
 * Weight helpers for order products — minimum kg, poultry size codes, shop copy.
 * AU poultry: size number is often dressed weight × 10 (size 60 ≈ 6 kg).
 */

const { parseSizeWeightKg } = require('./import-parse');
const { productOptions } = require('./product-options');

const POULTRY_PART_WORDS =
  /\b(breast|buffe|butterfly|roll|mince|minced|wing|drum|maryland|thigh|fillet|kebab|sausage|schnitzel|pie|stuffed|deboned|boneless|half|quarter|buffet)\b/i;

function roundKg(n) {
  var x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return Math.round(x * 1000) / 1000;
}

/** Size code (e.g. 60) → kg using AU dressed-weight shorthand (÷10). */
function poultrySizeCodeToKg(code) {
  var n = parseInt(String(code || ''), 10);
  if (!Number.isFinite(n) || n < 10 || n > 200) return null;
  return roundKg(n / 10);
}

function formatKgRange(lowKg, highKg) {
  if (lowKg == null) return '';
  if (highKg == null || Math.abs(highKg - lowKg) < 0.05) {
    var one = lowKg >= 1 ? String(Math.round(lowKg * 10) / 10).replace(/\.0$/, '') : String(lowKg);
    return one + ' kg';
  }
  var lo = Math.floor(lowKg);
  var hi = Math.ceil(highKg);
  if (hi <= lo) hi = lo + 1;
  return lo + '–' + hi + ' kg';
}

/**
 * Extract poultry size range from product name / short description.
 * Returns { sizeLow, sizeHigh, kgLow, kgHigh } or null.
 */
function extractPoultrySizeRange(name, shortDescription) {
  var hay = String(name || '') + ' ' + String(shortDescription || '');
  var m =
    hay.match(/\bsize\s*(\d{2,3})\s*(?:[-–—]\s*(\d{2,3}))?\b/i) ||
    hay.match(/\bsz\.?\s*(\d{2,3})\s*(?:[-–—]\s*(\d{2,3}))?\b/i) ||
    hay.match(/\b(\d{2,3})\s*[-–—]\s*(\d{2,3})\b/);
  if (!m) {
    var single = hay.match(/\bsize\s*(\d{2,3})\b/i);
    if (!single) return null;
    m = [single[0], single[1], null];
  }
  var sizeLow = parseInt(m[1], 10);
  var sizeHigh = m[2] != null ? parseInt(m[2], 10) : sizeLow;
  if (!Number.isFinite(sizeLow)) return null;
  if (!Number.isFinite(sizeHigh)) sizeHigh = sizeLow;
  if (sizeLow > sizeHigh) {
    var t = sizeLow;
    sizeLow = sizeHigh;
    sizeHigh = t;
  }
  var kgLow = poultrySizeCodeToKg(sizeLow);
  var kgHigh = poultrySizeCodeToKg(sizeHigh);
  if (kgLow == null) return null;
  return {
    sizeLow: sizeLow,
    sizeHigh: sizeHigh,
    kgLow: kgLow,
    kgHigh: kgHigh || kgLow
  };
}

function poultryKind(name) {
  var n = String(name || '').toLowerCase();
  if (/\bturkey\b/.test(n)) return 'turkey';
  if (/\b(chicken|chook)\b/.test(n)) return 'chicken';
  return null;
}

/** Whole bird sold by quantity (size in name), not by kg entry. */
function isPoultryWholeBirdProduct(product) {
  var name = product && product.name;
  if (!name) return false;
  if (POULTRY_PART_WORDS.test(name)) return false;
  var kind = poultryKind(name);
  if (!kind) return false;
  if (/\bwhole\b/i.test(name)) return true;
  var range = extractPoultrySizeRange(name, product.short_description);
  if (range) return true;
  return false;
}

function poultryQuantityPrompt(kind) {
  if (kind === 'turkey') return 'How many turkeys would you like?';
  if (kind === 'chicken') return 'How many chickens would you like?';
  return 'How many would you like?';
}

function buildPoultryWholeBirdCopy(product) {
  var kind = poultryKind(product.name);
  var range = extractPoultrySizeRange(product.name, product.short_description);
  if (!range) {
    return {
      short_description: 'Sold per bird.',
      quantity_prompt: null
    };
  }
  var sizeLabel =
    range.sizeLow === range.sizeHigh
      ? 'Size ' + range.sizeLow
      : 'Size ' + range.sizeLow + '–' + range.sizeHigh;
  var kgLabel = formatKgRange(range.kgLow, range.kgHigh);
  var birdWord = kind === 'turkey' ? 'turkey' : 'chicken';
  return {
    short_description: sizeLabel + ' (about ' + kgLabel + ' per ' + birdWord + ').',
    quantity_prompt: null
  };
}

/** Parse minimum kg from short description or embedded in name. */
function parseMinimumKgFromText(text) {
  var s = String(text || '').trim();
  if (!s) return null;
  return parseSizeWeightKg(s);
}

function minimumKg(product) {
  var o = productOptions(product);
  if (o.minimum_kg != null) {
    var n = Number(o.minimum_kg);
    if (Number.isFinite(n) && n > 0) return roundKg(n);
  }
  if (product && product.minimum_kg != null) {
    var p = Number(product.minimum_kg);
    if (Number.isFinite(p) && p > 0) return roundKg(p);
  }
  return null;
}

/** Default kg shown in shop stepper (minimum if set, else 1). */
function defaultWeightKg(product) {
  var min = minimumKg(product);
  if (min != null) return min;
  return 1;
}

function weightStepKg(product) {
  var min = minimumKg(product);
  if (min != null && min < 1) return 0.1;
  return 0.1;
}

/** True when short text is only weight info (safe to clear after migrating min kg). */
function isWeightOnlyText(text) {
  var s = String(text || '').trim();
  if (!s) return false;
  if (parseMinimumKgFromText(s) == null) return false;
  var stripped = s
    .replace(/[\d.,\s]+/g, ' ')
    .replace(/\b(kg|kgs|g|grams?|approx|approximately|about|min|minimum|weight)\b/gi, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length <= 2;
}

function stripWeightFromText(text) {
  var s = String(text || '').trim();
  if (!s) return '';
  if (isWeightOnlyText(s)) return '';
  return s
    .replace(/\b(?:approx\.?|about|min\.?|minimum)?\s*[\d.]+\s*(?:kg|kgs|g)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = {
  roundKg: roundKg,
  poultrySizeCodeToKg: poultrySizeCodeToKg,
  formatKgRange: formatKgRange,
  extractPoultrySizeRange: extractPoultrySizeRange,
  poultryKind: poultryKind,
  isPoultryWholeBirdProduct: isPoultryWholeBirdProduct,
  buildPoultryWholeBirdCopy: buildPoultryWholeBirdCopy,
  parseMinimumKgFromText: parseMinimumKgFromText,
  minimumKg: minimumKg,
  defaultWeightKg: defaultWeightKg,
  weightStepKg: weightStepKg,
  isWeightOnlyText: isWeightOnlyText,
  stripWeightFromText: stripWeightFromText
};
