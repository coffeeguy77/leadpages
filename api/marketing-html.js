// api/marketing-html.js — serve marketing .html with platform Google verification meta
// Used only for the marketing homepage rewrite. Reads static HTML from disk or fetches
// the deployed static asset (Vercel serverless cannot see repo-root .html by default).

const fs = require('fs');
const path = require('path');
const platformSeo = require('./platform-seo');

function safeHtmlFile(file) {
  const base = path.basename(String(file || ''));
  if (!/^[a-z0-9][a-z0-9-]*\.html$/i.test(base)) return null;
  return base;
}

async function loadHtmlFile(file, req) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return null;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const staticUrl = proto + '://' + host + '/' + file;
  const res = await fetch(staticUrl, { headers: { accept: 'text/html' } });
  if (!res.ok) return null;
  return res.text();
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

    let html = await loadHtmlFile(file, req);
    if (!html) {
      res.statusCode = 302;
      res.setHeader('location', '/' + file);
      return res.end();
    }

    try {
      const cfg = await platformSeo.loadPlatformSeoConfig();
      html = platformSeo.injectGoogleMeta(html, cfg);
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
