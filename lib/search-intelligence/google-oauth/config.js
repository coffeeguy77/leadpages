'use strict';

/**
 * Shared Google OAuth provider descriptors for Search Intelligence connectors.
 */

const { appUrl } = require('../../app-url');
const { encryptionConfigured } = require('./crypto');

const PROVIDERS = Object.freeze({
  search_console: Object.freeze({
    id: 'search_console',
    label: 'Google Search Console',
    clientIdEnv: 'GSC_CLIENT_ID',
    clientSecretEnv: 'GSC_CLIENT_SECRET',
    redirectEnv: 'GSC_REDIRECT_URI',
    callbackPath: '/api/integrations/search-console/callback',
    returnPath: '/settings/integrations/search-console',
    statusPath: '/api/integrations/search-console/status',
    connectPath: '/api/integrations/search-console/connect',
    exchangePath: '/api/integrations/search-console/exchange',
    flashKey: 'gsc',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/webmasters.readonly'
    ]
  }),
  ga4: Object.freeze({
    id: 'ga4',
    label: 'Google Analytics 4',
    clientIdEnv: 'GA4_CLIENT_ID',
    clientSecretEnv: 'GA4_CLIENT_SECRET',
    redirectEnv: 'GA4_REDIRECT_URI',
    callbackPath: '/api/integrations/google-analytics/callback',
    returnPath: '/settings/integrations/google-analytics',
    statusPath: '/api/integrations/google-analytics/status',
    connectPath: '/api/integrations/google-analytics/connect',
    exchangePath: '/api/integrations/google-analytics/exchange',
    flashKey: 'ga4',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/analytics.readonly'
    ]
  }),
  gbp: Object.freeze({
    id: 'gbp',
    label: 'Google Business Profile',
    clientIdEnv: 'GBP_CLIENT_ID',
    clientSecretEnv: 'GBP_CLIENT_SECRET',
    redirectEnv: 'GBP_REDIRECT_URI',
    callbackPath: '/api/integrations/google-business/callback',
    returnPath: '/settings/integrations/google-business',
    statusPath: '/api/integrations/google-business/status',
    connectPath: '/api/integrations/google-business/connect',
    exchangePath: '/api/integrations/google-business/exchange',
    flashKey: 'gbp',
    // Business Profile scopes — live sync requires Google API access approval.
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/business.manage'
    ]
  })
});

function getProvider(id) {
  return PROVIDERS[id] || null;
}

function configured(providerId) {
  const p = getProvider(providerId);
  if (!p) return false;
  return !!(process.env[p.clientIdEnv] && process.env[p.clientSecretEnv]);
}

function oauthReady(providerId) {
  return configured(providerId) && encryptionConfigured();
}

function oauthRedirectUri(providerId) {
  const p = getProvider(providerId);
  if (!p) return null;
  const explicit = String(process.env[p.redirectEnv] || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  return appUrl() + p.callbackPath;
}

/**
 * Connection status for Command Centre / settings (tokens never included).
 */
function connectionStatus(providerId, row) {
  const p = getProvider(providerId);
  const platformConfigured = configured(providerId);
  const ready = oauthReady(providerId);
  if (row && row.connection_status === 'connected' && row.enabled !== false) {
    return {
      provider: providerId,
      label: p && p.label,
      status: 'connected',
      platformConfigured: true,
      oauthReady: ready,
      encryptionConfigured: encryptionConfigured(),
      propertyId: row.property_id || null,
      googleAccountEmail: row.google_account_email || null,
      lastSyncAt: row.last_sync_at || null,
      lastSyncError: row.last_sync_error || null,
      connectPath: p && p.returnPath,
      hint: row.property_id
        ? providerId === 'search_console'
          ? 'Property selected. Use Sync to refresh query×page stats.'
          : providerId === 'gbp'
            ? 'Location selected. Live GBP performance sync lands when Google API access is approved.'
            : 'Property selected. Use Sync to refresh landing-page sessions.'
        : providerId === 'gbp'
          ? 'Connected — select a Business Profile location when location list ships with API access.'
          : 'Connected — select a property on this settings page.'
    };
  }
  return {
    provider: providerId,
    label: p && p.label,
    status: platformConfigured ? (ready ? 'ready_to_connect' : 'encryption_required') : 'not_configured',
    platformConfigured: platformConfigured,
    oauthReady: ready,
    encryptionConfigured: encryptionConfigured(),
    propertyId: null,
    googleAccountEmail: null,
    lastSyncAt: null,
    lastSyncError: null,
    connectPath: p && p.returnPath,
    hint: !platformConfigured
      ? 'Set ' + (p ? p.clientIdEnv + ' / ' + p.clientSecretEnv : 'client id/secret') + ' on the platform, then redeploy.'
      : !ready
        ? 'Set SI_OAUTH_ENCRYPTION_KEY (or GOOGLE_ADS_OAUTH_ENCRYPTION_KEY), then redeploy.'
        : 'Click Connect to authorize with Google. Apply db/search_intelligence_schema.sql if connect fails on state reserve.'
  };
}

module.exports = {
  PROVIDERS: PROVIDERS,
  getProvider: getProvider,
  configured: configured,
  oauthReady: oauthReady,
  oauthRedirectUri: oauthRedirectUri,
  connectionStatus: connectionStatus,
  encryptionConfigured: encryptionConfigured
};
