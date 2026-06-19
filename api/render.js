// api/render.js — serves a landing page from the database.
// Rewrite (vercel.json) maps /s/:slug → /api/render?slug=:slug.
// Fetches the site row, injects its config into the matching vertical template,
// and returns server-rendered HTML (so the business name etc. are in the source for SEO).

const { createClient } = require('@supabase/supabase-js');
const brokerTpl = require('../broker.template.json');
const tradeTpl  = require('../trade.template.json');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMPLATES = { broker: brokerTpl.html, trade: tradeTpl.html };

const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

function notFound(res) {
  res.status(404).setHeader('content-type', 'text/html; charset=utf-8');
  return res.send('<!doctype html><meta charset="utf-8"><title>Not found</title>' +
    '<body style="font-family:system-ui;text-align:center;padding:80px;color:#444">Page not found.</body>');
}

module.exports = async (req, res) => {
  try {
    const slug = (req.query && req.query.slug) || '';
    if (!slug) return notFound(res);

    const { data: site, error } = await supabase
      .from('sites').select('*').eq('slug', slug).single();

    if (error || !site || site.status !== 'live') return notFound(res);

    const tpl = TEMPLATES[site.vertical] || TEMPLATES.broker;
    const host = req.headers.host || '';

    // Build the SITE_CONFIG the page's JS expects: identity + the stored config blob.
    const cfg = Object.assign(
      { business: site.business_name, slug: site.slug, siteId: site.id },
      site.config || {}
    );
    if (site.vertical === 'trade' && !cfg.trade) cfg.trade = 'Plumber';

    // 1) inject the JS config object, 2) replace the server-side identity tokens
    let html = tpl.replaceAll('__SITE_CONFIG__', JSON.stringify(cfg));
    const tokens = {
      '{{businessName}}': esc(site.business_name),
      '{{phoneText}}':    esc(cfg.phoneText),
      '{{email}}':        esc(cfg.email),
      '{{phone}}':        esc(cfg.phone),
      '{{domain}}':       esc(host),
      '{{initial}}':      esc((site.business_name || 'B').trim().charAt(0).toUpperCase())
    };
    for (const [k, v] of Object.entries(tokens)) html = html.replaceAll(k, v);

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.status(200).send(html);
  } catch (e) {
    console.error('render error:', e);
    return res.status(500).send('Server error');
  }
};
