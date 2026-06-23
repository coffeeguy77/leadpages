// api/render.js — serves a tenant page from the database.
// Rewrite (vercel.json) maps:
//   • /s/:slug  → /api/render?slug=:slug              (your leadpages address)
//   • /         → /api/render   (on a CUSTOM domain)  (the client's own domain)
//
// Resolution:
//   • If a ?slug is present, look the site up by slug (unchanged behaviour).
//   • Otherwise this is a custom-domain hit at "/"; look the site up by its
//     `custom_domain` (the request Host header, lower-cased, www. stripped).
//   • The primary marketing host never serves a tenant page from "/", so it's
//     bounced to the static homepage — the homepage is never touched by this fn.
//
// Routing is by the site's `template`:
//   • 'broker-app'   → the full calculator mini-site.
//   • 'trade'        → the trade landing page (token template).
//   • 'broker-leads' → the broker landing page (token template).  [default for broker]

const { createClient } = require('@supabase/supabase-js');
const brokerTpl   = require('../broker.template.json');     // broker-leads
const tradeTpl    = require('../trade.template.json');      // trade
const brokerApp   = require('../brokerapp.template.json');  // broker-app (calculator suite)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The marketing/admin host. "/" on this host is the homepage, never a tenant page.
const PRIMARY_HOSTS = (process.env.PRIMARY_HOSTS || 'leadpages.webculture.au,leadpages.com.au')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// token templates (server-side identity injection)
const TOKEN_TEMPLATES = { 'broker-leads': brokerTpl.html, 'trade': tradeTpl.html };

const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

// safe JSON for embedding inside a <script> tag (prevents </script> breakout)
const safeJson = obj => JSON.stringify(obj || {}).replace(/</g, '\\u003c');

// Demo bar markup (only injected on the demo site). One button per enabled theme,
// labelled with the client's name; the calculator wires them up client-side.
function demoBarHtml(themes) {
  const btns = (themes || []).map((t, i) =>
    `<button type="button" class="lp-demobtn" data-lp-theme="${i}">${esc(t.name)}</button>`
  ).join('');
  return '<div id="demo-bar" class="lp-demobar">' +
    '<span class="lp-demolabel">See this calculator in your brand:</span>' +
    '<button type="button" class="lp-demobtn" data-lp-default="1" aria-pressed="true">Default</button>' +
    btns +
    '<span class="lp-demohint">Live preview \u00b7 nothing is saved</span>' +
    '</div>';
}

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
    const rawHost = (req.headers.host || '').toLowerCase();
    const host = rawHost.replace(/^www\./, '');
    const slug = (req.query && req.query.slug) || '';

    // A "/" hit on the primary host (or with no host) is the marketing homepage,
    // not a tenant page. Bounce to the static index so we never shadow it.
    if (!slug && (!host || PRIMARY_HOSTS.includes(host))) {
      res.statusCode = 302;
      res.setHeader('location', '/index.html');
      return res.end();
    }

    // Resolve the tenant: by slug (leadpages address) or by custom domain (host).
    let site = null, error = null;
    if (slug) {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('slug', slug).single());
    } else {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('custom_domain', host).maybeSingle());
    }

    if (error || !site || site.status !== 'live') return notFound(res);

    const template = templateFor(site);

    // ---- broker-app: full calculator mini-site, config-driven ----
    if (template === 'broker-app') {
      const cfg = Object.assign({}, site.config || {});
      cfg.business = cfg.business || site.business_name;
      cfg.slug     = site.slug;
      cfg.siteId   = site.id;

      let demoBar = '';
      if (site.slug === 'demo' || cfg.demo) {
        let themes = [];
        try {
          const r = await supabase.from('demo_themes')
            .select('id,name,label,appearance')
            .eq('enabled', true)
            .order('sort', { ascending: true });
          themes = r.data || [];
        } catch (e) { themes = []; }
        cfg.demo = true;
        cfg.demoThemes = themes;
        demoBar = demoBarHtml(themes);
      }

      let html = brokerApp.html.replaceAll('__BROKERAPP_CONFIG__', safeJson(cfg));
      html = html.replaceAll('<!--DEMO_BAR-->', demoBar);
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
