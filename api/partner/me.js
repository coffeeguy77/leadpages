// api/partner/me.js — the partner's "who am I" endpoint for the partner dashboard.
// Verifies the caller's Supabase session, resolves their partner record, and —
// the key step — CLAIMS a partner row that an admin created by email before the
// person had logged in (stamps partners.user_id from their auth id, the same way
// /api/billing/owner stamps sites.owner_user_id). Also guarantees a
// partner_profiles row exists so the dashboard's profile editor has something to
// update. Service role so it can stamp/insert regardless of RLS.
//
// Super-admin:
 //   ?list=1           -> { ok, partners:[...] } for Ops Command picker
 //   ?partner_id=<id>  -> view that partner's desk (read-only act-as)
 //
 // Returns: { ok:true, partner:{id,status,display_name,email,phone}|null, profile:{...}|null, as_admin?:true }

const { createClient } = require('@supabase/supabase-js');
const { normalizeLogoForStorage } = require('../../lib/partner-website/logo');

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

async function isSuper(userId) {
  try {
    const r = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

async function profileFor(partner) {
  let prof = (await admin.from('partner_profiles').select('*').eq('partner_id', partner.id).maybeSingle()).data;
  if (!prof) {
    const ins = await admin.from('partner_profiles')
      .insert({
        partner_id: partner.id,
        support_name: partner.display_name || null,
        support_email: partner.email || null,
        support_phone: partner.phone || null
      })
      .select('*')
      .single();
    prof = ins.data || null;
  }
  if (prof && prof.showcase_config) {
    const cfg = Object.assign({}, prof.showcase_config);
    const logo = normalizeLogoForStorage(cfg.logo);
    if (logo) cfg.logo = logo;
    else delete cfg.logo;
    prof = Object.assign({}, prof, { showcase_config: cfg });
  }
  return prof;
}

function publicPartner(p) {
  return {
    id: p.id,
    status: p.status,
    display_name: p.display_name,
    email: p.email,
    phone: p.phone
  };
}

module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const wantList = String(req.query.list || '') === '1';
    const asPartnerId = String(req.query.partner_id || req.query.as || '').trim();
    const superAdmin = await isSuper(user.id);

    if (wantList) {
      if (!superAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
      const rows = (await admin
        .from('partners')
        .select('id,display_name,email,status,phone')
        .order('display_name', { ascending: true })
        .limit(500)).data || [];
      return res.status(200).json({ ok: true, partners: rows });
    }

    if (asPartnerId) {
      if (!superAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
      const p = (await admin.from('partners').select('*').eq('id', asPartnerId).maybeSingle()).data;
      if (!p) return res.status(404).json({ ok: false, error: 'Partner not found.' });
      const prof = await profileFor(p);
      return res.status(200).json({
        ok: true,
        as_admin: true,
        partner: publicPartner(p),
        profile: prof || null
      });
    }

    // 1) Already linked?
    let p = (await admin.from('partners').select('*').eq('user_id', user.id).maybeSingle()).data;

    // 2) Claim by email — unlinked row, or row whose email matches but user_id drifted.
    if (!p && user.email) {
      const byEmail = (await admin.from('partners').select('*').ilike('email', user.email).limit(5)).data || [];
      const claimable = byEmail.find(function (row) {
        return !row.user_id || row.user_id === user.id;
      });
      if (claimable) {
        const upd = await admin.from('partners')
          .update({ user_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', claimable.id).select('*').single();
        p = upd.data || claimable;
      }
    }

    // Super admin without a partner row — return null so Ops Command can show picker
    if (!p) {
      return res.status(200).json({
        ok: true,
        partner: null,
        profile: null,
        can_pick: superAdmin
      });
    }

    const prof = await profileFor(p);
    return res.status(200).json({
      ok: true,
      partner: publicPartner(p),
      profile: prof || null
    });
  } catch (err) {
    console.error('partner/me error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load partner account.' });
  }
};
