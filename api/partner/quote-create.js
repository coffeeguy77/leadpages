// api/partner/quote-create.js — a partner builds a quote for a client, tied to
// one of their demos. Stores it, then emails the client a tokenised accept-&-pay
// link. The client opens /quote?t=<token>, accepts, pays, and the existing
// purchase webhook converts the demo into their live site.
//
// Payload: { siteId, businessName, contactPerson, address, email, phones[],
//            jobDescription, features[], price (cents), planKey }

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { applyOfferToRow, publicOfferFields, clampDiscount } = require('../../lib/quote-offer');
const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) { if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } } return resolve(req.body); }
    let raw = ''; req.on('data', (c) => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } }); req.on('error', () => resolve({}));
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
    const u = await r.json(); if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) { return null; }
}

function fmtAUD(cents) { return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

async function emailClient(quote, demo, partner, url, offerUrl) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !quote.email) return;
  const feat = (quote.features || []).map((f) => `<li style="margin:3px 0">${esc(f)}</li>`).join('');
  const who = esc(partner.display_name || 'your web provider');
  const offer = publicOfferFields(quote);
  const offerBlock = offer.offer_active && offerUrl
    ? `<div style="background:#fff4ec;border:1px solid #ffd4b8;border-radius:12px;padding:14px 16px;margin:0 0 18px">` +
      `<div style="font-size:12px;color:#a64b12;font-weight:700;letter-spacing:.06em;text-transform:uppercase">Limited-time offer</div>` +
      `<p style="margin:8px 0 10px;line-height:1.5">Save <strong>${clampDiscount(quote.offer_discount_pct)}%</strong> if you buy within ${quote.offer_hours || 72} hours.</p>` +
      `<a href="${esc(offerUrl)}" style="display:inline-block;background:#ff6a1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Claim offer — ${fmtAUD(offer.offer_price)}</a>` +
      `</div>`
    : '';
  const html =
    `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1f2b">` +
    `<h2 style="font-family:Archivo,system-ui;margin:0 0 4px">Your website quote</h2>` +
    `<p style="color:#566;margin:0 0 18px">From ${who} &middot; for ${esc(quote.business_name || '')}</p>` +
    offerBlock +
    (quote.job_description ? `<p style="margin:0 0 14px;line-height:1.5">${esc(quote.job_description)}</p>` : '') +
    (feat ? `<p style="font-weight:600;margin:0 0 4px">What's included</p><ul style="margin:0 0 16px;padding-left:20px;line-height:1.5">${feat}</ul>` : '') +
    `<div style="background:#f4f6f9;border-radius:12px;padding:16px 18px;margin:0 0 20px">` +
    `<div style="font-size:13px;color:#566">One-off build</div><div style="font-size:26px;font-weight:800">${fmtAUD(quote.price)}</div></div>` +
    `<a href="${esc(url)}" style="display:inline-block;background:#ff6a1a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px">View &amp; accept your quote</a>` +
    `<p style="color:#8a93a3;font-size:12.5px;margin:20px 0 0;line-height:1.5">You'll be able to preview your site and pay securely. Any questions, just reply to this email.</p>` +
    `</div>`;
  const body = { from: FROM, to: quote.email, subject: `Your website quote — ${quote.business_name || ''}`.trim(), html };
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
  const siteId = clean(b.siteId, 80);
  const businessName = clean(b.businessName, 160);
  const price = Math.round(Number(b.price) || 0);
  if (!siteId) return res.status(400).json({ ok: false, error: 'Please choose which demo this quote is for.' });
  if (!businessName) return res.status(400).json({ ok: false, error: 'Business name is required.' });
  if (price <= 0) return res.status(400).json({ ok: false, error: 'Please enter a price.' });

  // The demo must belong to this partner.
  const site = (await admin.from('sites').select('id,slug,business_name,preview_password,servicing_partner_id,referring_partner_id').eq('id', siteId).maybeSingle()).data;
  if (!site) return res.status(404).json({ ok: false, error: 'That demo could not be found.' });
  if (site.servicing_partner_id !== partner.id && site.referring_partner_id !== partner.id) {
    return res.status(403).json({ ok: false, error: 'That demo is not one of yours.' });
  }

  const planKey = clean(b.planKey, 40) || null;
  const token = crypto.randomBytes(16).toString('hex');
  const row = {
    partner_id: partner.id, site_id: site.id, token,
    business_name: businessName,
    contact_person: clean(b.contactPerson, 160) || null,
    address: clean(b.address, 300) || null,
    email: clean(b.email, 200).toLowerCase() || null,
    phones: cleanList(b.phones, 60, 8),
    job_description: clean(b.jobDescription, 4000) || null,
    features: cleanList(b.features, 200, 30),
    price, plan_key: planKey, status: 'sent', sent_at: new Date().toISOString(),
  };
  applyOfferToRow(row, !!(b.offerEnabled || b.offer_enabled), b.offerDiscountPct || b.offer_discount_pct, b.offerHours || b.offer_hours);

  const ins = await admin.from('partner_quotes').insert(row).select('*').single();
  if (ins.error || !ins.data) return res.status(500).json({ ok: false, error: 'Could not save the quote. Please try again.' });

  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'leadpages.com.au').split(',')[0].trim();
  const base = 'https://' + host.replace(/\/+$/, '');
  const url = base + '/quote?t=' + token;
  const offerUrl = publicOfferFields(ins.data).offer_active ? (base + '/offer?t=' + token) : null;

  // best-effort email to the client
  const prof = (await admin.from('partner_profiles').select('support_email').eq('partner_id', partner.id).maybeSingle()).data || {};
  await emailClient(ins.data, site, { display_name: partner.display_name, support_email: prof.support_email }, url, offerUrl);

  return res.status(200).json({ ok: true, quote: ins.data, url, offerUrl, emailed: !!(process.env.RESEND_API_KEY && row.email) });
};
