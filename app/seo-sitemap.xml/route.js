// app/seo-sitemap.xml/route.js
// Lists every tenant x service-area suburb page so Google can discover them.
// Submit https://YOUR-DOMAIN/seo-sitemap.xml in Search Console, and add it to robots.txt.

import { listSites } from '../../lib/seo/store.js';
import { serviceAreas, slugify } from '../../lib/seo/tokens.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = new URL(request.url).origin;
  let sites = [];
  try { sites = await listSites(); } catch (e) { return new Response('error', { status: 500 }); }

  const urls = [];
  for (const s of sites) {
    if (!s.slug) continue;
    for (const a of serviceAreas(s.config)) {
      urls.push(origin + '/' + s.slug + '/' + slugify(a));
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + u.replace(/&/g, '&amp;') + '</loc><changefreq>weekly</changefreq></url>').join('\n') +
    '\n</urlset>';

  return new Response(body, {
    headers: { 'content-type': 'application/xml', 'cache-control': 'public, s-maxage=86400' },
  });
}
