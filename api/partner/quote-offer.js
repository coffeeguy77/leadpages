// api/partner/quote-offer.js — partner starts or restarts a limited-time buy-now offer.
// Payload: { token, discountPct?, hours?, resendEmail? }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { applyOfferToRow, clampDiscount, publicOfferFields } = require('../../lib/quote-offer');
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
function fmtAUD(cents) { return '$' + (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

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

async function emailOffer(quote, partner, quoteUrl, offerUrl) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !quote.email) return;
  const pct = clampDiscount(quote.offer_discount_pct);
  const offer = publicOfferFields(quote);
  const html =
    `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1f2b">` +
    `<h2 style="font-family:Archivo,system-ui;margin:0 0 4px">Limited-time offer on your website</h2>` +
    `<p style="color:#566;margin:0 0 18px">From ${esc(partner.display_name || 'your web provider')} &middot; for ${esc(quote.business_name || '')}</p>` +
    `<div style="background:#fff4ec;border:1px solid #ffd4b8;border-radius:12px;padding:16px 18px;margin:0 0 18px">` +
    `<div style="font-size:13px;color:#a64b12;font-weight:700;letter-spacing:.06em;text-transform:uppercase">Save ${pct}% if you buy now</div>` +
    `<div style="font-size:26px;font-weight:800;margin-top:6px">${fmtAUD(offer.offer_price)} <span style="font-size:15px;font-weight:600;color:#888;text-decoration:line-through">${fmtAUD(quote.price)}</span></div>` +
  `</div>` +
    `<a href="${esc(offerUrl)}" style="display:inline-block;background:#ff6a1a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;margin-right:10px">Claim offer now</a>` +
    `<a href="${esc(quoteUrl)}" style="display:inline-block;color:#566;text-decoration:none;font-weight:600;padding:14px 10px">View full quote</a>` +
    `<p style="color:#8a93a3;font-size:12.5px;margin:20px 0 0;line-height:1.5">This offer includes a live countdown — once it ends, the discounted price is no longer available.</p>` +
    `</div>`;
  const body = { from: FROM, to: quote.email, subject: `Save ${pct}% — limited-time website offer for ${quote.business_name || ''}`.trim(), html };
  if (partner.support_email) body.reply_to = partner.support_email;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (_e) {}
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
  if (existing.status === 'paid') return res.status(400).json({ ok: false, error: 'Paid quotes cannot have offers.' });

  const row = { updated_at: new Date().toISOString() };
  applyOfferToRow(row, true, b.discountPct || b.offerDiscountPct || 20, b.hours || b.offerHours || 72);

  const upd = await admin.from('partner_quotes').update(row).eq('id', existing.id).select('*').single();
  if (upd.error || !upd.data) return res.status(500).json({ ok: false, error: 'Could not start the offer. Please try again.' });

  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'leadpages.com.au').split(',')[0].trim();
  const base = 'https://' + host.replace(/\/+$/, '');
  const quoteUrl = base + '/quote?t=' + quoteToken;
  const offerUrl = base + '/offer?t=' + quoteToken;

  const resend = b.resendEmail !== false;
  const prof = (await admin.from('partner_profiles').select('support_email').eq('partner_id', partner.id).maybeSingle()).data || {};
  if (resend) await emailOffer(upd.data, { display_name: partner.display_name, support_email: prof.support_email }, quoteUrl, offerUrl);

  return res.status(200).json({
    ok: true,
    quote: upd.data,
    url: quoteUrl,
    offerUrl,
    offer: publicOfferFields(upd.data),
    emailed: !!(resend && process.env.RESEND_API_KEY && upd.data.email),
  });
};
