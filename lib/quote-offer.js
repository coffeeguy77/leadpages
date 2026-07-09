/** Limited-time quote offer helpers (countdown buy-now links). */

function clampDiscount(pct) {
  return Math.min(50, Math.max(1, Math.round(Number(pct) || 0)));
}

function clampHours(hours) {
  return Math.min(168, Math.max(1, Math.round(Number(hours) || 72)));
}

function discountedPriceCents(baseCents, discountPct) {
  const base = Math.round(Number(baseCents) || 0);
  if (base <= 0) return 0;
  const pct = clampDiscount(discountPct);
  return Math.max(0, base - Math.round((base * pct) / 100));
}

function buildOfferTimestamps(hours, now) {
  const h = clampHours(hours);
  const started = now ? new Date(now) : new Date();
  const expires = new Date(started.getTime() + h * 3600000);
  return {
    offer_hours: h,
    offer_started_at: started.toISOString(),
    offer_expires_at: expires.toISOString(),
  };
}

function isOfferActive(quote, now) {
  if (!quote) return false;
  const pct = Math.round(Number(quote.offer_discount_pct) || 0);
  if (pct <= 0) return false;
  const exp = quote.offer_expires_at;
  if (!exp) return false;
  const ts = (now != null ? new Date(now) : new Date()).getTime();
  return new Date(exp).getTime() > ts;
}

function effectiveQuotePriceCents(quote, now) {
  const base = Math.round(Number(quote && quote.price) || 0);
  if (!isOfferActive(quote, now)) return base;
  return discountedPriceCents(base, quote.offer_discount_pct);
}

function publicOfferFields(quote, now) {
  const base = Math.round(Number(quote && quote.price) || 0);
  const pct = Math.round(Number(quote && quote.offer_discount_pct) || 0);
  const active = isOfferActive(quote, now);
  const offerPrice = active ? discountedPriceCents(base, pct) : null;
  return {
    offer_discount_pct: pct || null,
    offer_hours: quote && quote.offer_hours != null ? quote.offer_hours : null,
    offer_started_at: (quote && quote.offer_started_at) || null,
    offer_expires_at: (quote && quote.offer_expires_at) || null,
    offer_active: active,
    offer_price: offerPrice,
    offer_savings: active && offerPrice != null ? Math.max(0, base - offerPrice) : null,
  };
}

function applyOfferToRow(row, enabled, discountPct, hours) {
  if (!enabled) {
    row.offer_discount_pct = null;
    row.offer_hours = null;
    row.offer_started_at = null;
    row.offer_expires_at = null;
    return row;
  }
  const pct = clampDiscount(discountPct || 20);
  const times = buildOfferTimestamps(hours || 72);
  row.offer_discount_pct = pct;
  row.offer_hours = times.offer_hours;
  row.offer_started_at = times.offer_started_at;
  row.offer_expires_at = times.offer_expires_at;
  return row;
}

module.exports = {
  clampDiscount,
  clampHours,
  discountedPriceCents,
  buildOfferTimestamps,
  isOfferActive,
  effectiveQuotePriceCents,
  publicOfferFields,
  applyOfferToRow,
};
