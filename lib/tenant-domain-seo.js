/**
 * Custom-domain SEO isolation — keep platform admin/marketing URLs off tenant domains.
 */
const { isPrimaryHost, normalizeHost, resolvePrimaryHosts } = require('./render-hosts');

/** Paths that must never be served on a tenant custom domain (404 + noindex). */
const PLATFORM_ONLY_EXACT = new Set([
  '/manage',
  '/orders',
  '/command',
  '/admin',
  '/apps-admin',
  '/marketplace-admin',
  '/partners-admin',
  '/brain-admin',
  '/theme-studio',
  '/theme-studio-v2',
  '/theme-studio/colours',
  '/marketing-hub',
  '/billing',
  '/billing-admin',
  '/accounting',
  '/builder',
  '/offer',
  '/help',
  '/messages',
  '/partners',
  '/pricing',
  '/resources',
  '/marketplace',
  '/demos',
  '/showcase',
  '/start-your-business',
  '/find-a-partner',
  '/domains',
  '/tradies',
  '/quote',
  '/online-quote',
  '/quote-portal',
  '/application',
  '/partner-onboarding',
  '/manage-domains',
  '/lead-notify-style',
  '/ai-control',
  '/partner',
  '/partner-dashboard',
  '/seo-sitemap.xml',
  '/marketing-sitemap.xml',
]);

const PLATFORM_ONLY_PREFIXES = [
  '/manage/',
  '/marketplace-admin/',
  '/partners-admin/',
  '/apps-admin/',
  '/seo-sitemaps/',
  '/settings/integrations/',
];

/** Utility pages — stay reachable for SMS/deep links but excluded from crawl via robots.txt. */
const TENANT_UTILITY_NOINDEX = [
  '/order-portal',
  '/order-shop',
  '/order-print',
];

function isTenantCustomDomain(host, primaryHosts) {
  const h = normalizeHost(host);
  if (!h) return false;
  return !isPrimaryHost(h, primaryHosts);
}

function isPlatformOnlyPath(pathname) {
  const path = String(pathname || '').split('?')[0].split('#')[0].toLowerCase();
  if (!path || path === '/') return false;
  if (PLATFORM_ONLY_EXACT.has(path)) return true;
  for (let i = 0; i < PLATFORM_ONLY_PREFIXES.length; i++) {
    if (path.startsWith(PLATFORM_ONLY_PREFIXES[i])) return true;
  }
  // Slug-prefixed sitemaps on custom domains (e.g. /other-site/sitemap.xml) — not this tenant.
  if (path.endsWith('/sitemap.xml') && path !== '/sitemap.xml') return true;
  return false;
}

function tenantRobotsTxt(origin) {
  const base = String(origin || '').replace(/\/+$/, '');
  const lines = [
    '# Tenant site — platform admin and utility checkout pages are not indexed.',
    'User-agent: *',
    'Allow: /',
  ];
  PLATFORM_ONLY_EXACT.forEach(function (p) {
    lines.push('Disallow: ' + p);
  });
  PLATFORM_ONLY_PREFIXES.forEach(function (p) {
    lines.push('Disallow: ' + p);
  });
  TENANT_UTILITY_NOINDEX.forEach(function (p) {
    lines.push('Disallow: ' + p);
  });
  lines.push('');
  lines.push('Sitemap: ' + base + '/sitemap.xml');
  return lines.join('\n') + '\n';
}

function platformRobotsTxt() {
  return [
    '# LeadPages marketing + platform host (www.leadpages.com.au)',
    '# Admin consoles are intentionally disallowed — "Blocked by robots.txt" in',
    '# Search Console for /manage*, /marketplace-admin, /partners-admin is expected.',
    'User-agent: *',
    'Allow: /',
    'Disallow: /manage',
    'Disallow: /marketplace-admin',
    'Disallow: /partners-admin',
    '',
    '# Marketing pages',
    'Sitemap: https://www.leadpages.com.au/marketing-sitemap.xml',
    '# Live tenant index (/{slug}/sitemap.xml children)',
    'Sitemap: https://www.leadpages.com.au/seo-sitemap.xml',
    '',
  ].join('\n');
}

function originFromReq(req) {
  const host = normalizeHost(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  if (!host) return '';
  return proto + '://' + host;
}

module.exports = {
  PLATFORM_ONLY_EXACT,
  PLATFORM_ONLY_PREFIXES,
  TENANT_UTILITY_NOINDEX,
  isTenantCustomDomain,
  isPlatformOnlyPath,
  tenantRobotsTxt,
  platformRobotsTxt,
  originFromReq,
  isPrimaryHost,
  normalizeHost,
  resolvePrimaryHosts,
};
