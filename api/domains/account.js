// api/domains/account.js — Dreamscape reseller account balance (super-admin only).
const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function isSuper(uid) {
  try { const r = await sb.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle(); return !!(r.data && r.data.is_super_admin); }
  catch (e) { return false; }
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

    const r = await ds.getBalance();
    if (!r.ok) return res.status(502).json({ error: r.error || 'Could not read balance.' });
    const b = ds.readBalance(r) || {};
    const ev = (b.balance != null) ? ds.evaluateBalance(b.balance, 0) : { decision: 'unknown' };
    return res.status(200).json({
      ok: true,
      balance: b.balance != null ? b.balance : null,
      currency: b.currency || 'AUD',
      reserve: ev.reserve != null ? ev.reserve : null,
      decision: ev.decision,
      warning: ev.warning || null
    });
  } catch (e) {
    console.error('account endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
