// api/unsubscribe.js — the one-click unsubscribe link at the bottom of every
// campaign email. Adds the address to that site's opt-out list so future bulk
// sends skip them. Handles both GET (link click, shows a small confirmation
// page) and POST (email-client one-click, per List-Unsubscribe-Post).
//
//   /api/unsubscribe?s=<siteId>&e=<email>

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function param(req, k) {
  try { return new URL(req.url, 'https://x').searchParams.get(k) || ''; } catch { return ''; }
}

module.exports = async (req, res) => {
  const siteId = (param(req, 's') || '').trim();
  const email = (param(req, 'e') || '').trim().toLowerCase();

  let done = false;
  if (siteId && email) {
    try {
      // Ignore duplicates (unique on site_id+email).
      await admin.from('email_optouts').upsert({ site_id: siteId, email }, { onConflict: 'site_id,email' });
      // Also flag the lead record if it exists, so the CRM list shows it.
      await admin.from('leads').update({ email_opt_out: true }).eq('site_id', siteId).eq('email', email);
      done = true;
    } catch (e) { done = false; }
  }

  // One-click POST from an email client: just acknowledge.
  if (req.method === 'POST') { res.statusCode = done ? 200 : 400; res.end(done ? 'ok' : 'error'); return; }

  res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:12vh auto;text-align:center;color:#1c2330;padding:0 20px">'
    + (done
        ? '<h1 style="font-size:22px;margin:0 0 8px">You\u2019re unsubscribed</h1><p style="color:#6b7280">' + esc(email) + ' won\u2019t receive any more marketing emails from this business.</p>'
        : '<h1 style="font-size:22px;margin:0 0 8px">Link not valid</h1><p style="color:#6b7280">We couldn\u2019t process that unsubscribe request. Please reply to the email and ask to be removed.</p>')
    + '</div>');
};
