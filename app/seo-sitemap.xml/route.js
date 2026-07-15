// app/seo-sitemap.xml/route.js
// Platform sitemap INDEX for Search Console.
// Points at each live tenant's existing /{slug}/sitemap.xml (home + suburbs + landing pages)
// instead of loading every site's full config into one giant urlset.

import { listLiveSiteSlugs } from '../../lib/seo/store.js';
import {
  buildSitemapIndexXml,
  sitemapIndexPlan,
  SITEMAP_INDEX_PAGE_SIZE
} from '../../lib/seo/sitemap.js';

export const dynamic = 'force-dynamic';

const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400'
};

async function collectAllLiveSlugs() {
  const page = 1000;
  let offset = 0;
  let total = Infinity;
  const slugs = [];
  while (offset < total && slugs.length < 500000) {
    const batch = await listLiveSiteSlugs({ offset: offset, limit: page });
    total = batch.total;
    if (!batch.slugs.length) break;
    slugs.push.apply(slugs, batch.slugs);
    offset += batch.slugs.length;
    if (batch.slugs.length < page) break;
  }
  return { slugs: slugs, total: total === Infinity ? slugs.length : total };
}

export async function GET(request) {
  const origin = new URL(request.url).origin;
  let data;
  try {
    data = await collectAllLiveSlugs();
  } catch (e) {
    return new Response('<!-- sitemap error: ' + String(e && e.message || e) + ' -->', {
      status: 500,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const plan = sitemapIndexPlan(data.total, SITEMAP_INDEX_PAGE_SIZE);
  let locs;

  if (plan.mode === 'sharded') {
    locs = [];
    for (let i = 1; i <= plan.pages; i++) {
      locs.push(origin + '/seo-sitemaps/' + i + '.xml');
    }
  } else {
    locs = data.slugs.map(function (slug) {
      return origin + '/' + encodeURIComponent(slug) + '/sitemap.xml';
    });
  }

  const body = buildSitemapIndexXml(locs);
  return new Response(body, { headers: XML_HEADERS });
}
