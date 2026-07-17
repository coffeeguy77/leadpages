/** Platform Google Ads env configuration. */

function configured() {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  );
}

function oauthRedirectUri() {
  return (
    process.env.GOOGLE_ADS_REDIRECT_URI ||
    'https://www.leadpages.com.au/api/google-ads/callback'
  );
}

function scopes() {
  // adwords scope covers Google Ads API access for the connected user
  return ['https://www.googleapis.com/auth/adwords'];
}

function apiVersion() {
  return process.env.GOOGLE_ADS_API_VERSION || 'v18';
}

module.exports = {
  configured,
  oauthRedirectUri,
  scopes,
  apiVersion,
  clientId: () => process.env.GOOGLE_ADS_CLIENT_ID || '',
  clientSecret: () => process.env.GOOGLE_ADS_CLIENT_SECRET || '',
  developerToken: () => process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  loginCustomerId: () => (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, ''),
  stateSecret: () =>
    process.env.GOOGLE_ADS_STATE_SECRET ||
    process.env.GOOGLE_ADS_CLIENT_SECRET ||
    ''
};
