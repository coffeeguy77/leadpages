/**
 * Platform Google Ads env configuration.
 * OAuth redirect URI is NEVER taken from the request Host header.
 */

const { appUrl, stripTrailingSlash, LOCAL_APP_URL, PROD_APP_URL } = require('../app-url');

const CALLBACK_PATH = '/api/integrations/google-ads/callback';

function configured() {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  );
}

/**
 * Exact redirect URI used for both authorize + token exchange.
 *
 * 1. GOOGLE_ADS_REDIRECT_URI when set (required in production Vercel)
 * 2. Otherwise APP_URL + callback path (or localhost when APP_URL unset off-prod)
 *
 * Preview must set its own GOOGLE_ADS_REDIRECT_URI / APP_URL — production
 * callback is not used unless those env vars explicitly point at production.
 */
function oauthRedirectUri() {
  const explicit = stripTrailingSlash(process.env.GOOGLE_ADS_REDIRECT_URI || '');
  if (explicit) return explicit;

  const base = appUrl();
  // Guard: if somehow misconfigured, still never invent Host-based URIs.
  if (!base) return LOCAL_APP_URL + CALLBACK_PATH;
  return base + CALLBACK_PATH;
}

function scopes() {
  return [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/adwords'
  ];
}

const {
  encryptionConfigured,
  encryptionKeyBytes,
  encryptionKeyDiagnostics,
  rawEncryptionKey
} = require('./encryption-key');

function apiVersion() {
  // v18–v19 are sunset (Google returns HTML 404). Prefer a current major.
  return process.env.GOOGLE_ADS_API_VERSION || 'v22';
}

function stateSecret() {
  return (
    process.env.GOOGLE_ADS_STATE_SECRET ||
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY ||
    process.env.GOOGLE_ADS_CLIENT_SECRET ||
    ''
  );
}

/** Raw env string (trimmed). Prefer encryptionKeyBytes() for crypto. */
function encryptionKey() {
  return rawEncryptionKey();
}

module.exports = {
  CALLBACK_PATH,
  PROD_APP_URL,
  LOCAL_APP_URL,
  configured,
  encryptionConfigured,
  encryptionKeyBytes,
  encryptionKeyDiagnostics,
  oauthRedirectUri,
  scopes,
  apiVersion,
  appUrl,
  clientId: () => process.env.GOOGLE_ADS_CLIENT_ID || '',
  clientSecret: () => process.env.GOOGLE_ADS_CLIENT_SECRET || '',
  developerToken: () => process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  loginCustomerId: () => (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, ''),
  stateSecret,
  encryptionKey
};
