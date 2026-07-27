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
const { limited } = require('./_rate-limit');
const { assessLeadSpam } = require('../lib/lead-spam');
const { isLeadBlocked } = require('../lib/lead-blocklist');
const {
  pickAttribution,
  upsertVisitorSession,
  attributionForLeadInsert,
  deriveTrafficSource
} = require('../lib/attribution');
const { deliverConversion } = require('../lib/google-ads/conversions');
const { detailLines, buildLeadNotifyEmail } = require('../lib/lead-notify-email');
const { resolveLeadNotifyStyle } = require('../lib/lead-notify-style');

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

async function sendEmail({ to, business, lead, dets, slug, siteId, style }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };

  const mail = buildLeadNotifyEmail({ business, lead, dets, slug, style });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: lead.email || undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text
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
  // Soft rate limit: keep thank-you UX (200) but skip store/email on abuse.
  if (limited(req, { key: 'leads', max: 20, windowMs: 60000 })) {
    return ok({ stored: false, skipped: 'rate_limited' });
  }

  try {
    const body = await readBody(req);

    const spam = assessLeadSpam(body);
    if (spam.spam) {
      return ok({ stored: false, skipped: 'spam', reason: spam.reason });
    }

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

    if (siteRow) {
      const blocked = isLeadBlocked({
        email: lead.email,
        country: details.country || details.countryCode || body.country || body.countryCode
      }, (siteRow.config && siteRow.config.leadInbox) || {});
      if (blocked.blocked) {
        return ok({ stored: false, skipped: 'blocked', reason: blocked.reason, match: blocked.match });
      }
    }

    // Session attribution (gclid / UTMs) — first-party truth before any Google upload.
    const attr = pickAttribution(Object.assign({}, body, body.attribution || {}, details.attribution || {}));
    if (!attr.traffic_source) attr.traffic_source = deriveTrafficSource(attr);
    if (siteRow && attr.session_id && attr.visitor_id) {
      try { await upsertVisitorSession(supabase, siteRow.id, attr); } catch (e) { /* ignore */ }
    }
    // Keep attribution inside details for CRM display without exposing raw gclid in UI lists.
    if (attr.session_id || attr.gclid || attr.utm_source || attr.traffic_source) {
      details.attribution = {
        trafficSource: attr.traffic_source || null,
        utmSource: attr.utm_source || null,
        utmMedium: attr.utm_medium || null,
        utmCampaign: attr.utm_campaign || null,
        landingPageUrl: attr.landing_page_url || null,
        pageId: attr.page_id || null,
        hasGclid: !!(attr.gclid || attr.gbraid || attr.wbraid),
        sessionId: attr.session_id || null
      };
    }

    const trafficLabel = attr.traffic_source === 'google_ads'
      ? 'Google Ads'
      : (attr.utm_source || clean(body.site, 160) || (siteRow ? siteRow.business_name : null));

    // Store the lead. If we somehow can't resolve the site we still record it
    // with a null site_id and the raw business name, so it's never lost.
    let stored = false, storeError = null, leadId = null;
    const baseLead = {
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
      source: trafficLabel
    };
    try {
      let ins = await supabase.from('leads').insert(Object.assign({}, baseLead, attributionForLeadInsert(attr))).select('id').maybeSingle();
      // If attribution columns are not migrated yet, retry without them (details.attribution still kept).
      if (ins.error && /column|schema cache/i.test(ins.error.message || '')) {
        ins = await supabase.from('leads').insert(baseLead).select('id').maybeSingle();
      }
      stored = !ins.error;
      if (ins.error) storeError = ins.error.message;
      else leadId = ins.data && ins.data.id;
    } catch (e) {
      storeError = (e && e.message) || 'insert_failed';
    }

    // Form submission conversion — only after successful DB save.
    if (stored && siteRow) {
      try {
        await deliverConversion(supabase, {
          siteId: siteRow.id,
          eventKey: 'form_submission',
          internalEvent: 'lead_submit',
          leadId,
          attr,
          occurredAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('form conversion:', e && e.message);
      }
    }

    // Email the business — best effort, never blocks the lead being stored.
    const to = contactEmailFor(siteRow);
    const business = (siteRow && siteRow.business_name) || clean(body.site, 160);
    let notifyStyle = null;
    if (siteRow) {
      try {
        const resolved = await resolveLeadNotifyStyle(supabase, siteRow.id, siteRow.config);
        notifyStyle = resolved && resolved.style;
      } catch (e) {
        /* style table optional until migration applied */
      }
    }
    const mail = await sendEmail({
      to,
      business,
      lead,
      dets,
      slug: (siteRow && siteRow.slug) || clean(body.slug, 80) || '',
      siteId: siteRow && siteRow.id,
      style: notifyStyle
    });

    return ok({ stored, emailed: mail.sent, mail: mail.reason, store_error: storeError });
  } catch (e) {
    console.error('leads error:', e && e.message);
    // Still 200 so the customer is thanked; we just log the failure.
    return ok({ stored: false, error: 'server' });
  }
};
