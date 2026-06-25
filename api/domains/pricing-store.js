// pricing-store.js — retail price overrides stored in Supabase (super-editable),
// layered over the PRICE_TABLE fallback in dreamscape.js. Used by availability.js
// (display) and checkout.js (charge) so both price from one source.
const ds = require('./dreamscape');

// Returns { tld: retail } from the domain_pricing table. Never throws.
async function loadRetailMap(sb) {
  try {
    const r = await sb.from('domain_pricing').select('tld, retail');
    const map = {};
    for (const row of (r.data || [])) {
      if (row && row.tld != null) {
        const v = Number(row.retail);
        if (isFinite(v) && v > 0) map[String(row.tld).toLowerCase()] = v;
      }
    }
    return map;
  } catch (e) { return {}; }
}

// Retail price for a TLD: DB override first, then PRICE_TABLE fallback.
function retailFor(map, tld) {
  const t = String(tld || '').toLowerCase();
  if (map && map[t] != null) return map[t];
  return ds.priceFor(t);
}

module.exports = { loadRetailMap, retailFor };
