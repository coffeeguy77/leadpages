// api/domains/availability.js — server-side domain search.
// The browser calls THIS; this calls Dreamscape with our reseller credentials.
// Read-only: checks availability + builds suggestions. No money, no registration.

const ds = require('../../dreamscape');

if (process.env.DOMAIN_FEATURE_ENABLED === 'false') {
  module.exports = (req, res) => res.status(404).json({ error: 'Domain feature disabled' });
} else {

// crude in-memory rate limit (per warm instance) to protect our reseller quota
const HITS = new Map();
function limited(ip) {
  const now = Date.now(), win = 10000, max = 12;
  const a = (HITS.get(ip) || []).filter(t => now - t < win);
  a.push(now); HITS.set(ip, a);
  return a.length > max;
}

const cleanLabel = s => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9-\s]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

function parseQuery(q) {
  q = String(q || '').trim().toLowerCase();
  const m = q.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.((?:com\.au|net\.au|org\.au|com|net|org|au|co|io))$/);
  if (m) return { label: cleanLabel(m[1]), tld: m[2], hadTld: true };
  return { label: cleanLabel(q), tld: null, hadTld: false };
}

// Build the candidate list: exact match across priority TLDs, then smart alternatives.
function buildCandidates({ label, tld, hadTld }, extras) {
  const tlds = ds.PRIORITY_TLDS;
  const set = new Set();
  const out = [];
  const push = (lab, t, kind, badge) => {
    if (!lab) return;
    const name = `${lab}.${t}`;
    if (set.has(name)) return; set.add(name);
    out.push({ label: lab, tld: t, domain: name, kind, badge });
  };
  if (hadTld) push(label, tld, 'exact', 'Your domain');
  // exact label across priority TLDs
  for (const t of tlds) push(label, t, hadTld && t === tld ? 'exact' : 'exact-tld',
    t === 'com.au' ? 'Best for Australian business' : (t === 'au' ? 'Short & clean' : (t === 'com' ? 'Global' : null)));
  // location + service alternatives (only a few, professional)
  const locs = (extras.locations || ['canberra', 'act']).map(cleanLabel).filter(Boolean);
  const svcs = (extras.services || []).map(cleanLabel).filter(Boolean).slice(0, 2);
  for (const loc of locs.slice(0, 2)) { push(`${label}-${loc}`, 'com.au', 'alt', 'Local'); }
  for (const s of svcs) { push(`${label}-${s}`, 'com.au', 'alt', 'Descriptive'); }
  push(`get${label}`, 'com.au', 'alt', 'Short & clean');
  push(`${label}group`, 'com.au', 'alt', null);
  return out.slice(0, 14);
}

// Normalize Dreamscape's availability payload (shape varies; be defensive + keep raw).
function readAvailable(data) {
  if (data == null) return null;
  if (typeof data.available === 'boolean') return data.available;
  if (typeof data.is_available === 'boolean') return data.is_available;
  const s = String(data.status || data.availability || (data.data && data.data.status) || '').toLowerCase();
  if (s.includes('avail')) return true;
  if (s.includes('taken') || s.includes('registered') || s.includes('unavail')) return false;
  if (data.data && typeof data.data.available === 'boolean') return data.data.available;
  return null; // unknown — UI shows "checked manually"
}

module.exports = async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon';
    if (limited(ip)) return res.status(429).json({ error: 'Too many searches — try again in a moment.' });

    const q = (req.query && (req.query.q || req.query.domain)) || '';
    if (!q || String(q).trim().length < 2) return res.status(400).json({ error: 'Enter a domain or business name.' });

    const parsed = parseQuery(q);
    if (!parsed.label) return res.status(400).json({ error: 'That doesn\'t look like a valid name.' });

    const extras = {
      locations: (req.query.locations ? String(req.query.locations).split(',') : ['canberra', 'act']),
      services: (req.query.services ? String(req.query.services).split(',') : [])
    };
    const candidates = buildCandidates(parsed, extras);

    const results = await Promise.all(candidates.map(async (c) => {
      const r = await ds.checkAvailability(c.domain);
      const available = r.ok ? readAvailable(r.data) : null;
      return {
        domain: c.domain, label: c.label, tld: c.tld, kind: c.kind, badge: c.badge,
        available,
        price: ds.priceFor(c.tld),
        privacyPrice: ds.PRIVACY_PRICE,
        // raw passthrough helps us confirm the real shape on first deploy (debug only)
        _debug: (req.query.debug ? { status: r.status, data: r.data, error: r.error } : undefined)
      };
    }));

    const order = { exact: 0, 'exact-tld': 1, alt: 2 };
    results.sort((a, b) => (order[a.kind] - order[b.kind]) || ds.PRIORITY_TLDS.indexOf(a.tld) - ds.PRIORITY_TLDS.indexOf(b.tld));

    res.setHeader('cache-control', 'no-store');
    return res.status(200).json({ query: q, label: parsed.label, results });
  } catch (e) {
    console.error('availability error:', e);
    return res.status(502).json({ error: 'Domain search is temporarily unavailable. Please try again shortly.' });
  }
};

}
