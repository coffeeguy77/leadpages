// app/sitemap.xml/route.js
// Per-tenant sitemap on custom domains: https://clientdomain.com.au/sitemap.xml

import { getSiteByDomain } from '../../lib/seo/store.js';
import { buildSiteSitemapUrls, buildSitemapXml, isPrimaryHost } from '../../lib/seo/sitemap.js';

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

  const urls = buildSiteSitemapUrls({
    slug: site.slug,
    config: site.config,
    origin: url.origin,
    customDomain: site.customDomain || host,
  });

  if (!urls.length) return notFound();

  return new Response(buildSitemapXml(urls), {
    headers: { 'content-type': 'application/xml', 'cache-control': 'public, s-maxage=86400' },
  });
}
