const crypto = require('crypto');
const cfg = require('./config');

function sign(body) {
  return crypto.createHmac('sha256', cfg.stateSecret()).update(body).digest('base64url');
}

function makeState(payload) {
  const body = Buffer.from(JSON.stringify(Object.assign({ t: Date.now(), n: crypto.randomBytes(8).toString('hex') }, payload))).toString('base64url');
  return body + '.' + sign(body);
}

function parseState(state, maxAgeMs) {
  maxAgeMs = maxAgeMs == null ? 15 * 60 * 1000 : maxAgeMs;
  if (!state || typeof state !== 'string' || state.indexOf('.') < 0) return null;
  const [body, sig] = state.split('.');
  if (sign(body) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data || !data.t || Date.now() - data.t > maxAgeMs) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    redirect_uri: cfg.oauthRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
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
    err.details = json;
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
    err.details = json;
    throw err;
  }
  return json;
}

module.exports = {
  makeState,
  parseState,
  authorizeUrl,
  exchangeCode,
  refreshAccessToken
};
