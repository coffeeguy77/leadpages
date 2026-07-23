'use strict';

/**
 * Google OAuth helpers for Search Intelligence (GSC / GA4).
 * Nonces stored in si_oauth_states; tokens encrypted via crypto.js.
 */

const crypto = require('crypto');
const oauthCfg = require('./config');

function stateSecret() {
  return (
    String(process.env.SI_OAUTH_STATE_SECRET || '').trim() ||
    String(process.env.GOOGLE_ADS_STATE_SECRET || '').trim() ||
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || 'leadpages-si-oauth-dev').slice(0, 64)
  );
}

function sign(body) {
  return crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function makeState(payload) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const body = Buffer.from(
    JSON.stringify(Object.assign({ t: Date.now(), n: nonce }, payload || {}))
  ).toString('base64url');
  return { state: body + '.' + sign(body), nonce: nonce, issuedAt: Date.now() };
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

async function reserveStateNonce(admin, opts) {
  const o = opts || {};
  if (!admin || !o.nonce) throw new Error('missing_nonce');
  const ttl = o.maxAgeMs == null ? 15 * 60 * 1000 : o.maxAgeMs;
  const expires = new Date(Date.now() + ttl).toISOString();
  const { error } = await admin.from('si_oauth_states').insert({
    nonce: o.nonce,
    site_id: o.siteId || null,
    leadpages_user_id: o.userId || null,
    provider: o.provider || null,
    expires_at: expires
  });
  if (error) throw new Error(error.message || 'state_reserve_failed');
}

async function consumeStateNonce(admin, nonce) {
  if (!admin || !nonce) return false;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('si_oauth_states')
    .update({ used_at: now })
    .eq('nonce', nonce)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('nonce')
    .maybeSingle();
  if (error) {
    console.error('si consumeStateNonce:', error.message);
    return false;
  }
  return !!(data && data.nonce);
}

function authorizeUrl(providerId, state) {
  const p = oauthCfg.getProvider(providerId);
  if (!p) throw new Error('unknown_provider');
  const clientId = oauthCfg.clientId(providerId);
  if (!clientId) throw new Error('not_configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCfg.oauthRedirectUri(providerId),
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: p.scopes.join(' '),
    state: state
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function exchangeCode(providerId, code) {
  const p = oauthCfg.getProvider(providerId);
  if (!p) throw new Error('unknown_provider');
  const clientId = oauthCfg.clientId(providerId);
  const clientSecret = oauthCfg.clientSecret(providerId);
  if (!clientId || !clientSecret) throw new Error('not_configured');
  const body = new URLSearchParams({
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: oauthCfg.oauthRedirectUri(providerId),
    grant_type: 'authorization_code'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const json = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error(json.error_description || json.error || 'token_exchange_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function refreshAccessToken(providerId, refreshToken) {
  const p = oauthCfg.getProvider(providerId);
  if (!p) throw new Error('unknown_provider');
  if (!refreshToken) throw new Error('missing_refresh_token');
  const clientId = oauthCfg.clientId(providerId);
  const clientSecret = oauthCfg.clientSecret(providerId);
  if (!clientId || !clientSecret) throw new Error('not_configured');
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const json = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error(json.error_description || json.error || 'token_refresh_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function fetchGoogleAccountEmail(accessToken) {
  if (!accessToken) return null;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!r.ok) return null;
    const j = await r.json().catch(function () { return {}; });
    return j && j.email ? String(j.email) : null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  makeState: makeState,
  parseState: parseState,
  reserveStateNonce: reserveStateNonce,
  consumeStateNonce: consumeStateNonce,
  authorizeUrl: authorizeUrl,
  exchangeCode: exchangeCode,
  refreshAccessToken: refreshAccessToken,
  fetchGoogleAccountEmail: fetchGoogleAccountEmail
};
