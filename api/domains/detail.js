// api/domains/detail.js — domain detail + nameserver control (Dreamscape, signed).
//   GET   ?dreamscape_id= (super) | ?domain_id= (owner)
//         -> { domain_name, name_servers[], expiry_date, status_id, is_locked, privacy, on_dreamscape_dns }
//   PATCH { (dreamscape_id|domain_id), name_servers:["ns1...","ns2..."] }
//         -> update the domain's nameservers
//
// Nameservers are the master switch: the DNS records you manage via dns.js (A,
// CNAME, MX, WEBFWD, MAILFWD) are only authoritative while the domain points at
// Dreamscape's nameservers. on_dreamscape_dns flags whether that's currently true.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Hostnames that indicate the domain is using Dreamscape-managed DNS.
const DS_NS_HINTS = ['ds.network', 'secureparkme.com', 'dreamscape'];

async function isSuper(uid) {
  try { const r = await sb.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle(); return !!(r.data && r.data.is_super_admin); }
  catch (e) { return false; }
}
async function ownedDomain(ourId, user) {
  const r = await sb.from('domains').select('id,user_id,domain_name,dreamscape_domain_id').eq('id', ourId).maybeSingle();
  const row = r.data;
  if (!row) return { error: 'not_found' };
  if (String(row.user_id) !== String(user.id) && !(await isSuper(user.id))) return { error: 'forbidden' };
  if (!row.dreamscape_domain_id) return { error: 'no_dreamscape_id' };
  return { dsId: row.dreamscape_domain_id, name: row.domain_name };
}
async function resolveTarget(req, body, user) {
  const method = req.method;
  const dreamId = method === 'GET' ? req.query.dreamscape_id : body.dreamscape_id;
  if (dreamId) {
    if (!(await isSuper(user.id))) return { error: 'forbidden_super' };
    return { dsId: dreamId, name: (method === 'GET' ? req.query.domain_name : body.domain_name) || '' };
  }
  const ourId = method === 'GET' ? req.query.domain_id : body.domain_id;
  if (!ourId) return { error: 'need_id' };
  return await ownedDomain(ourId, user);
}

module.exports = async (req, res) => {
  try {
    if (!DOMAINS_ENABLED) return res.status(404).json({ error: 'Domain feature disabled' });
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Your session has expired — please sign in again.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const t = await resolveTarget(req, body, user);
    if (t.error === 'need_id')          return res.status(400).json({ error: 'domain_id is required.' });
    if (t.error === 'forbidden_super')  return res.status(403).json({ error: 'Only administrators can manage by Dreamscape ID.' });
    if (t.error === 'not_found')        return res.status(404).json({ error: 'Domain not found.' });
    if (t.error === 'forbidden')        return res.status(403).json({ error: "That domain isn't on your account." });
    if (t.error === 'no_dreamscape_id') return res.status(409).json({ error: "This domain isn't fully registered yet." });
    const dsId = t.dsId;

    if (req.method === 'GET') {
      const r = await ds.getDomain(dsId);
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not load the domain.' });
      const d = (r.data && r.data.data) || {};
      const ns = (d.name_servers || []).map(x => (typeof x === 'string' ? x : (x && x.host))).filter(Boolean).map(s => String(s).toLowerCase());
      const onDs = ns.length > 0 && ns.every(h => DS_NS_HINTS.some(hint => h.indexOf(hint) >= 0));
      return res.status(200).json({
        ok: true, domain: d.domain_name || t.name, name_servers: ns,
        expiry_date: d.expiry_date || null, status_id: d.status_id,
        is_locked: !!d.is_locked, privacy: !!d.privacy, on_dreamscape_dns: onDs
      });
    }

    if (req.method === 'PATCH') {
      const ns = Array.isArray(body.name_servers)
        ? body.name_servers.map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
        : null;
      if (!ns || ns.length < 2) return res.status(400).json({ error: 'Enter at least two nameservers.' });
      const r = await ds.patchDomain(dsId, { name_servers: ns.map(h => ({ host: h })) });
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not update nameservers.' });
      return res.status(200).json({ ok: true, name_servers: ns });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('detail endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
