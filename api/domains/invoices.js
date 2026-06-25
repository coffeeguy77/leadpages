// api/domains/invoices.js — reseller invoices + simple sales stats (super only).
//   GET [?from_date=&to_date=&page=&limit=] -> { invoices[], stats:{ totalPaid, count,
//        currency, by_month:[{month,total}], latest } }
const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function isSuper(uid) {
  try { const r = await sb.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle(); return !!(r.data && r.data.is_super_admin); }
  catch (e) { return false; }
}
function ym(s) { return String(s || '').slice(0, 7); } // YYYY-MM

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
    if (req.query.from_date) q.from_date = req.query.from_date;
    if (req.query.to_date) q.to_date = req.query.to_date;

    const r = await ds.getInvoices(q);
    if (!r.ok) return res.status(502).json({ error: r.error || 'Could not load invoices.' });
    const invoices = (r.data && r.data.data) || [];

    const byMonth = {};
    let totalPaid = 0;
    invoices.forEach(inv => {
      const amt = Number(inv.total_amount) || 0;
      byMonth[ym(inv.order_date)] = (byMonth[ym(inv.order_date)] || 0) + amt;
      if (inv.is_paid) totalPaid += amt;
    });
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      months.push({ month: key, total: Math.round((byMonth[key] || 0) * 100) / 100 });
    }

    return res.status(200).json({
      ok: true,
      invoices: invoices.slice(0, 25),
      stats: {
        totalPaid: Math.round(totalPaid * 100) / 100,
        count: invoices.length,
        currency: (invoices[0] && invoices[0].currency) || 'AUD',
        by_month: months,
        latest: invoices[0] || null
      },
      pagination: (r.data && r.data.pagination) || null
    });
  } catch (e) {
    console.error('invoices endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
