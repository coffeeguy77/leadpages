// api/admin/grant-publisher.js
// POST { email }
// For super-admins only. Ensures a Supabase Auth user exists for the email,
// promotes the profile to is_super_admin = true (to allow publishing and admin testing),
// and links any matching partner row (by email) to that user_id for dashboard features.
//
// Intended for temporary test access (e.g. shaun@beanculture.com.au).

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function isAdminCaller(token) {
  if (!token) return false;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!ur.ok) return false;
    const u = await ur.json().catch(() => ({}));
    if (!u || !u.id) return false;
    const list = (process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
    if (list.includes(String(u.email || '').toLowerCase())) return true;
    const prof = await sb.from('profiles').select('is_super_admin').eq('id', u.id).maybeSingle();
    return !!(prof.data && prof.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

async function ensureAuthUser(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL;
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(base + '/auth/v1/admin/users', { method: 'POST', headers: h, body: JSON.stringify({ email, email_confirm: true }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.id) return j.id;
  } catch (_e) {}
  for (let page = 1; page <= 5; page++) {
    try {
      const lr = await fetch(base + '/auth/v1/admin/users?per_page=200&page=' + page, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      const lj = await lr.json().catch(() => ({}));
      const users = (lj && lj.users) || [];
      const hit = users.find((u) => String(u.email || '').toLowerCase() === email);
      if (hit) return hit.id;
      if (users.length < 200) break;
    } catch (_e) { break; }
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!(await isAdminCaller(token))) {
    return res.status(403).json({ ok: false, error: 'admins only' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_e) { body = {}; } }
  body = body || {};
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: 'email required' });

  try {
    const userId = await ensureAuthUser(email);
    if (!userId) return res.status(404).json({ ok: false, error: 'No auth user found or created for that email.' });

    // Promote to super-admin for testing
    const now = new Date().toISOString();
    const up = await sb.from('profiles').update({ is_super_admin: true, updated_at: now }).eq('id', userId);
    if (up.error) {
      // Try insert if profile missing
      const ins = await sb.from('profiles').insert({ id: userId, email: email, is_super_admin: true, created_at: now, updated_at: now });
      if (ins.error) return res.status(500).json({ ok: false, error: 'Could not update profile: ' + ins.error.message });
    }

    // Link partner row if same email present (best-effort)
    const pr = await sb.from('partners').select('id,user_id').eq('email', email).maybeSingle();
    if (pr && pr.data && pr.data.id && pr.data.user_id !== userId) {
      await sb.from('partners').update({ user_id: userId, updated_at: now }).eq('id', pr.data.id);
    }

    return res.status(200).json({ ok: true, userId, email, super: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};

