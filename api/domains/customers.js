// api/domains/customers.js — your Dreamscape client accounts (super only).
//   GET [?page=&limit=&domain=] -> { customers:[...] }
const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function isSuper(uid) {
  try { const r = await sb.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle(); return !!(r.data && r.data.is_super_admin); }
  catch (e) { return false; }
}
function pick(c) {
  // Pass through the common fields, however the account is shaped.
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return {
    id: c.id,
    name: name || c.name || c.company || '—',
    company: c.company || c.business_name || '',
    email: c.email || '',
    phone: c.phone || '',
    country: c.country || c.country_code || ''
  };
}

module.exports = async (req, res) => {
  try {
    if (!DOMAINS_ENABLED) return res.status(404).json({ error: 'Domain feature disabled' });
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Your session has expired — please sign in again.' });
    if (!(await isSuper(user.id))) return res.status(403).json({ error: 'Admin only.' });

    const q = { limit: Math.min(Number(req.query.limit) || 100, 100), page: Number(req.query.page) || 1 };
    if (req.query.domain) q.domain_name = req.query.domain;

    const r = await ds.listCustomers(q);
    if (!r.ok) return res.status(502).json({ error: r.error || 'Could not load client accounts.' });
    const customers = ((r.data && r.data.data) || []).map(pick);
    return res.status(200).json({ ok: true, customers, pagination: (r.data && r.data.pagination) || null });
  } catch (e) {
    console.error('customers endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
