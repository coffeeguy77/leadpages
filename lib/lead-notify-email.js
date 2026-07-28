'use strict';

/**
 * Website enquiry lead notification email (HTML + text).
 * Used by /api/leads when a quote/contact form is submitted.
 */

const {
  normalizeStyle,
  DEFAULT_STYLE,
  LOGO_ANIMATED,
  LOGO_WORDMARK,
  withTintedLogos
} = require('./lead-notify-style');
const { dualTintLogoUrl } = require('./lead-notify-logo');

const DEFAULT_BASE = 'https://www.leadpages.com.au';

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

  push('Problem', details.job, 'job');
  push('Message', details.detail != null ? details.detail : details.message, 'detail');
  seen.add('message');

  if (Array.isArray(details.extraFields)) {
    details.extraFields.forEach(function (row, i) {
      if (!row || typeof row !== 'object') return;
      const label = cleanVal(row.label, 120) || 'Extra field ' + (i + 1);
      push(label, row.value, 'extraFields:' + i);
    });
  }
  seen.add('extraFields');

  push('Business', details.businessName, 'businessName');
  push('Industry', details.industry, 'industry');
  push('Goal', details.mainGoal, 'mainGoal');
  push('Budget', details.budget, 'budget');
  if (details.partnerId) push('Partner ID', details.partnerId, 'partnerId');

  const skip = new Set([
    'job',
    'suburb',
    'detail',
    'message',
    'extraFields',
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
  const st = withTintedLogos(opts.style || DEFAULT_STYLE);

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

  const headerGradient =
    'linear-gradient(135deg,' +
    st.headerGradientStart +
    ' 0%,' +
    st.headerGradientMid +
    ' 55%,' +
    st.headerGradientEnd +
    ' 100%)';

  const rowHtml = rows
    .map(function (pair) {
      const k = pair[0];
      const v = pair[1];
      const isMsg = k === 'Message';
      return (
        '<tr>' +
        '<td style="padding:12px 0;border-bottom:1px solid ' +
        esc(st.rowBorder) +
        ';color:' +
        esc(st.labelColor) +
        ';font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;width:110px;vertical-align:top">' +
        esc(k) +
        '</td>' +
        '<td style="padding:12px 0 12px 14px;border-bottom:1px solid ' +
        esc(st.rowBorder) +
        ';font-size:15px;font-weight:500;color:' +
        esc(st.valueColor) +
        ';vertical-align:top;white-space:pre-wrap;' +
        (isMsg ? 'line-height:1.55;' : '') +
        '">' +
        esc(v) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const markW = Math.round(Number(st.logoMarkWidth) || 132);
  const markH = Math.round(Number(st.logoMarkHeight) || markW);
  const wordH = Math.round(Number(st.logoWordmarkHeight) || 84);
  // Brand lockup viewBox 1000×320
  const brandW = Math.round((wordH * 1000) / 320);
  // Approximate custom wordmark aspect (~4.2:1) so clients that require width keep scale
  const wordW = Math.round(wordH * 4.2);

  const useBrand = !!(st.showLogo && st.logoUseBrandLockup);
  const logoParts = [];

  if (useBrand) {
    const brandSrc = dualTintLogoUrl(base, {
      logoTint: st.logoTint || '#ffffff',
      logoTint2: st.logoTint2 || st.logoTint || '#ffffff',
      logoWordmarkHeight: wordH
    });
    logoParts.push(
      '<td style="vertical-align:middle">' +
      '<img src="' +
      esc(brandSrc) +
      '" width="' +
      brandW +
      '" height="' +
      wordH +
      '" alt="leadpages" border="0" style="display:block;border:0;width:' +
      brandW +
      'px;height:' +
      wordH +
      'px;max-height:' +
      wordH +
      'px">' +
      '</td>'
    );
  } else {
    if (st.showLogo && st.showAnimatedLogo) {
      logoParts.push(
        '<td style="vertical-align:middle;padding-right:' +
        (st.showWordmarkLogo ? '14px' : '0') +
        '">' +
        '<img src="' +
        esc(st.logoAnimated) +
        '" width="' +
        markW +
        '" height="' +
        markH +
        '" alt="LeadPages" border="0" style="display:block;border-radius:16px;border:0;width:' +
        markW +
        'px;height:' +
        markH +
        'px;max-width:' +
        markW +
        'px;max-height:' +
        markH +
        'px">' +
        '</td>'
      );
    }
    if (st.showLogo && st.showWordmarkLogo) {
      logoParts.push(
        '<td style="vertical-align:middle">' +
        '<img src="' +
        esc(st.logoWordmark) +
        '" width="' +
        wordW +
        '" height="' +
        wordH +
        '" alt="leadpages" border="0" style="display:block;border:0;width:' +
        wordW +
        'px;height:' +
        wordH +
        'px;max-height:' +
        wordH +
        'px">' +
        '</td>'
      );
    }
  }
  const logoBlock = logoParts.length
    ? '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' + logoParts.join('') + '</tr></table>'
    : '';

  const html =
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:' +
    esc(st.pageBackground) +
    ';font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' +
    'New website enquiry for ' +
    esc(business) +
    (lead.name ? ' from ' + esc(lead.name) : '') +
    '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' +
    esc(st.pageBackground) +
    ';padding:28px 14px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:' +
    esc(st.cardBackground) +
    ';border-radius:18px;overflow:hidden;border:1px solid ' +
    esc(st.cardBorder) +
    ';box-shadow:0 12px 36px rgba(20,40,32,.08)">' +
    '<tr><td style="background:' +
    esc(headerGradient) +
    ';padding:22px 26px 20px">' +
    logoBlock +
    '<p style="margin:' +
    (st.showLogo ? '16px' : '0') +
    ' 0 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' +
    esc(st.headerLabel) +
    '">Website enquiry</p>' +
    '<h1 style="margin:6px 0 0;font-size:22px;line-height:1.25;font-weight:700;color:' +
    esc(st.headerText) +
    '">New enquiry for ' +
    esc(business) +
    '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 26px 10px">' +
    '<p style="margin:0 0 18px;font-size:14.5px;line-height:1.5;color:' +
    esc(st.bodyText) +
    '">Someone just submitted a form on your website. Their details are below — reply or call them back when you\'re ready.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
    rowHtml +
    '</table>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 26px 26px">' +
    (lead.phone
      ? '<a href="tel:' +
        esc(lead.phone) +
        '" style="display:inline-block;background:' +
        esc(st.buttonBackground) +
        ';color:' +
        esc(st.buttonText) +
        ';text-decoration:none;padding:12px 20px;border-radius:11px;font-weight:700;font-size:14.5px;margin:0 10px 10px 0">Call ' +
        esc(lead.name || 'them') +
        ' back</a>'
      : '') +
    (lead.email
      ? '<a href="mailto:' +
        esc(lead.email) +
        '" style="display:inline-block;background:transparent;color:' +
        esc(st.buttonOutline) +
        ';text-decoration:none;padding:11px 18px;border-radius:11px;font-weight:700;font-size:14.5px;border:1.5px solid ' +
        esc(st.buttonOutline) +
        ';margin:0 0 10px">Email reply</a>'
      : '') +
    '<p style="margin:14px 0 0"><a href="' +
    esc(manageUrl) +
    '" style="color:' +
    esc(st.linkColor) +
    ';font-weight:600;font-size:13.5px;text-decoration:none">Open in Captured Leads →</a></p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 26px 22px;background:' +
    esc(st.footerBackground) +
    ';border-top:1px solid ' +
    esc(st.footerBorder) +
    '">' +
    '<p style="margin:0;font-size:12px;line-height:1.45;color:' +
    esc(st.footerText) +
    '">Sent by LeadPages · This notification is for ' +
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
    style: st,
    logoAnimated: st.logoAnimated,
    logoWordmark: st.logoWordmark,
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
