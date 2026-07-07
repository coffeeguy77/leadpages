// api/marketing-sitemap.xml.js — leadpages.com.au marketing sitemap

const platformSeo = require('./platform-seo');

module.exports = async (req, res) => {
  try {
    const cfg = await platformSeo.loadPlatformSeoConfig();
    const urls = (cfg.sitemapUrls && cfg.sitemapUrls.length)
      ? cfg.sitemapUrls
      : platformSeo.DEFAULT_SITEMAP_URLS;
    const xml = platformSeo.buildMarketingSitemapXml(urls, cfg.sitemapGeneratedAt);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    if (cfg.sitemapGeneratedAt) res.setHeader('x-sitemap-generated', cfg.sitemapGeneratedAt);
    res.end(xml);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('error');
  }
};
