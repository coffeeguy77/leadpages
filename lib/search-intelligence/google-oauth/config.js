'use strict';

/**
 * Shared Google OAuth provider descriptors for Search Intelligence connectors.
 * Full token exchange lands when env + si_connections are production-ready.
 */

const { appUrl } = require('../../app-url');

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
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/analytics.readonly'
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

function oauthRedirectUri(providerId) {
  const p = getProvider(providerId);
  if (!p) return null;
  const explicit = String(process.env[p.redirectEnv] || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const base = appUrl();
  return base + p.callbackPath;
}

/**
 * Connection status for Command Centre / settings (no live token exchange yet).
 */
function connectionStatus(providerId, row) {
  const p = getProvider(providerId);
  const platformConfigured = configured(providerId);
  if (row && row.connection_status === 'connected' && row.enabled !== false) {
    return {
      provider: providerId,
      label: p && p.label,
      status: 'connected',
      platformConfigured: true,
      propertyId: row.property_id || null,
      lastSyncAt: row.last_sync_at || null,
      connectPath: p && p.returnPath,
      oauthReady: false
    };
  }
  return {
    provider: providerId,
    label: p && p.label,
    status: platformConfigured ? 'ready_to_connect' : 'not_configured',
    platformConfigured: platformConfigured,
    propertyId: null,
    lastSyncAt: null,
    connectPath: p && p.returnPath,
    oauthReady: false,
    hint: platformConfigured
      ? 'Platform credentials are set. OAuth exchange ships next — use this page to prepare the site mapping.'
      : 'Set ' + (p ? p.clientIdEnv + ' / ' + p.clientSecretEnv : 'client id/secret') + ' on the platform, then redeploy.'
  };
}

module.exports = {
  PROVIDERS: PROVIDERS,
  getProvider: getProvider,
  configured: configured,
  oauthRedirectUri: oauthRedirectUri,
  connectionStatus: connectionStatus
};
