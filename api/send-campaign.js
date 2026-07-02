// api/send-campaign.js — the client mailer / mini-newsletter sender.
//
// A logged-in business owner composes a message in /manage and posts it here.
// We: (1) verify the caller is a real logged-in Supabase user, (2) store the
// campaign, (3) either send it now via Resend or leave it 'scheduled' for the
// cron (api/cron/send-due.js) to send at the right time, always skipping anyone
// on the site's opt-out list and adding a one-click unsubscribe link.
//
// POST body (JSON):
//   { siteId, subject, bodyHtml, imageUrl?,
//     recipientMode: 'all' | 'selected' | 'individual',
//     recipients?: ["a@x.com", ...],   // required for selected/individual
//     sendAt?: "2026-07-10T09:00:00.000Z" | null,   // null/past = send now
//     timezone?: "Australia/Sydney" }               // for display only
//
// Auth: Authorization: Bearer <supabase access token from the logged-in session>.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//      CAMPAIGN_FROM (or LEADS_FROM), PUBLIC_BASE_URL (for the unsubscribe link).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const FROM = process.env.CAMPAIGN_FROM || process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';
const BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

const clean = (s, n = 400) => (s == null ? '' : String(s)).trim().slice(0, n);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// Verify the bearer token belongs to a real logged-in user.
async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || SERVICE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

// Wrap the owner's message in a tidy shell + optional image + unsubscribe link.
function wrapHtml({ subject, bodyHtml, imageUrl, business, unsubUrl }) {
  const img = imageUrl
    ? '<img src="' + esc(imageUrl) + '" alt="" style="display:block;width:100%;max-width:560px;border-radius:12px;margin:0 0 18px">'
    : '';
  return '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1c2330;line-height:1.55">'
    + img
    + (subject ? '<h1 style="font-size:22px;margin:0 0 14px">' + esc(subject) + '</h1>' : '')
    + '<div style="font-size:15px">' + bodyHtml + '</div>'
    + '<hr style="border:0;border-top:1px solid #eef0f2;margin:24px 0 12px">'
    + '<p style="font-size:12px;color:#9ca3af;margin:0">You are receiving this because you enquired with ' + esc(business || 'us') + '.'
    + ' <a href="' + esc(unsubUrl) + '" style="color:#6b7280">Unsubscribe</a>.</p>'
    + '</div>';
}

async function resendSend({ to, from, subject, html, unsubUrl }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject,
        html,
        headers: { 'List-Unsubscribe': '<' + unsubUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      })
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { ok: false, reason: 'resend_' + r.status, body: t.slice(0, 200) }; }
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'fetch_error', body: (e && e.message) || '' }; }
}

// Shared send routine, also used by the cron. Sends one campaign row now.
// Returns { sent, failed, skipped }.
async function deliverCampaign(campaign) {
  const siteId = campaign.site_id;
  await admin.from('campaign_recipients').delete().eq('campaign_id', campaign.id); // idempotent re-send safety
  const site = (await admin.from('sites').select('business_name').eq('id', siteId).maybeSingle()).data || {};
  const business = site.business_name || 'us';

  // Resolve recipients.
  let emails = [];
  if (campaign.recipient_mode === 'all') {
    const r = await admin.from('leads').select('email,email_opt_out').eq('site_id', siteId).not('email', 'is', null);
    emails = (r.data || []).filter((x) => !x.email_opt_out).map((x) => clean(x.email, 160)).filter(Boolean);
  } else {
    // selected / individual: the chosen list is stored on the campaign row.
    emails = Array.isArray(campaign.recipient_list) ? campaign.recipient_list : [];
  }
  // De-dupe.
  emails = Array.from(new Set(emails.map((e) => e.toLowerCase()))).filter(Boolean);

  // Remove opt-outs for this site.
  const opt = await admin.from('email_optouts').select('email').eq('site_id', siteId);
  const optSet = new Set((opt.data || []).map((x) => (x.email || '').toLowerCase()));

  let sent = 0, failed = 0, skipped = 0;
  for (const email of emails) {
    if (optSet.has(email)) {
      skipped++;
      await admin.from('campaign_recipients').insert({ campaign_id: campaign.id, email, status: 'skipped_optout' });
      continue;
    }
    const unsubUrl = BASE + '/api/unsubscribe?s=' + encodeURIComponent(siteId) + '&e=' + encodeURIComponent(email);
    const html = wrapHtml({ subject: campaign.subject, bodyHtml: campaign.body_html, imageUrl: campaign.image_url, business, unsubUrl });
    const res = await resendSend({ to: email, from: FROM, subject: campaign.subject || ('A message from ' + business), html, unsubUrl });
    await admin.from('campaign_recipients').insert({
      campaign_id: campaign.id, email,
      status: res.ok ? 'sent' : 'failed', error: res.ok ? null : (res.reason + (res.body ? ': ' + res.body : '')),
      sent_at: res.ok ? new Date().toISOString() : null
    });
    if (res.ok) sent++; else failed++;
  }

  await admin.from('email_campaigns').update({
    status: 'sent', total_recipients: emails.length, sent_count: sent, failed_count: failed, sent_at: new Date().toISOString()
  }).eq('id', campaign.id);

  return { sent, failed, skipped, total: emails.length };
}

