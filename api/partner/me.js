// api/partner/me.js — the partner's "who am I" endpoint for the partner dashboard.
// Verifies the caller's Supabase session, resolves their partner record, and —
// the key step — CLAIMS a partner row that an admin created by email before the
// person had logged in (stamps partners.user_id from their auth id, the same way
// /api/billing/owner stamps sites.owner_user_id). Also guarantees a
// partner_profiles row exists so the dashboard's profile editor has something to
// update. Service role so it can stamp/insert regardless of RLS.
//
// Returns: { ok:true, partner:{id,status,display_name,email,phone}|null, profile:{...}|null }

const { extractLogoValue, normalizeLogoForStorage } = require('../lib/partner-website/logo');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) { return null; }
}

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  // 1) Already linked?
  let p = (await admin.from('partners').select('*').eq('user_id', user.id).maybeSingle()).data;

  // 2) Otherwise claim an admin-created, not-yet-linked row that matches the email.
  if (!p && user.email) {
    const byEmail = (await admin.from('partners').select('*').is('user_id', null).ilike('email', user.email).limit(1)).data;
    if (byEmail && byEmail.length) {
      const upd = await admin.from('partners')
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', byEmail[0].id).select('*').single();
      p = upd.data || byEmail[0];
    }
  }

  if (!p) return res.status(200).json({ ok: true, partner: null, profile: null });

  // 3) Ensure a profile row exists for the dashboard editor.
  let prof = (await admin.from('partner_profiles').select('*').eq('partner_id', p.id).maybeSingle()).data;
  if (!prof) {
    const ins = await admin.from('partner_profiles')
      .insert({ partner_id: p.id, support_name: p.display_name || null, support_email: p.email || null, support_phone: p.phone || null })
      .select('*').single();
    prof = ins.data || null;
  }

  if (prof && prof.showcase_config) {
    const cfg = Object.assign({}, prof.showcase_config);
    const logo = normalizeLogoForStorage(cfg.logo);
    if (logo) cfg.logo = logo;
    else delete cfg.logo;
    prof = Object.assign({}, prof, { showcase_config: cfg });
  }

  return res.status(200).json({
    ok: true,
    partner: { id: p.id, status: p.status, display_name: p.display_name, email: p.email, phone: p.phone },
    profile: prof || null,
  });
};
