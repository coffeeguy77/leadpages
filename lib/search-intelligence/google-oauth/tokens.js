'use strict';

/**
 * Decrypt + refresh helpers for si_connections rows.
 */

const { encryptSecret, decryptSecret } = require('./crypto');
const { refreshAccessToken } = require('./oauth');

function prepareConnectionTokens(conn) {
  if (!conn) return conn;
  const out = Object.assign({}, conn);
  if (out.refresh_token) out.refresh_token = decryptSecret(out.refresh_token);
  if (out.access_token) out.access_token = decryptSecret(out.access_token);
  return out;
}

/**
 * Ensure connection has a usable access token. Persists refreshed token when admin provided.
 * @param {object} admin supabase service client
 * @param {object} conn si_connections row
 * @param {string} providerId search_console | ga4
 */
async function ensureAccessToken(admin, conn, providerId) {
  if (!conn) throw new Error('missing_connection');
  const provider = providerId || conn.provider;
  if (!provider) throw new Error('missing_provider');

  const live = prepareConnectionTokens(conn);
  if (!live.refresh_token) throw new Error('missing_refresh_token');

  const expires = live.token_expires_at ? new Date(live.token_expires_at).getTime() : 0;
  if (live.access_token && expires > Date.now() + 60 * 1000) {
    conn.access_token = live.access_token;
    conn.refresh_token = live.refresh_token;
    return live.access_token;
  }

  const tok = await refreshAccessToken(provider, live.refresh_token);
  const access = tok.access_token;
  const exp = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  if (admin && conn.site_id) {
    const { error } = await admin
      .from('si_connections')
      .update({
        access_token: encryptSecret(access),
        token_expires_at: exp,
        updated_at: new Date().toISOString()
      })
      .eq('site_id', conn.site_id)
      .eq('provider', provider);
    if (error) console.error('si ensureAccessToken persist:', error.message);
  }
  conn.access_token = access;
  conn.refresh_token = live.refresh_token;
  conn.token_expires_at = exp;
  return access;
}

module.exports = {
  prepareConnectionTokens: prepareConnectionTokens,
  ensureAccessToken: ensureAccessToken
};
