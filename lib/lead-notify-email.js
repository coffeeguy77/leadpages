'use strict';

/**
 * Website enquiry lead notification email (HTML + text).
 * Used by /api/leads when a quote/contact form is submitted.
 */

const DEFAULT_BASE = 'https://www.leadpages.com.au';
/** Proper multi-frame GIF (small, email-safe). */
const LOGO_ANIMATED =
  'https://www.leadpages.com.au/assets/leadpages-mark-email.gif';
/** Black wordmark for light email backgrounds. */
const LOGO_WORDMARK =
  'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782899714/leadpages-logo-black.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanVal(s, n) {
  return (s == null ? '' : String(s)).trim().slice(0, n || 2000);
}

/**
 * Build labelled rows from the form details payload.
 * Includes job + message (detail). Skips suburb/region and attribution blobs.
 */
function detailLines(details) {
  if (!details || typeof details !== 'object') return [];
  const out = [];
  const seen = new Set();

  function push(label, value, key) {
    const v = cleanVal(value, 2000);
    if (!v) return;
    if (key) seen.add(key);
    out.push([label, v]);
  }

  // Trade quote form: job + free-text message (was previously dropped)
  push('Problem', details.job, 'job');
  push('Message', details.detail != null ? details.detail : details.message, 'detail');
  seen.add('message');

  // Partner / other forms
  push('Business', details.businessName, 'businessName');
  push('Industry', details.industry, 'industry');
  push('Goal', details.mainGoal, 'mainGoal');
  push('Budget', details.budget, 'budget');
  if (details.partnerId) push('Partner ID', details.partnerId, 'partnerId');

  // Skip region/suburb per product request; skip noisy internals
  const skip = new Set([
    'job',
    'suburb',
    'detail',
    'message',
    'businessName',
    'industry',
    'mainGoal',
    'budget',
    'partnerId',
    'attribution',
    'country',
    'countryCode',
    'lp_hp',
    '_t'
  ]);

  Object.keys(details).forEach(function (k) {
    if (skip.has(k) || seen.has(k)) return;
    if (details[k] == null || details[k] === '') return;
    if (typeof details[k] === 'object') return;
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
    push(label, details[k], k);
  });

  return out;
}

function publicBase() {
  return String(process.env.BASE_URL || process.env.PUBLIC_SITE_URL || DEFAULT_BASE)
    .trim()
    .replace(/\/+$/, '') || DEFAULT_BASE;
}

function buildLeadNotifyEmail(opts) {
  opts = opts || {};
  const business = cleanVal(opts.business, 160) || 'your site';
  const lead = opts.lead || {};
  const dets = Array.isArray(opts.dets) ? opts.dets : detailLines(opts.details || {});
  const slug = cleanVal(opts.slug, 80);
  const base = publicBase();

  const rows = [
    ['Name', lead.name || '(not given)'],
    ['Phone', lead.phone || '(not given)'],
    lead.email ? ['Email', lead.email] : null
  ]
    .concat(dets)
    .filter(Boolean);

  const manageUrl = slug
    ? base + '/manage?site=' + encodeURIComponent(slug)
    : base + '/manage';

  const subject =
    'New enquiry' + (lead.name ? ' from ' + lead.name : '') + ' — ' + business;

  const text =
    'New enquiry for ' +
    business +
    '\n\n' +
    rows.map(function (r) {
      return r[0] + ': ' + r[1];
    }).join('\n') +
    '\n\nOpen Captured Leads: ' +
    manageUrl +
    '\n';

  // Stacked label-above-value blocks (email-safe tables) — clearer than a cramped 2-col grid
  const rowHtml = rows
    .map(function (pair, i) {
      const k = pair[0];
      const v = pair[1];
      const isEmail = k === 'Email' && /@/.test(v);
      const valueHtml = isEmail
        ? '<a href="mailto:' + esc(v) + '" style="color:#1f7a63;text-decoration:underline">' + esc(v) + '</a>'
        : esc(v);
      const padTop = i === 0 ? '0' : '14';
      return (
        '<tr><td style="padding:' +
        padTop +
        'px 0 0">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f7;border-radius:12px;border:1px solid #e8ecea">' +
        '<tr><td style="padding:14px 16px">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a8680;margin:0 0 6px">' +
        esc(k) +
        '</div>' +
        '<div style="font-size:16px;line-height:1.45;font-weight:500;color:#14201c;white-space:pre-wrap">' +
        valueHtml +
        '</div>' +
        '</td></tr></table>' +
        '</td></tr>'
      );
    })
    .join('');

  const html =
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f1;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' +
    'New website enquiry for ' +
    esc(business) +
    (lead.name ? ' from ' + esc(lead.name) : '') +
    '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f1;padding:28px 14px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dde3df">' +
    // Light header — no green fill
    '<tr><td style="background:#ffffff;padding:28px 28px 8px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="vertical-align:middle;padding-right:14px">' +
    '<img src="' +
    LOGO_ANIMATED +
    '" width="56" height="56" alt="" style="display:block;border:0;border-radius:14px">' +
    '</td>' +
    '<td style="vertical-align:middle">' +
    '<img src="' +
    LOGO_WORDMARK +
    '" height="84" alt="leadpages" style="display:block;border:0;height:84px;width:auto;max-width:280px">' +
    '</td>' +
    '</tr></table>' +
    '<p style="margin:22px 0 0;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b756f">Website enquiry</p>' +
    '<h1 style="margin:8px 0 0;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#14201c">New enquiry for ' +
    esc(business) +
    '</h1>' +
    '</td></tr>' +
    // Body
    '<tr><td style="padding:20px 28px 8px;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif">' +
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#5b6762">Someone just submitted a form on your website. Their details are below — reply or call them back when you\'re ready.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    rowHtml +
    '</table>' +
    '</td></tr>' +
    // CTA
    '<tr><td style="padding:20px 28px 28px;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif">' +
    (lead.phone
      ? '<a href="tel:' +
        esc(lead.phone) +
        '" style="display:inline-block;background:#1f7a63;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:11px;font-weight:700;font-size:14.5px;margin:0 10px 10px 0">Call ' +
        esc(lead.name || 'them') +
        ' back</a>'
      : '') +
    (lead.email
      ? '<a href="mailto:' +
        esc(lead.email) +
        '" style="display:inline-block;background:#ffffff;color:#1f7a63;text-decoration:none;padding:12px 20px;border-radius:11px;font-weight:700;font-size:14.5px;border:1.5px solid #1f7a63;margin:0 0 10px">Email reply</a>'
      : '') +
    '<p style="margin:16px 0 0"><a href="' +
    esc(manageUrl) +
    '" style="color:#1f7a63;font-weight:600;font-size:14px;text-decoration:none">Open in Captured Leads →</a></p>' +
    '</td></tr>' +
    // Footer
    '<tr><td style="padding:16px 28px 22px;background:#f7f8f7;border-top:1px solid #e5ebe8;font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif">' +
    '<p style="margin:0;font-size:12px;line-height:1.45;color:#8a9590">Sent by LeadPages · This notification is for ' +
    esc(business) +
    '. Reply to the customer using the contact details above.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr></table>' +
    '</body></html>';

  return {
    subject,
    html,
    text,
    rows,
    logoAnimated: LOGO_ANIMATED,
    logoWordmark: LOGO_WORDMARK,
    manageUrl
  };
}

module.exports = {
  detailLines,
  buildLeadNotifyEmail,
  LOGO_ANIMATED,
  LOGO_WORDMARK,
  esc
};
