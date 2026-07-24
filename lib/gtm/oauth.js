'use strict';

/**
 * Google Tag Manager OAuth + config helpers.
 * Uses GTM_CLIENT_ID / GTM_CLIENT_SECRET / GTM_REDIRECT_URI.
 * Publish remains behind GTM_MANAGED_PUBLISH.
 */

const { appUrl, stripTrailingSlash, LOCAL_APP_URL } = require('../app-url');
const { encryptSecret, decryptSecret } = require('../google-ads/token-crypto');
const crypto = require('crypto');

const CALLBACK_PATH = '/api/integrations/tag-manager/callback';

const SCOPES_READ = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/tagmanager.readonly'
];
const SCOPES_EDIT = SCOPES_READ.concat(['https://www.googleapis.com/auth/tagmanager.edit.containers']);
const SCOPES_PUBLISH = SCOPES_EDIT.concat([
  'https://www.googleapis.com/auth/tagmanager.publish'
]);

function clientId() {
  return (
    process.env.GTM_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    ''
  ).trim();
}

function clientSecret() {
  return (
    process.env.GTM_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    ''
  ).trim();
}

function configured() {
  return !!(clientId() && clientSecret());
}

function oauthRedirectUri() {
  const explicit = stripTrailingSlash(process.env.GTM_REDIRECT_URI || '');
  if (explicit) return explicit;
  const base = appUrl() || LOCAL_APP_URL;
  return base + CALLBACK_PATH;
}

function scopesForMode(mode) {
  if (mode === 'publish') return SCOPES_PUBLISH;
  if (mode === 'edit' || mode === 'managed') return SCOPES_EDIT;
  return SCOPES_READ;
}

function stateSecret() {
  return (
    process.env.GTM_STATE_SECRET ||
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY ||
    process.env.GTM_CLIENT_SECRET ||
    clientSecret() ||
    ''
  );
}

function makeState(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function parseState(state) {
  const parts = String(state || '').split('.');
  if (parts.length !== 2) return null;
  const expect = crypto.createHmac('sha256', stateSecret()).update(parts[0]).digest('base64url');
  if (expect !== parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (_e) {
    return null;
  }
}

function authorizeUrl({ state, mode }) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: oauthRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: scopesForMode(mode || 'read').join(' '),
    state: state
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    code: code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: oauthRedirectUri(),
    grant_type: 'authorization_code'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((json && json.error_description) || json.error || 'token_exchange_failed');
    err.status = r.status;
    throw err;
  }
  return json;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json && json.error_description) || 'refresh_failed');
  return json;
}

async function gtmFetch(path, accessToken) {
  const url = path.startsWith('http')
    ? path
    : 'https://tagmanager.googleapis.com/tagmanager/v2/' + path.replace(/^\//, '');
  const r = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((json && json.error && json.error.message) || 'gtm_http_' + r.status);
    err.status = r.status;
    throw err;
  }
  return json;
}

async function listAccounts(accessToken) {
  const json = await gtmFetch('accounts', accessToken);
  return json.account || json.accounts || [];
}

async function listContainers(accessToken, accountId) {
  const json = await gtmFetch('accounts/' + accountId + '/containers', accessToken);
  return json.container || json.containers || [];
}

/**
 * Lightweight health inspection — presence of obvious tags by name heuristics.
 */
async function inspectContainer(accessToken, accountId, containerId) {
  let workspaces = [];
  try {
    const ws = await gtmFetch(
      'accounts/' + accountId + '/containers/' + containerId + '/workspaces',
      accessToken
    );
    workspaces = ws.workspace || ws.workspaces || [];
  } catch (_e) {
    workspaces = [];
  }
  return {
    workspaces: workspaces.map((w) => ({
      id: String(w.workspaceId || w.workspace_id || w.path || ''),
      name: w.name || ''
    })),
    notes: [
      'LeadPages does not publish GTM versions unless GTM_MANAGED_PUBLISH=1 and you confirm.',
      'Prefer LeadPages Native tracking; use GTM dataLayer mode if you manage tags yourself.'
    ]
  };
}

module.exports = {
  CALLBACK_PATH,
  configured,
  clientId,
  clientSecret,
  oauthRedirectUri,
  scopesForMode,
  makeState,
  parseState,
  authorizeUrl,
  exchangeCode,
  refreshAccessToken,
  listAccounts,
  listContainers,
  inspectContainer,
  encryptSecret,
  decryptSecret,
  gtmFetch
};
