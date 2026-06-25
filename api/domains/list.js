// api/domains/list.js — the domains the signed-in user can manage.
//   super  -> ALL domains in your Dreamscape reseller account (ds.listDomains),
//             so an admin can manage DNS/email for every client domain.
//   client -> only their own platform-registered domains (Supabase domains table).
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

    if (await isSuper(user.id)) {
      // Admin: pull the whole reseller account from Dreamscape (up to 100).
      const r = await ds.listDomains({ limit: 100 });
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not load domains from Dreamscape.' });
      const rows = ((r.data && r.data.data) || []).map(d => ({
        domain_name: String(d.domain_name || '').toLowerCase(),
        dreamscape_id: d.id,
        status_id: d.status_id,
        expiry_date: d.expiry_date || null,
        manage: 'dreamscape'
      })).sort((a, b) => a.domain_name.localeCompare(b.domain_name));
      return res.status(200).json({ ok: true, super: true, domains: rows });
    }

    // Client: their own registered domains (RLS-safe via service role + explicit filter).
    const r = await sb.from('domains')
      .select('id,domain_name,status,dreamscape_domain_id,site_id,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: true });
    const rows = (r.data || []).map(d => ({
      id: d.id,
      domain_name: d.domain_name,
      status: d.status,
      dreamscape_id: d.dreamscape_domain_id || null,
      manage: 'ours'
    }));
    return res.status(200).json({ ok: true, super: false, domains: rows });
  } catch (e) {
    console.error('list endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
