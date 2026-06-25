// api/domains/pricing.js — Pricing admin (super-admin only).
//   GET  -> [{ tld, wholesale, retail, profit }]  (wholesale from the live API,
//           retail from domain_pricing/table, profit = retail - wholesale)
//   POST { updates:[{tld, retail}] }               -> save manual retail edits
//   POST { bulk_percent: 200 }                     -> retail = wholesale * (1 + pct/100)
//
// Wholesale comes from GET /domains/tlds (your reseller cost). Retail is stored in
// the domain_pricing table and is what the storefront + portal charge.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Retail overrides from the domain_pricing table (inlined so there's no extra
// root file to deploy). Never throws.
async function loadRetailMap(s) {
  try {
    const r = await s.from('domain_pricing').select('tld, retail');
    const m = {};
    for (const row of (r.data || [])) {
      if (row && row.tld != null) { const v = Number(row.retail); if (isFinite(v) && v > 0) m[String(row.tld).toLowerCase()] = v; }
    }
    return m;
  } catch (e) { return {}; }
}
function retailFor(map, tld) { const t = String(tld || '').toLowerCase(); return (map && map[t] != null) ? map[t] : ds.priceFor(t); }

// The TLDs you sell (drives which rows the admin shows).
const SELLABLE_TLDS = [
  'com.au', 'net.au', 'org.au', 'id.au', 'asn.au', 'au',
  'sydney', 'melbourne',
  'nz', 'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'gen.nz', 'geek.nz', 'maori.nz', 'school.nz', 'kiwi', 'kiwi.nz',
  'com', 'net', 'org', 'app', 'io', 'co'
];

async function isSuper(userId) {
  try {
    const r = await sb.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (e) { return false; }
}

function num(v) { const n = Number(v); return isFinite(n) ? n : null; }

// Build { tld: wholesale } from the live /domains/tlds response.
async function loadWholesale() {
  const map = {};
  try {
    const r = await ds.listTlds({ 'tlds[]': SELLABLE_TLDS, limit: 100 });    const rows = (r.ok && r.data && Array.isArray(r.data.data)) ? r.data.data : [];
    for (const row of rows) {
      const t = String(row.tld || '').toLowerCase();
      const w = num(row.price && (row.price.register != null ? row.price.register : row.price.wholesale));
      if (t && w != null) map[t] = w;
    }
  } catch (e) { /* leave gaps; UI shows — */ }
  return map;
}

module.exports = async (req, res) => {
  try {
    if (!DOMAINS_ENABLED) return res.status(404).json({ error: 'Domain feature disabled' });

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Your session has expired — please sign in again.' });
    if (!(await isSuper(user.id))) return res.status(403).json({ error: 'Pricing is restricted to administrators.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (req.method === 'GET') {
      const [wholesale, retailMap] = await Promise.all([loadWholesale(), loadRetailMap(sb)]);
      const rows = SELLABLE_TLDS.map(t => {
        const w = wholesale[t] != null ? wholesale[t] : null;
        const retail = retailFor(retailMap, t);
        return { tld: t, wholesale: w, retail, profit: (w != null && retail != null) ? Math.round((retail - w) * 100) / 100 : null };
      });
      return res.status(200).json({ ok: true, rows });
    }

    if (req.method === 'POST') {
      // Bulk: set retail = wholesale * (1 + pct/100) for every sellable TLD.
      if (body.bulk_percent != null) {
        const pct = Number(body.bulk_percent);
        if (!isFinite(pct)) return res.status(400).json({ error: 'bulk_percent must be a number.' });
        const wholesale = await loadWholesale();
        const ups = [];
        for (const t of SELLABLE_TLDS) {
          const w = wholesale[t];
          if (w != null) ups.push({ tld: t, retail: Math.round(w * (1 + pct / 100) * 100) / 100, updated_by: user.id, updated_at: new Date().toISOString() });
        }
        if (ups.length) {
          const r = await sb.from('domain_pricing').upsert(ups, { onConflict: 'tld' });
          if (r.error) return res.status(502).json({ error: r.error.message || 'Could not save prices.' });
        }
        return res.status(200).json({ ok: true, updated: ups.length });
      }

      // Manual: save explicit retail values.
      const updates = Array.isArray(body.updates) ? body.updates : [];
      const ups = [];
      for (const u of updates) {
        const t = String(u.tld || '').toLowerCase();
        const retail = num(u.retail);
        if (t && retail != null && retail >= 0) ups.push({ tld: t, retail, updated_by: user.id, updated_at: new Date().toISOString() });
      }
      if (!ups.length) return res.status(400).json({ error: 'No valid prices to save.' });
      const r = await sb.from('domain_pricing').upsert(ups, { onConflict: 'tld' });
      if (r.error) return res.status(502).json({ error: r.error.message || 'Could not save prices.' });
      return res.status(200).json({ ok: true, updated: ups.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('pricing endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
