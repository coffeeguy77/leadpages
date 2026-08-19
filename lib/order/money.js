'use strict';

/** Integer-cent money helpers — never use floats for AUD totals. */

function toCents(amount) {
  if (amount == null || amount === '') return 0;
  if (typeof amount === 'number' && Number.isInteger(amount)) return amount;
  const n = Number(String(amount).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents) {
  const c = Number(cents) || 0;
  return (c / 100).toFixed(2);
}

function formatAud(cents) {
  const neg = (Number(cents) || 0) < 0;
  const abs = Math.abs(Number(cents) || 0);
  return (neg ? '-' : '') + '$' + fromCents(abs);
}

function mulWeightRate(weightKg, rateCentsPerKg) {
  const w = Number(weightKg);
  const r = Number(rateCentsPerKg);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r < 0) return null;
  // Round once at the end: cents = round(kg * cents_per_kg)
  return Math.round(w * r);
}

function addCents() {
  var t = 0;
  for (var i = 0; i < arguments.length; i++) t += Number(arguments[i]) || 0;
  return t;
}

module.exports = { toCents, fromCents, formatAud, mulWeightRate, addCents };
