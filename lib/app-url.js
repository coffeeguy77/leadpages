/**
 * Canonical application origin helpers.
 * Production app domain: https://app.leadpages.com.au
 *
 * Never derive the production origin from an untrusted request Host header.
 * Public marketing site (leadpages.com.au) is separate — do not use this for tenant/public pages.
 */

const PROD_APP_URL = 'https://app.leadpages.com.au';
const LOCAL_APP_URL = 'http://localhost:3000';

/** Fixed post-OAuth return paths (no open redirects). */
const ALLOWED_RETURN_PATHS = [
  '/settings/integrations/google-ads'
];

function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Application origin for the logged-in platform.
 * Priority: APP_URL → production default only when VERCEL_ENV=production → localhost.
 * Preview deployments must set APP_URL (or rely on localhost-style local) —
 * they must NOT silently inherit the production origin.
 */
function appUrl() {
  const fromEnv = stripTrailingSlash(process.env.APP_URL || '');
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === 'production') {
    return PROD_APP_URL;
  }

  // Preview / development: never fall back to production app domain.
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return 'https://' + String(process.env.VERCEL_URL).replace(/^https?:\/\//, '');
  }

  return LOCAL_APP_URL;
}

function isProductionApp() {
  return appUrl() === PROD_APP_URL;
}

/**
 * Build an absolute app URL for a path. Rejects absolute/external return targets.
 */
function appPath(path) {
  const p = String(path || '/');
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('://')) {
    return appUrl() + '/';
  }
  return appUrl() + p;
}

/**
 * Validate a return path against the allowlist. Always returns a safe relative path.
 */
function safeReturnPath(candidate) {
  const p = String(candidate || '').split('?')[0].split('#')[0];
  if (ALLOWED_RETURN_PATHS.indexOf(p) >= 0) return p;
  return ALLOWED_RETURN_PATHS[0];
}

function privacyUrl() {
  return 'https://leadpages.com.au/privacy';
}

function termsUrl() {
  return 'https://leadpages.com.au/terms';
}

module.exports = {
  PROD_APP_URL,
  LOCAL_APP_URL,
  ALLOWED_RETURN_PATHS,
  appUrl,
  appPath,
  isProductionApp,
  safeReturnPath,
  privacyUrl,
  termsUrl,
  stripTrailingSlash
};
