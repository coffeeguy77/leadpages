// api/instagram/callback.js — completes Business Login and stores the long-lived token.
// GET /api/instagram/callback?code=...&state=...   (Instagram redirects here)
//
// Verifies the signed state, exchanges code -> short-lived -> 60-day token, reads the
// username, and UPSERTS ig_connections (keyed by slug). The token is never sent to the browser.
//
// Env: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI, IG_STATE_SECRET (optional),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INSTAGRAM_SUCCESS_URL (optional, defaults to /manage).

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT = process.env.INSTAGRAM_REDIRECT_URI || 'https://www.leadpages.com.au/api/instagram/callback';
const STATE_SECRET = process.env.IG_STATE_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
const BACK = process.env.INSTAGRAM_SUCCESS_URL || 'https://www.leadpages.com.au/manage';

function sign(payload) {
  return crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
}
function verifyState(state) {
  try {
    const parts = String(state || '').split('.');
    if (parts.length !== 2) return null;
    const expected = sign(parts[0]);
    const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!obj || !obj.s) return null;
    if (Date.now() - Number(obj.t || 0) > 15 * 60 * 1000) return null; // 15-minute window
    return String(obj.s);
  } catch (_) { return null; }
}
function done(res, slug, status) {
  const u = BACK + (BACK.indexOf('?') >= 0 ? '&' : '?') + 'ig=' + encodeURIComponent(status) + (slug ? ('&site=' + encodeURIComponent(slug)) : '');
  res.setHeader('cache-control', 'no-store');
  res.writeHead(302, { Location: u });
  res.end();
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const slug = verifyState(q.state);
  try {
    if (q.error) return done(res, slug, 'denied');
    if (!slug) return res.status(400).send('Invalid or expired connection request. Please start again from the editor.');
    if (!APP_ID || !APP_SECRET) return res.status(500).send('Instagram connection is not configured.');

    let code = String(q.code || '');
    if (!code) return done(res, slug, 'error');
    code = code.replace(/#_$/, ''); // strip trailing "#_"

    // 1) authorization code -> short-lived token
    const form = new URLSearchParams();
    form.set('client_id', APP_ID);
    form.set('client_secret', APP_SECRET);
    form.set('grant_type', 'authorization_code');
    form.set('redirect_uri', REDIRECT);
    form.set('code', code);
    const sRes = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
    const sJson = await sRes.json().catch(() => ({}));
    const first = (sJson && Array.isArray(sJson.data) && sJson.data[0]) ? sJson.data[0] : sJson;
    const shortTok = first && first.access_token;
    if (!sRes.ok || !shortTok) return done(res, slug, 'error');

    // 2) short-lived -> long-lived (60-day) token
    const lRes = await fetch('https://graph.instagram.com/access_token?grant_type=ig_exchange_token'
      + '&client_secret=' + encodeURIComponent(APP_SECRET)
      + '&access_token=' + encodeURIComponent(shortTok));
    const lJson = await lRes.json().catch(() => ({}));
    const longTok = lJson && lJson.access_token;
    if (!lRes.ok || !longTok) return done(res, slug, 'error');
    const expiresAt = new Date(Date.now() + (Number(lJson.expires_in || 5184000) * 1000)).toISOString();

    // 3) username / ig user id
    let username = null, igUserId = null;
    try {
      const uRes = await fetch('https://graph.instagram.com/me?fields=id,username&access_token=' + encodeURIComponent(longTok));
      const uJson = await uRes.json().catch(() => ({}));
      if (uRes.ok) { username = uJson.username || null; igUserId = uJson.id || null; }
    } catch (_) {}

    // 4) store — keyed by slug. Clear cache so fresh media loads immediately.
    const row = { slug, access_token: longTok, token_expires_at: expiresAt, ig_username: username, ig_user_id: igUserId, ig_cache: null, ig_cache_at: null };
    let ok = false;
    try { const up = await supabase.from('ig_connections').upsert(row, { onConflict: 'slug' }); ok = !up.error; } catch (_) {}
    if (!ok) {
      try { const up2 = await supabase.from('ig_connections').upsert({ slug, access_token: longTok, token_expires_at: expiresAt, ig_username: username }, { onConflict: 'slug' }); ok = !up2.error; } catch (_) {}
    }
    return done(res, slug, ok ? 'connected' : 'error');
  } catch (e) {
    return done(res, slug, 'error');
  }
};
