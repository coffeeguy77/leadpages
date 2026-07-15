// app/seo-sitemaps/[page]/route.js
// Child sitemap indexes when live site count exceeds one Google index file (~40k).
// Each page lists up to SITEMAP_INDEX_PAGE_SIZE tenant /{slug}/sitemap.xml locs.

import { listLiveSiteSlugs } from '../../../lib/seo/store.js';
import {
  buildSitemapIndexXml,
  SITEMAP_INDEX_PAGE_SIZE
} from '../../../lib/seo/sitemap.js';

export const dynamic = 'force-dynamic';

const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400'
};

export async function GET(request, ctx) {
  const params = (ctx && ctx.params) || {};
  const raw = params.page;
  const pageName = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(pageName || '').replace(/\.xml$/i, ''), 10);
  if (!n || n < 1) {
    return new Response('Not found', { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const pageSize = SITEMAP_INDEX_PAGE_SIZE;
  const offset = (n - 1) * pageSize;

  let batch;
  try {
    batch = await listLiveSiteSlugs({ offset: offset, limit: pageSize });
  } catch (e) {
    return new Response('<!-- sitemap error -->', {
      status: 500,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  if (!batch.slugs.length && offset >= batch.total) {
    return new Response('Not found', { status: 404 });
  }

  const locs = batch.slugs.map(function (slug) {
    return origin + '/' + encodeURIComponent(slug) + '/sitemap.xml';
  });
  return new Response(buildSitemapIndexXml(locs), { headers: XML_HEADERS });
}
