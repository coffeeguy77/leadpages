const crypto = require('crypto');
const cfg = require('./config');

function sign(body) {
  return crypto.createHmac('sha256', cfg.stateSecret()).update(body).digest('base64url');
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Build signed state. Always includes nonce `n` and issued-at `t`.
 * Caller should persist nonce via reserveStateNonce() before redirecting.
 */
function makeState(payload) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const body = Buffer.from(JSON.stringify(Object.assign(
    { t: Date.now(), n: nonce },
    payload || {}
  ))).toString('base64url');
  return { state: body + '.' + sign(body), nonce, issuedAt: Date.now() };
}

function parseState(state, maxAgeMs) {
  maxAgeMs = maxAgeMs == null ? 15 * 60 * 1000 : maxAgeMs;
  if (!state || typeof state !== 'string' || state.indexOf('.') < 0) return null;
  const i = state.lastIndexOf('.');
  const body = state.slice(0, i);
  const sig = state.slice(i + 1);
  if (!timingSafeEqualStr(sign(body), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data || !data.t || !data.n) return null;
    if (Date.now() - Number(data.t) > maxAgeMs) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/** Persist nonce before sending user to Google. */
async function reserveStateNonce(admin, { nonce, siteId, userId, maxAgeMs }) {
  if (!admin || !nonce) throw new Error('missing_nonce');
  const ttl = maxAgeMs == null ? 15 * 60 * 1000 : maxAgeMs;
  const expires = new Date(Date.now() + ttl).toISOString();
  const { error } = await admin.from('google_ads_oauth_states').insert({
    nonce,
    site_id: siteId || null,
    leadpages_user_id: userId || null,
    expires_at: expires
  });
  if (error) throw new Error(error.message || 'state_reserve_failed');
}

/**
 * Consume nonce exactly once. Returns false if missing, expired, or already used.
 */
async function consumeStateNonce(admin, nonce) {
  if (!admin || !nonce) return false;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('google_ads_oauth_states')
    .update({ used_at: now })
    .eq('nonce', nonce)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('nonce')
    .maybeSingle();
  if (error) {
    console.error('consumeStateNonce:', error.message);
    return false;
  }
  return !!(data && data.nonce);
}

function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    redirect_uri: cfg.oauthRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: cfg.scopes().join(' '),
    state
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    redirect_uri: cfg.oauthRedirectUri(),
    grant_type: 'authorization_code'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((json.error_description || json.error || 'token_exchange_failed'));
    err.details = { error: json.error, error_description: json.error_description };
    throw err;
  }
  return json;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    grant_type: 'refresh_token'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((json.error_description || json.error || 'token_refresh_failed'));
    err.details = { error: json.error, error_description: json.error_description };
    throw err;
  }
  return json;
}

/** Fetch Google account email using access token (openid / userinfo scopes). */
async function fetchGoogleAccountEmail(accessToken) {
  if (!accessToken) return null;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return (j && j.email) ? String(j.email) : null;
  } catch (e) {
    return null;
  }
}

/** Best-effort revoke of a refresh or access token. */
async function revokeGoogleToken(token) {
  if (!token) return { ok: false, reason: 'no_token' };
  try {
    const r = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, reason: 'revoke_' + r.status, body: String(t).slice(0, 120) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'revoke_network' };
  }
}

module.exports = {
  makeState,
  parseState,
  reserveStateNonce,
  consumeStateNonce,
  authorizeUrl,
  exchangeCode,
  refreshAccessToken,
  fetchGoogleAccountEmail,
  revokeGoogleToken
};
