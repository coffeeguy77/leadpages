/**
 * Shared Instagram Business Login helpers.
 *
 * Meta Valid OAuth Redirect URIs historically (and in docs) use the public
 * www host. APP_URL is the editor origin (app.leadpages.com.au) — do NOT use
 * it as the Instagram redirect_uri default or token exchange fails with a
 * redirect_uri mismatch.
 */

const DEFAULT_IG_REDIRECT = 'https://www.leadpages.com.au/api/instagram/callback';

function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Canonical Instagram OAuth redirect_uri.
 * Prefer INSTAGRAM_REDIRECT_URI when set; otherwise the Meta-registered www URL.
 */
function instagramRedirectUri() {
  const fromEnv = stripTrailingSlash(process.env.INSTAGRAM_REDIRECT_URI || '');
  if (fromEnv) return fromEnv;
  return DEFAULT_IG_REDIRECT;
}

module.exports = {
  DEFAULT_IG_REDIRECT,
  instagramRedirectUri,
  stripTrailingSlash
};
