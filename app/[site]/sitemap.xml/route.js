// app/[site]/sitemap.xml/route.js
// Per-tenant sitemap on the platform host: https://leadpages.com.au/{slug}/sitemap.xml

import { getSiteBySlug } from '../../../lib/seo/store.js';
import { buildSiteSitemapEntries, buildSitemapXml } from '../../../lib/seo/sitemap.js';

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
  const entries = buildSiteSitemapEntries({
    slug: site.slug,
    config: site.config,
    origin: url.origin,
    customDomain: site.customDomain,
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
