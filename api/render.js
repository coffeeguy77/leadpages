// api/render.js — serves a tenant page from the database.
// Rewrite (vercel.json) maps /s/:slug → /api/render?slug=:slug.
//
// Routing is by the site's `template`:
//   • 'broker-app'   → the full calculator mini-site. Renders home-loan-calculators
//                      with window.BROKERAPP_CONFIG injected from the site's config.
//   • 'trade'        → the trade landing page (token template).
//   • 'broker-leads' → the broker landing page (token template).  [default for broker]
// Falls back to a sensible default from `vertical` when `template` is null, so existing
// rows keep working without a backfill.

const { createClient } = require('@supabase/supabase-js');
const brokerTpl   = require('../broker.template.json');     // broker-leads
const tradeTpl    = require('../trade.template.json');      // trade
const brokerApp   = require('../brokerapp.template.json');  // broker-app (calculator suite)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// token templates (server-side identity injection)
const TOKEN_TEMPLATES = { 'broker-leads': brokerTpl.html, 'trade': tradeTpl.html };

const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

// safe JSON for embedding inside a <script> tag (prevents </script> breakout)
const safeJson = obj => JSON.stringify(obj || {}).replace(/</g, '\\u003c');

function templateFor(site) {
  if (site.template) return site.template;
  return site.vertical === 'trade' ? 'trade' : 'broker-leads';
}

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

    const template = templateFor(site);
    const host = req.headers.host || '';

    // ---- broker-app: full calculator mini-site, config-driven ----
    if (template === 'broker-app') {
      // The page renders entirely from window.BROKERAPP_CONFIG (calculators, logo,
      // brokers, pages, theme, and optional rate overrides). Identity is folded in
      // so the calculators' enquiry posts land under this business in the dashboard.
      const cfg = Object.assign({}, site.config || {});
      cfg.business = cfg.business || site.business_name;
      cfg.slug     = site.slug;
      cfg.siteId   = site.id;

      const html = brokerApp.html.replaceAll('__BROKERAPP_CONFIG__', safeJson(cfg));
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=300');
      return res.status(200).send(html);
    }

    // ---- token templates: broker-leads / trade ----
    const tpl = TOKEN_TEMPLATES[template] || TOKEN_TEMPLATES['broker-leads'];

    const cfg = Object.assign(
      { business: site.business_name, slug: site.slug, siteId: site.id },
      site.config || {}
    );
    if (template === 'trade' && !cfg.trade) cfg.trade = 'Plumber';

    let html = tpl.replaceAll('__SITE_CONFIG__', safeJson(cfg));
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
