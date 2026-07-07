// app/[site]/sitemap.xml/route.js
// Per-tenant sitemap on the platform host: https://leadpages.com.au/{slug}/sitemap.xml

import { getSiteBySlug } from '../../../lib/seo/store.js';
import { buildSiteSitemapUrls, buildSitemapXml } from '../../../lib/seo/sitemap.js';

export const dynamic = 'force-dynamic';

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
}

export async function GET(request, ctx) {
  const params = await ctx.params;
  const siteSlug = params.site;
  if (!siteSlug) return notFound();

  let site = null;
  try {
    site = await getSiteBySlug(siteSlug);
  } catch (e) {
    return new Response('error', { status: 500 });
  }

  if (!site || site.status !== 'live') return notFound();

  const url = new URL(request.url);
  const urls = buildSiteSitemapUrls({
    slug: site.slug,
    config: site.config,
    origin: url.origin,
    customDomain: site.customDomain,
  });

  if (!urls.length) return notFound();

  return new Response(buildSitemapXml(urls), {
    headers: { 'content-type': 'application/xml', 'cache-control': 'public, s-maxage=86400' },
  });
}
