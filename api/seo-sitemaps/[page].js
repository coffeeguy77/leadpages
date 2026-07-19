// api/seo-sitemaps/[page].js — sharded child sitemap indexes for live tenants

const {
  buildSitemapIndexXml,
  SITEMAP_INDEX_PAGE_SIZE,
} = require('../../lib/seo/sitemap.js');
const { listLiveSiteSlugs } = require('../../lib/seo/store.js');
const { PLATFORM_ORIGIN } = require('../platform-seo');

const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

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
    const url = new URL(req.url, 'https://x');
    const parts = url.pathname.split('/').filter(Boolean);
    const raw = parts[parts.length - 1] || '';
    const n = parseInt(String(raw).replace(/\.xml$/i, ''), 10);
    if (!n || n < 1) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('Not found');
    }

    const origin = originFromReq(req);
    const pageSize = SITEMAP_INDEX_PAGE_SIZE;
    const offset = (n - 1) * pageSize;

    let batch;
    try {
      batch = await listLiveSiteSlugs({ offset: offset, limit: pageSize });
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/xml; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      return res.end('<!-- sitemap error -->');
    }

    if (!batch.slugs.length && offset >= batch.total) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('Not found');
    }

    const locs = batch.slugs.map(function (slug) {
      return origin + '/' + encodeURIComponent(slug) + '/sitemap.xml';
    });

    res.statusCode = 200;
    Object.keys(XML_HEADERS).forEach(function (k) {
      res.setHeader(k, XML_HEADERS[k]);
    });
    res.end(buildSitemapIndexXml(locs));
  } catch (e) {
    console.error('seo-sitemaps page error:', e && e.message);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('error');
  }
};
