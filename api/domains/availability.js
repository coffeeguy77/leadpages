// api/domains/availability.js — server-side domain search via Dreamscape (signed).
const ds = require('../../dreamscape');

if (process.env.DOMAIN_FEATURE_ENABLED === 'false') {
  module.exports = (req, res) => res.status(404).json({ error: 'Domain feature disabled' });
} else {

const HITS = new Map();
function limited(ip) { const now = Date.now(); const a = (HITS.get(ip) || []).filter(t => now - t < 10000); a.push(now); HITS.set(ip, a); return a.length > 12; }

const cleanLabel = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9-\s]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

function parseQuery(q) {
  q = String(q || '').trim().toLowerCase();
  const m = q.match(/^([a-z0-9-]+)\.((?:com\.au|net\.au|org\.au|com|net|org|au|co|io))$/);
  if (m) return { label: cleanLabel(m[1]), tld: m[2], hadTld: true };
  return { label: cleanLabel(q), tld: null, hadTld: false };
}

function buildCandidates({ label, tld, hadTld }, extras) {
  const set = new Set(), out = [];
  const push = (lab, t, kind, badge) => { if (!lab) return; const d = `${lab}.${t}`; if (set.has(d)) return; set.add(d); out.push({ label: lab, tld: t, domain: d, kind, badge }); };
  for (const t of ds.PRIORITY_TLDS) push(label, t, (hadTld && t === tld) ? 'exact' : 'exact-tld',
    t === 'com.au' ? 'Best for Australian business' : (t === 'au' ? 'Short & clean' : (t === 'com' ? 'Global' : null)));
  for (const loc of (extras.locations || ['canberra', 'act']).map(cleanLabel).filter(Boolean).slice(0, 2)) push(`${label}-${loc}`, 'com.au', 'alt', 'Local');
  for (const s of (extras.services || []).map(cleanLabel).filter(Boolean).slice(0, 2)) push(`${label}-${s}`, 'com.au', 'alt', 'Descriptive');
  push(`get${label}`, 'com.au', 'alt', 'Short & clean');
  return out.slice(0, 14);
}

// map one entry of Dreamscape's availability data[] to {domain, available, register, renew}
function readEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const domain = (e.domain_name || e.domain || e.name || '').toLowerCase();
  let available = null;
  if (typeof e.available === 'boolean') available = e.available;
  else if (typeof e.is_available === 'boolean') available = e.is_available;
  else if (typeof e.availability === 'boolean') available = e.availability;
  else { const s = String(e.status || e.availability || '').toLowerCase(); if (s.includes('avail')) available = true; else if (s.includes('taken') || s.includes('registered') || s.includes('unavail')) available = false; }
  const toNum = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
  const reg = toNum(e.register_price != null ? e.register_price : (e.price && e.price.register));
  const ren = toNum(e.renew_price != null ? e.renew_price : (e.price && e.price.renew));
  return { domain, available, register: reg, renew: ren };
}

module.exports = async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon';
    if (limited(ip)) return res.status(429).json({ error: 'Too many searches — try again in a moment.' });
    const q = (req.query && (req.query.q || req.query.domain)) || '';
    if (!q || String(q).trim().length < 2) return res.status(400).json({ error: 'Enter a domain or business name.' });
    const parsed = parseQuery(q);
    if (!parsed.label) return res.status(400).json({ error: "That doesn't look like a valid name." });

    const extras = { locations: req.query.locations ? String(req.query.locations).split(',') : ['canberra', 'act'], services: req.query.services ? String(req.query.services).split(',') : [] };
    const candidates = buildCandidates(parsed, extras);

    // one signed call for all candidates
    const r = await ds.checkAvailability(candidates.map(c => c.domain));
    const list = r.ok && r.data && Array.isArray(r.data.data) ? r.data.data : [];
    const byDomain = {};
    for (const e of list) { const m = readEntry(e); if (m && m.domain) byDomain[m.domain] = m; }

    const results = candidates.map(c => {
      const m = byDomain[c.domain] || null;
      const dsReg = m && m.register != null ? m.register : null;
      const price = ds.resolveSell(c.tld, dsReg);
      return {
        domain: c.domain, label: c.label, tld: c.tld, kind: c.kind, badge: c.badge,
        available: m ? m.available : ((c.domain in byDomain) ? byDomain[c.domain] : null),
        price,
        renew: (m && m.renew != null) ? m.renew : null,
        priceSource: (ds.DOMAIN_PRICE_SOURCE !== 'table' && dsReg != null) ? 'dreamscape' : 'table',
        dsRegisterPrice: dsReg,            // raw Dreamscape number, for your verification
        privacyPrice: ds.PRIVACY_PRICE
      };
    });
    const order = { exact: 0, 'exact-tld': 1, alt: 2 };
    results.sort((a, b) => (order[a.kind] - order[b.kind]) || ds.PRIORITY_TLDS.indexOf(a.tld) - ds.PRIORITY_TLDS.indexOf(b.tld));

    res.setHeader('cache-control', 'no-store');
    return res.status(200).json(Object.assign({ query: q, label: parsed.label, results }, req.query.debug ? { _raw: r.data } : {}));
  } catch (e) {
    console.error('availability error:', e);
    return res.status(502).json({ error: 'Domain search is temporarily unavailable. Please try again shortly.' });
  }
};

}
