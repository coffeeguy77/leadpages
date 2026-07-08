// api/marketing-html.js — serve marketing .html with platform Google verification meta

const fs = require('fs');
const path = require('path');
const platformSeo = require('./platform-seo');

function safeHtmlFile(file) {
  const base = path.basename(String(file || ''));
  if (!/^[a-z0-9][a-z0-9-]*\.html$/i.test(base)) return null;
  return base;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'https://x');
    const file = safeHtmlFile(url.searchParams.get('file'));
    if (!file) {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('bad file');
    }

    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('Not found');
    }

    let html = fs.readFileSync(filePath, 'utf8');
    const cfg = await platformSeo.loadPlatformSeoConfig();
    html = platformSeo.injectGoogleMeta(html, cfg);

    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(html);
  } catch (e) {
    console.error('marketing-html error:', e && e.message);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('error');
  }
};
