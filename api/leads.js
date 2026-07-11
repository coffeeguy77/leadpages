// api/leads.js — receives a quote-form submission from a tenant page, stores it
// as a lead against the right site, and emails the site's contact address so the
// business owner knows someone reached out. This is the heart of the client CRM:
// every captured lead is saved (powering the "Captured leads" view in /manage)
// and pushed out by email in real time.
//
// Payload (from the trade template):
//   { site: "<business name>", kind: "trade", name, email|null, phone,
//     details: { job, suburb, detail }, siteId?: "<uuid>", slug?: "<slug>" }
//
// Design rules:
//   • ALWAYS return 200 — the template hides the form and thanks the customer on
//     any response, so a backend hiccup must never bounce a real lead. We still
//     try hard to store + email, but we never surface a failure to the visitor.
//   • Storing the lead is the priority. Emailing is best-effort and gated on
//     RESEND_API_KEY being present, so a missing key never loses a lead.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verified sender for leadpages (Resend). Override with LEADS_FROM if needed.
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
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Resolve the site row by id → slug → business_name. Returns the full row we
// need for both storage (owner_user_id) and email (contact address + names).
async function resolveSite({ siteId, slug, site }) {
  const cols = 'id, slug, business_name, owner_user_id, owner_email, config';
  if (siteId) {
    const r = await supabase.from('sites').select(cols).eq('id', siteId).maybeSingle();
    if (r.data) return r.data;
  }
  if (slug) {
    const r = await supabase.from('sites').select(cols).eq('slug', slug).maybeSingle();
    if (r.data) return r.data;
  }
  if (site) {
    const r = await supabase.from('sites').select(cols).ilike('business_name', site).limit(1);
    if (r.data && r.data[0]) return r.data[0];
  }
  return null;
}

// Where should the notification email go? Prefer the explicit contact email in
// the site config, then owner_email on the row.
function contactEmailFor(siteRow) {
  const cfg = (siteRow && siteRow.config) || {};
  const q = (cfg.sections && cfg.sections.quote) || {};
  // A custom destination set in the quote section overrides the on-file address.
  if (q.notifyMode === 'custom' && clean(q.notifyEmail)) return clean(q.notifyEmail);
  return clean(cfg.email) || clean(siteRow && siteRow.owner_email) || '';
}

// Build a tidy human-readable summary of the lead's details.
function detailLines(details) {
  if (!details || typeof details !== 'object') return [];
  const out = [];
  if (details.businessName) out.push(['Business', details.businessName]);
  if (details.industry) out.push(['Industry', details.industry]);
  if (details.suburb) out.push(['Region', details.suburb]);
  if (details.mainGoal) out.push(['Goal', details.mainGoal]);
  if (details.budget) out.push(['Budget', details.budget]);
  if (details.message) out.push(['Message', details.message]);
  if (details.partnerId) out.push(['Partner ID', details.partnerId]);
  // include any other fields generically
  Object.keys(details).forEach((k) => {
    if (['job', 'suburb', 'detail'].includes(k)) return;
    if (details[k] == null || details[k] === '') return;
    out.push([k, details[k]]);
  });
  return out;
}

async function sendEmail({ to, business, lead, dets }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };

  const rows = [
    ['Name', lead.name || '(not given)'],
    ['Phone', lead.phone || '(not given)'],
    lead.email ? ['Email', lead.email] : null,
    ...dets
  ].filter(Boolean);

  const html =
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c2330">' +
      '<h2 style="margin:0 0 4px;font-size:19px">New enquiry for ' + esc(business || 'your site') + '</h2>' +
      '<p style="margin:0 0 16px;color:#6b7280;font-size:13px">Someone just submitted the quote form on your website.</p>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
        rows.map(([k, v]) =>
          '<tr>' +
            '<td style="padding:7px 10px;border-bottom:1px solid #eef0f2;color:#6b7280;white-space:nowrap;vertical-align:top">' + esc(k) + '</td>' +
            '<td style="padding:7px 10px;border-bottom:1px solid #eef0f2;font-weight:500">' + esc(v) + '</td>' +
          '</tr>'
        ).join('') +
      '</table>' +
      (lead.phone
        ? '<p style="margin:18px 0 0"><a href="tel:' + esc(lead.phone) + '" style="display:inline-block;background:#1f7a63;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:600;font-size:14px">Call ' + esc(lead.name || 'them') + ' back</a></p>'
        : '') +
      '<p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Sent by leadpages · reply straight to the customer using the details above.</p>' +
    '</div>';

  const text = 'New enquiry for ' + (business || 'your site') + '\n\n' +
    rows.map(([k, v]) => k + ': ' + v).join('\n') + '\n';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: lead.email || undefined,
        subject: 'New enquiry' + (lead.name ? ' from ' + lead.name : '') + ' — ' + (business || 'your site'),
        html,
        text
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { sent: false, reason: 'resend_' + r.status, body: t.slice(0, 200) };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'fetch_error', body: (e && e.message) || '' };
  }
}

module.exports = async (req, res) => {
  const ok = (extra) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Object.assign({ ok: true }, extra || {})));
  };

  if (req.method !== 'POST') return ok({ skipped: 'method' });

  try {
    const body = await readBody(req);

    const lead = {
      name: clean(body.name, 120),
      email: clean(body.email, 160) || null,
      phone: clean(body.phone, 60),
      kind: clean(body.kind, 32) || 'lead'
    };
    const details = (body.details && typeof body.details === 'object') ? body.details : {};
    const dets = detailLines(details);

    // A short human summary stored alongside the structured details, so the CRM
    // list can show a one-line "message" without unpacking the json every time.
    const message = dets.map(([k, v]) => k + ': ' + v).join(' · ');

    const siteRow = await resolveSite({ siteId: body.siteId, slug: body.slug, site: body.site });

    // Store the lead. If we somehow can't resolve the site we still record it
    // with a null site_id and the raw business name, so it's never lost.
    let stored = false, storeError = null;
    try {
      const ins = await supabase.from('leads').insert({
        site_id: siteRow ? siteRow.id : null,
        owner_user_id: siteRow ? (siteRow.owner_user_id || null) : null,
        name: lead.name || null,
        email: lead.email,
        phone: lead.phone || null,
        kind: lead.kind,
        details,
        message,
        status: 'new',
        site: clean(body.site, 160) || (siteRow ? siteRow.business_name : null),   // legacy text column
        source: clean(body.site, 160) || (siteRow ? siteRow.business_name : null)
      });
      stored = !ins.error;
      if (ins.error) storeError = ins.error.message;
    } catch (e) {
      storeError = (e && e.message) || 'insert_failed';
    }

    // Email the business — best effort, never blocks the lead being stored.
    const to = contactEmailFor(siteRow);
    const business = (siteRow && siteRow.business_name) || clean(body.site, 160);
    const mail = await sendEmail({ to, business, lead, dets });

    return ok({ stored, emailed: mail.sent, mail: mail.reason, store_error: storeError });
  } catch (e) {
    console.error('leads error:', e && e.message);
    // Still 200 so the customer is thanked; we just log the failure.
    return ok({ stored: false, error: 'server' });
  }
};
