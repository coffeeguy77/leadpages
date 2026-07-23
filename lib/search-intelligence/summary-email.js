'use strict';

/**
 * Email a Search Intelligence client summary via Resend.
 */

const FROM = process.env.CAMPAIGN_FROM || process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';
const APP_MANAGE = process.env.APP_URL
  ? String(process.env.APP_URL).replace(/\/+$/, '') + '/manage'
  : 'https://app.leadpages.com.au/manage';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSummaryHtml(summary) {
  const s = summary || {};
  const bullets = (s.bullets || [])
    .map(function (b) {
      return '<li style="margin:0 0 8px">' + esc(b) + '</li>';
    })
    .join('');
  const actions = (s.topActions || [])
    .slice(0, 5)
    .map(function (a) {
      return (
        '<tr><td style="padding:8px 0;border-bottom:1px solid #e8ecef;vertical-align:top">' +
        '<strong style="display:block;margin-bottom:4px">' +
        esc(a.title) +
        '</strong>' +
        '<span style="color:#5b6878;font-size:13px;line-height:1.4">' +
        esc(a.plainLanguage || '') +
        '</span></td></tr>'
      );
    })
    .join('');

  return (
    '<div style="font-family:Inter,system-ui,Segoe UI,sans-serif;color:#16201c;line-height:1.55;max-width:560px;margin:0 auto">' +
    '<p style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#1f7a63;font-weight:700;margin:0 0 8px">Search Intelligence</p>' +
    '<h1 style="font-size:22px;margin:0 0 6px">' +
    esc(s.businessName || 'Your site') +
    ' — weekly summary</h1>' +
    '<p style="color:#5b6878;margin:0 0 18px">' +
    esc(s.periodStart || '') +
    ' → ' +
    esc(s.periodEnd || '') +
    '</p>' +
    '<ul style="padding-left:1.2rem;margin:0 0 20px">' +
    bullets +
    '</ul>' +
    (actions
      ? '<h2 style="font-size:15px;margin:0 0 8px">Top actions</h2><table style="width:100%;border-collapse:collapse">' +
        actions +
        '</table>'
      : '') +
    '<p style="margin:22px 0 0"><a href="' +
    esc(APP_MANAGE) +
    '" style="display:inline-block;background:#1f7a63;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">Open SEO Command Centre</a></p>' +
    '<p style="color:#8a93a3;font-size:12px;margin-top:18px">You received this because Search Intelligence weekly summaries are enabled for your LeadPages site.</p>' +
    '</div>'
  );
}

async function sendResendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'resend_not_configured' };
  if (!to) return { ok: false, error: 'missing_to' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ from: FROM, to: to, subject: subject, html: html })
    });
    const j = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) {
      return {
        ok: false,
        error: 'resend_failed',
        message: (j && (j.message || j.error)) || 'HTTP ' + r.status
      };
    }
    return { ok: true, id: j.id || null };
  } catch (e) {
    return { ok: false, error: 'resend_network', message: String((e && e.message) || e) };
  }
}

/**
 * Resolve recipient: explicit override → site.owner_email → auth user email for owner_user_id
 */
async function resolveSummaryRecipient(admin, site, overrideTo) {
  if (overrideTo) return String(overrideTo).trim();
  if (site && site.owner_email) return String(site.owner_email).trim();
  if (site && site.owner_user_id && admin) {
    try {
      const { data } = await admin.auth.admin.getUserById(site.owner_user_id);
      if (data && data.user && data.user.email) return data.user.email;
    } catch (_e) {
      /* ignore */
    }
  }
  return null;
}

async function emailClientSummary(admin, site, summary, opts) {
  const o = opts || {};
  const to = await resolveSummaryRecipient(admin, site, o.to);
  if (!to) return { ok: false, error: 'no_recipient', message: 'No owner_email on site.' };
  const subject =
    o.subject ||
    'Search summary — ' + ((summary && summary.businessName) || site.business_name || 'your site');
  const html = renderSummaryHtml(summary);
  const sent = await sendResendEmail({ to: to, subject: subject, html: html });
  return Object.assign({ to: to }, sent);
}

module.exports = {
  renderSummaryHtml: renderSummaryHtml,
  sendResendEmail: sendResendEmail,
  resolveSummaryRecipient: resolveSummaryRecipient,
  emailClientSummary: emailClientSummary
};
