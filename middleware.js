/**
 * Block platform-only HTML routes on tenant custom domains (404 + noindex).
 */
const PRIMARY_HOSTS = new Set([
  'app.leadpages.com.au',
  'leadpages.com.au',
  'www.leadpages.com.au',
  'leadpages.webculture.au',
  'www.leadpages.webculture.au',
]);

const PLATFORM_ONLY_EXACT = new Set([
  '/manage', '/orders', '/command', '/admin', '/apps-admin', '/marketplace-admin',
  '/partners-admin', '/brain-admin', '/theme-studio', '/theme-studio-v2',
  '/theme-studio/colours', '/marketing-hub', '/billing', '/billing-admin', '/accounting',
  '/builder', '/offer', '/help', '/messages', '/partners', '/pricing', '/resources',
  '/marketplace', '/demos', '/showcase', '/start-your-business', '/find-a-partner',
  '/domains', '/tradies', '/quote', '/online-quote', '/quote-portal', '/application',
  '/partner-onboarding', '/manage-domains', '/lead-notify-style', '/ai-control',
  '/partner', '/partner-dashboard', '/seo-sitemap.xml', '/marketing-sitemap.xml',
]);

const PLATFORM_ONLY_PREFIXES = [
  '/manage/', '/marketplace-admin/', '/partners-admin/', '/apps-admin/',
  '/seo-sitemaps/', '/settings/integrations/',
];

function normalizeHost(host) {
  return String(host || '').split(':')[0].trim().toLowerCase();
}

function isPrimaryHost(host) {
  const h = normalizeHost(host);
  if (!h) return true;
  return PRIMARY_HOSTS.has(h);
}

function isPlatformOnlyPath(pathname) {
  const path = String(pathname || '').split('?')[0].split('#')[0].toLowerCase();
  if (!path || path === '/') return false;
  if (PLATFORM_ONLY_EXACT.has(path)) return true;
  for (let i = 0; i < PLATFORM_ONLY_PREFIXES.length; i++) {
    if (path.startsWith(PLATFORM_ONLY_PREFIXES[i])) return true;
  }
  if (path.endsWith('/sitemap.xml') && path !== '/sitemap.xml') return true;
  return false;
}

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  if (isPrimaryHost(host)) return;

  const path = new URL(request.url).pathname;
  if (!isPlatformOnlyPath(path)) return;

  return new Response('Not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: [
    '/manage',
    '/manage/:path*',
    '/orders',
    '/orders/:path*',
    '/command',
    '/command/:path*',
    '/admin',
    '/admin/:path*',
    '/apps-admin',
    '/apps-admin/:path*',
    '/marketplace-admin',
    '/marketplace-admin/:path*',
    '/partners-admin',
    '/partners-admin/:path*',
    '/brain-admin',
    '/brain-admin/:path*',
    '/theme-studio',
    '/theme-studio/:path*',
    '/marketing-hub',
    '/marketing-hub/:path*',
    '/billing',
    '/billing/:path*',
    '/billing-admin',
    '/billing-admin/:path*',
    '/builder',
    '/builder/:path*',
    '/offer',
    '/help',
    '/messages',
    '/partners',
    '/partners/:path*',
    '/pricing',
    '/resources',
    '/resources/:path*',
    '/marketplace',
    '/marketplace/:path*',
    '/demos',
    '/demos/:path*',
    '/showcase',
    '/start-your-business',
    '/find-a-partner',
    '/domains',
    '/tradies',
    '/quote',
    '/online-quote',
    '/quote-portal',
    '/application',
    '/application/:path*',
    '/partner-onboarding',
    '/manage-domains',
    '/lead-notify-style',
    '/ai-control',
    '/partner',
    '/partner/:path*',
    '/accounting',
    '/seo-sitemap.xml',
    '/marketing-sitemap.xml',
    '/seo-sitemaps/:path*',
    '/settings/integrations/:path*',
    '/:slug/sitemap.xml',
  ],
};
