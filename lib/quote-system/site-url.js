/**
 * Online Quote System — public site URLs for email links.
 */

const DEFAULT_ORIGIN = String(
  process.env.PUBLIC_BASE_URL || process.env.BASE_URL || 'https://leadpages.com.au'
).replace(/\/$/, '');

function normalizeHost(domain) {
  return String(domain || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

function sitePublicUrl(site, options) {
  const opts = options || {};
  const slug = site && site.slug ? String(site.slug).trim().toLowerCase() : '';
  const custom = site && site.custom_domain ? normalizeHost(site.custom_domain) : '';
  let url = '';

  if (custom) {
    url = 'https://' + custom + '/';
  } else if (slug) {
    url = DEFAULT_ORIGIN + '/' + slug;
  }

  const hash = opts.hash || opts.anchor;
  if (url && hash) {
    url += '#' + String(hash).replace(/^#/, '');
  }

  return url;
}

function quoteWizardReturnUrl(site) {
  return sitePublicUrl(site, { hash: 'onlineQuote' });
}

module.exports = {
  DEFAULT_ORIGIN,
  normalizeHost,
  sitePublicUrl,
  quoteWizardReturnUrl
};
