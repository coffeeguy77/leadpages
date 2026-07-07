// app/sitemap.xml/route.js
// Per-tenant sitemap on custom domains: https://clientdomain.com.au/sitemap.xml

import { getSiteByDomain } from '../../lib/seo/store.js';
import { buildSiteSitemapEntries, buildSitemapXml, isPrimaryHost } from '../../lib/seo/sitemap.js';

export const dynamic = 'force-dynamic';

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
}

export async function GET(request) {
  const url = new URL(request.url);
  const host = url.host.toLowerCase().replace(/^www\./, '');

  if (isPrimaryHost(host)) return notFound();

  let site = null;
  try {
    site = await getSiteByDomain(host);
  } catch (e) {
    return new Response('error', { status: 500 });
  }

  if (!site || site.status !== 'live' || !site.slug) return notFound();

  const entries = buildSiteSitemapEntries({
    slug: site.slug,
    config: site.config,
    origin: url.origin,
    customDomain: site.customDomain || host,
  });

  if (!entries.length) return notFound();

  const generated = (site.config && site.config.sitemapGeneratedAt) || '';
  return new Response(buildSitemapXml(entries), {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      ...(generated ? { 'x-sitemap-generated': generated } : {}),
    },
  });
}
