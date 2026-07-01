// api/notify-message.js — emails a heads-up to the OTHER party when a message is sent.
// Reuses the same Resend transport + LEADS_FROM as the quote emails. Never blocks the sender.
// Deliberately does NOT include the message text — all correspondence stays in the app.
//
// POST { conversationId }  with "Authorization: Bearer <supabase access_token>" (the sender).
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//      LEADS_FROM (optional), LEADPAGES_ALERT_EMAIL (optional — where partner->LeadPages alerts go).

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';
const APP = 'https://leadpages.com.au/messages';

async function getUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id } : null;
  } catch (_e) { return null; }
}

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch (_e) { /* never block on email */ }
}

function btn(label) {
  return '<p><a href="' + APP + '" style="display:inline-block;background:#1f7a63;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-family:Inter,system-ui,sans-serif">' + label + '</a></p>';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const user = await getUser(token);
  if (!user) return res.status(200).json({ ok: true, skipped: 'no-auth' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_e) { body = {}; } }
  const convId = String((body || {}).conversationId || '');
  if (!convId) return res.status(200).json({ ok: true, skipped: 'no-conv' });

  const conv = (await admin.from('conversations').select('*').eq('id', convId).maybeSingle()).data;
  if (!conv) return res.status(200).json({ ok: true, skipped: 'no-conv-row' });

  // Who is sending (the caller)?
  let senderRole = 'client';
  const prof = (await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle()).data;
  if (prof && prof.is_super_admin) senderRole = 'super';
  else {
    const pa = (await admin.from('partners').select('id').eq('user_id', user.id).maybeSingle()).data;
    if (pa && pa.id === conv.partner_id) senderRole = 'partner';
  }

  async function notifyPartner() {
    if (!conv.partner_id) return;
    const p = (await admin.from('partners').select('email,display_name').eq('id', conv.partner_id).maybeSingle()).data;
    const pp = (await admin.from('partner_profiles').select('notify_new_message,support_email').eq('partner_id', conv.partner_id).maybeSingle()).data || {};
    if (pp.notify_new_message === false) return; // partner opted out
    const to = (p && p.email) || pp.support_email;
    await sendEmail(to, 'New message on LeadPages',
      '<div style="font-family:Inter,system-ui,sans-serif;color:#16201c;line-height:1.55">' +
      '<p>You have a new message waiting in your LeadPages dashboard.</p>' + btn('Open messages') +
      '<p style="color:#8a93a3;font-size:12.5px;margin-top:18px">To keep a clear record, all correspondence stays inside the app.</p></div>');
  }
  async function notifyClient() {
    if (!conv.client_site_id) return;
    const site = (await admin.from('sites').select('owner_email,business_name').eq('id', conv.client_site_id).maybeSingle()).data;
    const to = site && site.owner_email;
    await sendEmail(to, 'New message about your website',
      '<div style="font-family:Inter,system-ui,sans-serif;color:#16201c;line-height:1.55">' +
      '<p>You have a new message about your website' + (site && site.business_name ? (' (' + site.business_name + ')') : '') + '.</p>' +
      btn('Read &amp; reply') + '</div>');
  }
  async function notifyLeadPages() {
    const to = process.env.LEADPAGES_ALERT_EMAIL;
    if (!to) return;
    await sendEmail(to, 'New message on LeadPages',
      '<div style="font-family:Inter,system-ui,sans-serif;color:#16201c;line-height:1.55"><p>A new message needs attention.</p>' + btn('Open messages') + '</div>');
  }

  // Email whichever party did NOT send.
  if (conv.kind === 'partner_lp') {
    if (senderRole === 'partner') await notifyLeadPages(); else await notifyPartner();
  } else if (conv.kind === 'partner_client') {
    if (senderRole === 'partner') await notifyClient(); else await notifyPartner();
  } else if (conv.kind === 'client_support') {
    if (senderRole === 'client') await notifyLeadPages(); else await notifyClient();
  }

  return res.status(200).json({ ok: true });
};
