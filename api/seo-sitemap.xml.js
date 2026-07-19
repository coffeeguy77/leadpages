// api/seo-sitemap.xml.js — platform sitemap INDEX for Search Console
// Mirrors app/seo-sitemap.xml/route.js for the Vercel serverless deployment
// (App Router is not shipped). Points at each live tenant's /{slug}/sitemap.xml.

const {
  buildSitemapIndexXml,
  sitemapIndexPlan,
  SITEMAP_INDEX_PAGE_SIZE,
} = require('../lib/seo/sitemap.js');
const { listLiveSiteSlugs } = require('../lib/seo/store.js');
const { PLATFORM_ORIGIN } = require('./platform-seo');

const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
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

function originFromReq(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (/^(www\.)?leadpages\.(com\.au|webculture\.au)$/.test(host)) {
    return PLATFORM_ORIGIN;
  }
  if (host) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    return proto + '://' + host.replace(/:\d+$/, '');
  }
  return PLATFORM_ORIGIN;
}

module.exports = async (req, res) => {
  try {
    const origin = originFromReq(req);
    let data;
    try {
      data = await collectAllLiveSlugs();
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/xml; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      return res.end('<!-- sitemap error: ' + String((e && e.message) || e) + ' -->');
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

    res.statusCode = 200;
    Object.keys(XML_HEADERS).forEach(function (k) {
      res.setHeader(k, XML_HEADERS[k]);
    });
    res.end(buildSitemapIndexXml(locs));
  } catch (e) {
    console.error('seo-sitemap error:', e && e.message);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('error');
  }
};
