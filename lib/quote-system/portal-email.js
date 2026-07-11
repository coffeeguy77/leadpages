/**
 * Online Quote System — portal link and acceptance notification emails.
 */

const FROM = process.env.LEADS_FROM || 'leadpages <noreply@leadpages.webculture.au>';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendPortalLinkEmail({ to, businessName, portalUrl, totalFormatted, pdfBuffer }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };

  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c2330">' +
    '<h2 style="margin:0 0 8px">Your quote from ' + esc(businessName || 'your provider') + '</h2>' +
    '<p style="color:#566;margin:0 0 16px">Your verified quote' +
    (totalFormatted ? (' is <strong>' + esc(totalFormatted) + ' inc GST</strong>') : '') +
    (pdfBuffer
      ? '. Your itemised quote PDF is attached. You can also open your private portal to accept online.</p>'
      : '. View the full breakdown, download a PDF from the portal, or accept online.</p>') +
    '<a href="' + esc(portalUrl) + '" style="display:inline-block;background:#1f7a63;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Open your quote portal</a>' +
    (pdfBuffer ? '<p style="color:#566;font-size:14px;margin:16px 0 0">The itemised quote PDF is attached to this email.</p>' : '') +
    '<p style="color:#8a93a3;font-size:12px;margin:20px 0 0">This link is private — do not share it publicly.</p>' +
    '</div>';

  const payload = {
    from: FROM,
    to: [to],
    subject: 'Your quote' + (totalFormatted ? (' — ' + totalFormatted) : '') + ' — ' + (businessName || ''),
    html
  };
  if (pdfBuffer && pdfBuffer.length) {
    payload.attachments = [{
      filename: 'quote.pdf',
      content: pdfBuffer.toString('base64')
    }];
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return { sent: false, reason: 'resend_' + r.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

async function sendEmailVerifiedTotalEmail({ to, businessName, totalFormatted, returnUrl }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };

  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c2330">' +
    '<h2 style="margin:0 0 8px">Your quote total — ' + esc(businessName || 'your provider') + '</h2>' +
    '<p style="color:#566;margin:0 0 12px">Email verified. Your estimated total is <strong>' + esc(totalFormatted || '') + ' inc GST</strong>.</p>' +
    '<p style="color:#566;margin:0 0 16px">Complete SMS verification on the quote wizard to unlock the full itemised breakdown, PDF download, and quote portal link.</p>' +
    (returnUrl ? '<p style="font-size:13px;color:#8a93a3">Return to <a href="' + esc(returnUrl) + '">your quote</a> to finish verification.</p>' : '') +
    '</div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: 'Quote total' + (totalFormatted ? (' — ' + totalFormatted) : '') + ' — ' + (businessName || ''),
        html
      })
    });
    if (!r.ok) return { sent: false, reason: 'resend_' + r.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

async function sendAcceptanceNotifyEmail({ to, businessName, contactName, contactEmail, totalFormatted, portalUrl }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { sent: false, reason: !key ? 'no_key' : 'no_recipient' };

  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">' +
    '<h2 style="margin:0 0 8px">Quote accepted — ' + esc(businessName || 'your site') + '</h2>' +
    '<p style="margin:0 0 12px;color:#566">' + esc(contactName || 'A customer') +
    ' accepted their online quote' + (totalFormatted ? (' of <strong>' + esc(totalFormatted) + '</strong>') : '') + '.</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    (contactEmail ? '<tr><td style="padding:6px 8px;color:#6b7280">Email</td><td style="padding:6px 8px;font-weight:600">' + esc(contactEmail) + '</td></tr>' : '') +
    '</table>' +
    (portalUrl ? '<p style="margin:16px 0 0"><a href="' + esc(portalUrl) + '">View quote in portal</a></p>' : '') +
    '</div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: 'Quote accepted' + (contactName ? (' — ' + contactName) : ''),
        html
      })
    });
    if (!r.ok) return { sent: false, reason: 'resend_' + r.status };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || 'fetch_error' };
  }
}

function contactEmailForSite(site) {
  const cfg = (site && site.config) || {};
  const q = (cfg.sections && cfg.sections.quote) || {};
  if (q.notifyMode === 'custom' && q.notifyEmail) return String(q.notifyEmail).trim();
  return String(cfg.email || '').trim() || '';
}

module.exports = {
  sendPortalLinkEmail,
  sendEmailVerifiedTotalEmail,
  sendAcceptanceNotifyEmail,
  contactEmailForSite
};
