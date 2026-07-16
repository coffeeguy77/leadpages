// api/partner-welcome.js
// POST { partnerId, email?, name? }
// Sends (or re-sends) the partner welcome letter via Resend with a magic-link
// sign-in. Used on approve and from Partners admin "Send welcome".

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FROM = process.env.LEADS_FROM || 'LeadPages <noreply@leadpages.webculture.au>';
const BASE = process.env.BASE_URL || 'https://www.leadpages.com.au';

async function ensureAuthUser(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL;
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(base + '/auth/v1/admin/users', {
      method: 'POST', headers: h,
      body: JSON.stringify({ email, email_confirm: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.id) return j.id;
  } catch (e) {}
  for (let page = 1; page <= 5; page++) {
    try {
      const lr = await fetch(base + '/auth/v1/admin/users?per_page=200&page=' + page,
        { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      const lj = await lr.json().catch(() => ({}));
      const users = (lj && lj.users) || [];
      const hit = users.find((u) => String(u.email || '').toLowerCase() === email);
      if (hit) return hit.id;
      if (users.length < 200) break;
    } catch (e) { break; }
  }
  return null;
}

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
  } catch (e) {
    return false;
  }
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
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const partnerId = String(body.partnerId || body.partner_id || '').trim();
  if (!partnerId) return res.status(400).json({ ok: false, error: 'partnerId required' });

  const partner = (await sb.from('partners')
    .select('id,display_name,email,status,user_id')
    .eq('id', partnerId)
    .maybeSingle()).data;
  if (!partner) return res.status(404).json({ ok: false, error: 'Partner not found.' });

  const email = String(body.email || partner.email || '').trim().toLowerCase();
  const name = String(body.name || partner.display_name || email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'Partner has no email address.' });

  try {
    const userId = await ensureAuthUser(email);

    if (userId && partner.user_id !== userId) {
      await sb.from('partners').update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', partnerId);
    }

    let magicUrl = BASE + '/partner';
    if (userId) {
      try {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/admin/users/' + userId + '/links', {
          method: 'POST',
          headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'magiclink', redirect_to: BASE + '/partner' }),
        });
        const j = await r.json().catch(() => ({}));
        if (j && j.action_link) magicUrl = j.action_link;
      } catch (e) {}
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return res.status(500).json({ ok: false, error: 'RESEND_API_KEY is not configured.' });
    }

    const firstName = String(name || email).split(/\s+/)[0];
    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resendKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: 'Welcome to LeadPages — your partner account is ready',
        html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#F6F4EF;margin:0;padding:32px 16px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:36px;border:1px solid #E7E2D8">
  <img src="${BASE}/images/logo.png" alt="LeadPages" style="height:48px;margin-bottom:24px;display:block">
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;color:#1B2430">Welcome, ${firstName}.</h1>
  <p style="color:#5C6675;font-size:16px;line-height:1.6;margin:0 0 20px">Your LeadPages partner account is approved and ready. You can now build client websites, manage your sites, and access the full platform.</p>
  <h2 style="font-family:Georgia,serif;font-weight:400;font-size:18px;margin:0 0 10px;color:#1B2430">Your first steps</h2>
  <ol style="color:#5C6675;font-size:15px;line-height:1.7;margin:0 0 24px;padding-left:20px">
    <li>Sign in and complete the platform tour</li>
    <li>Build your first demo site (pick any industry)</li>
    <li>Save your preferred layout as a template</li>
    <li>List yourself in the partner directory</li>
    <li>Find your first real client</li>
  </ol>
  <a href="${magicUrl}" style="display:inline-block;background:#2F413A;color:#fff;text-decoration:none;border-radius:999px;padding:14px 28px;font-weight:700;font-size:16px;margin-bottom:20px">Access your dashboard →</a>
  <p style="color:#929AA6;font-size:13px;margin:0">This sign-in link expires in 24 hours. After that, visit <a href="${BASE}/partner" style="color:#2F413A">${BASE}/partner</a> and sign in with your email.</p>
  <hr style="border:none;border-top:1px solid #E7E2D8;margin:24px 0">
  <p style="color:#929AA6;font-size:12px;margin:0">LeadPages · Bean Culture Pty Ltd t/a Web Culture · ABN 33 600 754 676</p>
</div></body></html>`,
      }),
    });
    const ej = await er.json().catch(() => ({}));
    if (!er.ok) {
      return res.status(502).json({
        ok: false,
        error: (ej && ej.message) || 'Could not send welcome email via Resend.'
      });
    }

    return res.status(200).json({ ok: true, userId: userId || null, emailed: email });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
