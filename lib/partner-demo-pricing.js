/** Default one-off demo sale price shown on the "Get this website" bar ($2,000). */
const DEFAULT_DEMO_SALE_PRICE_CENTS = 200000;

function effectiveDemoSalePrice(site, quotePrice) {
  if (quotePrice != null) return Math.round(Number(quotePrice) || 0);
  const stored = Math.round(Number(site && site.sale_price) || 0);
  if (stored > 0) return stored;
  if (site && site.is_mockup) return DEFAULT_DEMO_SALE_PRICE_CENTS;
  return 0;
}

module.exports = { DEFAULT_DEMO_SALE_PRICE_CENTS, effectiveDemoSalePrice };