module.exports = async (req, res) => {
  const json = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  // GET: return recent campaigns for a site (service role, so it works regardless of RLS).
  if (req.method === 'GET') {
    const u = await requireUser(req);
    if (!u) return json(401, { ok: false, error: 'auth' });
    try {
      const url = new URL(req.url, 'https://x');
      const siteId = (url.searchParams.get('siteId') || '').trim();
      if (!siteId) return json(400, { ok: false, error: 'no_site' });
      const r = await admin.from('email_campaigns')
        .select('id,subject,status,total_recipients,sent_count,failed_count,send_at,sent_at,created_at')
        .eq('site_id', siteId).order('created_at', { ascending: false }).limit(8);
      return json(200, { ok: true, campaigns: r.data || [] });
    } catch (e) { return json(500, { ok: false, error: 'server' }); }
  }

  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });

  const user = await requireUser(req);
  if (!user) return json(401, { ok: false, error: 'auth' });

  try {
    const b = await readBody(req);
    const siteId = clean(b.siteId, 64);
    const subject = clean(b.subject, 200);
    const bodyHtml = (b.bodyHtml == null ? '' : String(b.bodyHtml)).slice(0, 50000);
    const imageUrl = clean(b.imageUrl, 500) || null;
    const mode = ['all', 'selected', 'individual'].includes(b.recipientMode) ? b.recipientMode : 'all';
    const recipients = Array.isArray(b.recipients) ? b.recipients.map((e) => clean(e, 160).toLowerCase()).filter(Boolean) : [];
    const timezone = clean(b.timezone, 64) || 'Australia/Sydney';

    if (!siteId) return json(400, { ok: false, error: 'no_site' });
    if (!subject && !bodyHtml) return json(400, { ok: false, error: 'empty' });
    if ((mode === 'selected' || mode === 'individual') && !recipients.length) return json(400, { ok: false, error: 'no_recipients' });

    const sendAt = b.sendAt ? new Date(b.sendAt) : null;
    const isFuture = sendAt && !isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now() + 30 * 1000;

    // Create the campaign row.
    const row = {
      site_id: siteId, subject, body_html: bodyHtml, image_url: imageUrl,
      recipient_mode: mode,
      send_at: isFuture ? sendAt.toISOString() : null, timezone,
      status: isFuture ? 'scheduled' : 'sending', created_by: user.email || user.id
    };
    if (mode !== 'all') row.recipient_list = recipients; // only touch this column when needed
    const ins = await admin.from('email_campaigns').insert(row).select('*').maybeSingle();
    if (ins.error || !ins.data) return json(500, { ok: false, error: 'create_failed', detail: ins.error && ins.error.message });
    const campaign = ins.data;

    if (isFuture) {
      return json(200, { ok: true, campaignId: campaign.id, scheduled: true, sendAt: campaign.send_at });
    }

    const result = await deliverCampaign(campaign);
    return json(200, { ok: true, campaignId: campaign.id, scheduled: false, ...result });
  } catch (e) {
    console.error('send-campaign error:', e && e.message);
    return json(500, { ok: false, error: 'server' });
  }
};

module.exports.deliverCampaign = deliverCampaign;
