// api/partner/quote-update.js — partner revises an existing sent quote (not paid).
// Payload: { token, siteId, businessName, contactPerson, address, email, phones[],
//            jobDescription, features[], price (cents), planKey, resendEmail? }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
const clean = (s, n = 400) => (s == null ? '' : String(s)).trim().slice(0, n);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function cleanList(v, n, max) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => clean(x, n || 200)).filter(Boolean).slice(0, max || 20);
}

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) { return null; }
}

function fmtAUD(cents) { return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

async function emailClient(quote, partner, url, isUpdate) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !quote.email) return;
  const feat = (quote.features || []).map((f) => `<li style="margin:3px 0">${esc(f)}</li>`).join('');
  const who = esc(partner.display_name || 'your web provider');
  const heading = isUpdate ? 'Your website quote has been updated' : 'Your website quote';
  const html =
    `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1f2b">` +
    `<h2 style="font-family:Archivo,system-ui;margin:0 0 4px">${heading}</h2>` +
    `<p style="color:#566;margin:0 0 18px">From ${who} &middot; for ${esc(quote.business_name || '')}</p>` +
    (isUpdate ? `<p style="margin:0 0 14px;line-height:1.5;color:#566">Your provider has revised this quote — review the updated details below.</p>` : '') +
    (quote.job_description ? `<p style="margin:0 0 14px;line-height:1.5">${esc(quote.job_description)}</p>` : '') +
    (feat ? `<p style="font-weight:600;margin:0 0 4px">What's included</p><ul style="margin:0 0 16px;padding-left:20px;line-height:1.5">${feat}</ul>` : '') +
    `<div style="background:#f4f6f9;border-radius:12px;padding:16px 18px;margin:0 0 20px">` +
    `<div style="font-size:13px;color:#566">One-off build</div><div style="font-size:26px;font-weight:800">${fmtAUD(quote.price)}</div></div>` +
    `<a href="${esc(url)}" style="display:inline-block;background:#ff6a1a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px">View &amp; accept your quote</a>` +
    `<p style="color:#8a93a3;font-size:12.5px;margin:20px 0 0;line-height:1.5">You'll be able to preview your site and pay securely. Any questions, just reply to this email.</p>` +
    `</div>`;
  const subject = isUpdate
    ? `Updated website quote — ${quote.business_name || ''}`.trim()
    : `Your website quote — ${quote.business_name || ''}`.trim();
  const body = { from: FROM, to: quote.email, subject, html };
  if (partner.support_email) body.reply_to = partner.support_email;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (_e) { /* never block on email */ }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const pr = await admin.from('partners').select('id,status,display_name').eq('user_id', user.id).maybeSingle();
  const partner = pr.data;
  if (!partner) return res.status(403).json({ ok: false, error: 'not a partner' });
  if (partner.status !== 'active') return res.status(403).json({ ok: false, error: 'partner account is ' + partner.status });

  const b = await readBody(req);
  const quoteToken = clean(b.token, 80);
  if (!quoteToken) return res.status(400).json({ ok: false, error: 'Missing quote token.' });

  const existing = (await admin.from('partner_quotes').select('*').eq('token', quoteToken).eq('partner_id', partner.id).maybeSingle()).data;
  if (!existing) return res.status(404).json({ ok: false, error: 'That quote could not be found.' });
  if (existing.status === 'paid') return res.status(400).json({ ok: false, error: 'Paid quotes cannot be edited.' });

  const siteId = clean(b.siteId, 80);
  const businessName = clean(b.businessName, 160);
  const price = Math.round(Number(b.price) || 0);
  if (!siteId) return res.status(400).json({ ok: false, error: 'Please choose which demo this quote is for.' });
  if (!businessName) return res.status(400).json({ ok: false, error: 'Business name is required.' });
  if (price <= 0) return res.status(400).json({ ok: false, error: 'Please enter a price.' });

  const site = (await admin.from('sites').select('id,slug,business_name,preview_password,servicing_partner_id,referring_partner_id').eq('id', siteId).maybeSingle()).data;
  if (!site) return res.status(404).json({ ok: false, error: 'That demo could not be found.' });
  if (site.servicing_partner_id !== partner.id && site.referring_partner_id !== partner.id) {
    return res.status(403).json({ ok: false, error: 'That demo is not one of yours.' });
  }

  const planKey = clean(b.planKey, 40) || null;
  const row = {
    site_id: site.id,
    business_name: businessName,
    contact_person: clean(b.contactPerson, 160) || null,
    address: clean(b.address, 300) || null,
    email: clean(b.email, 200).toLowerCase() || null,
    phones: cleanList(b.phones, 60, 8),
    job_description: clean(b.jobDescription, 4000) || null,
    features: cleanList(b.features, 200, 30),
    price,
    plan_key: planKey,
    status: existing.status === 'draft' ? 'sent' : (existing.status || 'sent'),
    updated_at: new Date().toISOString(),
  };

  const upd = await admin.from('partner_quotes').update(row).eq('id', existing.id).select('*').single();
  if (upd.error || !upd.data) return res.status(500).json({ ok: false, error: 'Could not update the quote. Please try again.' });

  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'leadpages.com.au').split(',')[0].trim();
  const url = 'https://' + host.replace(/\/+$/, '') + '/quote?t=' + quoteToken;

  const resend = b.resendEmail !== false;
  const prof = (await admin.from('partner_profiles').select('support_email').eq('partner_id', partner.id).maybeSingle()).data || {};
  if (resend) await emailClient(upd.data, { display_name: partner.display_name, support_email: prof.support_email }, url, true);

  return res.status(200).json({
    ok: true,
    quote: upd.data,
    url,
    emailed: !!(resend && process.env.RESEND_API_KEY && row.email),
  });
};
