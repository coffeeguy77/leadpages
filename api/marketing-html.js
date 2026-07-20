// api/marketing-html.js — serve marketing .html with platform SEO head tags
// Rewrites on the marketing host inject Google verification, canonical, and og:url.
// Marketing HTML must be bundled via vercel.json includeFiles — do not fetch
// /home.html from the public URL (that path redirects to / and loops).

const fs = require('fs');
const path = require('path');
const platformSeo = require('./platform-seo');

function safeHtmlFile(file) {
  const base = path.basename(String(file || ''));
  if (!/^[a-z0-9][a-z0-9-]*\.html$/i.test(base)) return null;
  return base;
}

function readBundledHtml(file) {
  const candidates = [
    path.join(process.cwd(), file),
    path.join(__dirname, '..', file),
    path.join(__dirname, file)
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      if (fs.existsSync(candidates[i])) {
        return fs.readFileSync(candidates[i], 'utf8');
      }
    } catch (_e) {}
  }
  return null;
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

    let html = readBundledHtml(file);
    if (!html) {
      console.error('marketing-html missing bundled file:', file);
      res.statusCode = 503;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      return res.end('Marketing page temporarily unavailable');
    }

    try {
      const cfg = await platformSeo.loadPlatformSeoConfig();
      html = platformSeo.injectMarketingHead(html, cfg, {
        file: file,
        path: url.searchParams.get('path') || '',
      });
    } catch (seoErr) {
      console.error('marketing-html seo inject skipped:', seoErr && seoErr.message);
    }

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
