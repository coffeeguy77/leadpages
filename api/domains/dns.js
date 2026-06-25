// api/domains/dns.js — manage a domain's DNS records via Dreamscape (signed).
// Auth: a signed-in LeadPages user who OWNS the domain (or a super-admin).
// Records use the domain-level surface /domains/{domain_id}/dns, which supports
// A, AAAA, CNAME, TXT, MX, SRV, CAA, plus WEBFWD (URL forwarding) and MAILFWD
// (forward info@theirdomain -> an external inbox like Gmail).
//
// Methods:
//   GET    ?domain_id=<our-uuid>[&type=A]          -> list records
//   POST   { domain_id, record:{type,...} }        -> add a record
//   PATCH  { domain_id, record_id, record:{...} }   -> update a record
//   DELETE { domain_id, record_id }                 -> delete a record
//
// `domain_id` is OUR Supabase domains.id (uuid). We resolve the Dreamscape
// numeric id (dreamscape_domain_id) after confirming ownership, so a client can
// never touch a domain that isn't theirs.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'CAA', 'WEBFWD', 'MAILFWD'];

async function isSuper(userId) {
  try {
    const r = await sb.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (e) { return false; }
}

// Resolve our domains row and confirm the caller owns it (or is super).
async function ownedDomain(ourId, user) {
  const r = await sb.from('domains')
    .select('id, user_id, domain_name, dreamscape_domain_id, site_id')
    .eq('id', ourId).maybeSingle();
  const row = r.data;
  if (!row) return { error: 'not_found' };
  if (String(row.user_id) !== String(user.id) && !(await isSuper(user.id))) return { error: 'forbidden' };
  if (!row.dreamscape_domain_id) return { error: 'no_dreamscape_id' };
  return { row, dsId: row.dreamscape_domain_id };
}

// Keep only the fields Dreamscape expects for each record type.
function cleanRecord(input) {
  const t = String((input && input.type) || '').toUpperCase();
  if (!ALLOWED_TYPES.includes(t)) return null;
  const s = k => (input[k] == null ? undefined : String(input[k]).trim());
  const n = (k, d) => { const v = Number(input[k]); return isFinite(v) ? v : d; };
  let r;
  if (t === 'MX') {
    r = { type: t, subdomain: s('subdomain') || '@', content: s('content'), priority: n('priority', 10) };
    if (!r.content) return null;
  } else if (t === 'SRV') {
    r = { type: t, subdomain: s('subdomain'), target: s('target'), priority: n('priority', 0), weight: n('weight', 0), port: n('port', 0) };
    if (!r.target) return null;
  } else if (t === 'CAA') {
    r = { type: t, flag: n('flag', 0), tag: s('tag') || 'issue', value: s('value') };
    if (!r.value) return null;
  } else if (t === 'WEBFWD') {
    r = { type: t, subdomain: s('subdomain') || '@', forward_to: s('forward_to'), cloak: !!input.cloak };
    if (!r.forward_to) return null;
  } else if (t === 'MAILFWD') {
    r = { type: t, email: s('email'), forward_to: s('forward_to') };
    if (!r.email || !r.forward_to) return null;
  } else { // A / AAAA / CNAME / TXT
    r = { type: t, subdomain: s('subdomain') || '@', content: s('content') };
    if (!r.content) return null;
  }
  return r;
}

function recordsOf(resp) { return (resp && resp.data && resp.data.data) || []; }

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

    const method = req.method;

    // Two ways to identify the domain:
    //  - dreamscape_id (+ optional domain_name): super-only, manages ANY domain in
    //    the reseller account (used by the admin domain list).
    //  - domain_id (our Supabase uuid): the owner (or super) manages their own.
    const dreamId = method === 'GET' ? req.query.dreamscape_id : body.dreamscape_id;
    let dsId, domainName;
    if (dreamId) {
      if (!(await isSuper(user.id))) return res.status(403).json({ error: 'Only administrators can manage by Dreamscape ID.' });
      dsId = dreamId;
      domainName = (method === 'GET' ? req.query.domain_name : body.domain_name) || '';
    } else {
      const ourId = method === 'GET' ? req.query.domain_id : body.domain_id;
      if (!ourId) return res.status(400).json({ error: 'domain_id is required.' });
      const own = await ownedDomain(ourId, user);
      if (own.error === 'not_found')        return res.status(404).json({ error: 'Domain not found.' });
      if (own.error === 'forbidden')        return res.status(403).json({ error: "That domain isn't on your account." });
      if (own.error === 'no_dreamscape_id') return res.status(409).json({ error: "This domain isn't fully registered yet — try again shortly." });
      dsId = own.dsId;
      domainName = own.row.domain_name;
    }

    if (method === 'GET') {
      const r = await ds.listDomainDns(dsId, req.query.type);
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not load DNS records.' });
      return res.status(200).json({ ok: true, domain: domainName, records: recordsOf(r) });
    }

    if (method === 'POST') {
      const rec = cleanRecord(body.record || body);
      if (!rec) return res.status(400).json({ error: 'Unsupported or incomplete record.' });
      const r = await ds.addDomainDns(dsId, rec);
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not add the record.' });
      return res.status(201).json({ ok: true, record: (r.data && r.data.data) || rec });
    }

    if (method === 'PATCH') {
      const rid = body.record_id;
      if (!rid) return res.status(400).json({ error: 'record_id is required.' });
      const rec = cleanRecord(body.record || body);
      if (!rec) return res.status(400).json({ error: 'Unsupported or incomplete record.' });
      const patch = Object.assign({}, rec); delete patch.type; // type is fixed on an existing record
      const r = await ds.updateDomainDns(dsId, rid, patch);
      if (!r.ok) return res.status(502).json({ error: r.error || 'Could not update the record.' });
      return res.status(200).json({ ok: true, record: (r.data && r.data.data) || patch });
    }

    if (method === 'DELETE') {
      const rid = body.record_id || req.query.record_id;
      if (!rid) return res.status(400).json({ error: 'record_id is required.' });
      const r = await ds.deleteDomainDns(dsId, rid);
      if (!r.ok && r.status !== 204) return res.status(502).json({ error: r.error || 'Could not delete the record.' });
      return res.status(200).json({ ok: true, deleted: rid });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('dns endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
