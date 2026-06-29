// api/partner-apply.js — receives a Partner Program application from partners.html,
// stores it in partner_applications, and (best-effort) emails the LeadPages admin
// so a new application is noticed quickly. Mirrors api/leads.js conventions:
//   • Service-role client (bypasses RLS) for the insert.
//   • ALWAYS return 200 with {ok:true} on a stored application — the page shows a
//     thank-you on success and must never bounce a genuine applicant for a backend
//     hiccup. Email is best-effort and gated on RESEND_API_KEY.
//
// Payload (JSON from partners.html):
//   { name, email, phone, location, background, knowsLocal, why, niche }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';
const ADMIN_TO = process.env.PARTNER_APPLY_TO || process.env.LEADS_ADMIN_TO || 'info@beanculture.com.au';

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const clean = (s, n = 2000) => (s == null ? '' : String(s)).trim().slice(0, n);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function emailAdmin(row) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // best-effort only
  const lines = [
    ['Name', row.name], ['Email', row.email], ['Phone', row.phone],
    ['Location', row.location], ['Background', row.background],
    ['Knows local businesses', row.knows_local === true ? 'Yes' : row.knows_local === false ? 'No' : '—'],
    ['Preferred niche', row.niche], ['Why', row.why],
  ].map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#64748b;">${esc(k)}</td><td style="padding:4px 0;">${esc(v || '—')}</td></tr>`).join('');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: ADMIN_TO,
        subject: `New Partner application — ${row.name || row.email}`,
        html: `<h2 style="font-family:system-ui">New LeadPages Partner application</h2><table style="font-family:system-ui;font-size:14px">${lines}</table><p style="font-family:system-ui;color:#64748b;font-size:13px">Review in /manage → Partners.</p>`,
      }),
    });
  } catch (_e) { /* never block on email */ }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = await readBody(req);

  const name = clean(b.name, 160);
  const email = clean(b.email, 200);
  if (!name || !email) return res.status(400).json({ ok: false, error: 'Name and email are required.' });

  const row = {
    name,
    email,
    phone: clean(b.phone, 60) || null,
    location: clean(b.location, 160) || null,
    background: clean(b.background, 1200) || null,
    knows_local: typeof b.knowsLocal === 'boolean' ? b.knowsLocal : (b.knowsLocal === 'yes' ? true : b.knowsLocal === 'no' ? false : null),
    why: clean(b.why, 2000) || null,
    niche: clean(b.niche, 160) || null,
    source: clean(b.source, 120) || 'partners.html',
  };

  try {
    const r = await supabase.from('partner_applications').insert(row).select('id').single();
    if (r.error) return res.status(500).json({ ok: false, error: 'Could not save your application. Please try again.' });
    emailAdmin(row); // fire-and-forget
    return res.status(200).json({ ok: true, id: r.data && r.data.id });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: 'Could not save your application. Please try again.' });
  }
};
