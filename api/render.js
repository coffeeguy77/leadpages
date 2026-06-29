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

// Send rendered HTML. Live sites are cached/CDN-friendly as before; non-live
// (draft) previews are never cached and never indexed.
function sendHtml(res, html, isLive) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (isLive) {
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=300');
  } else {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  return res.status(200).send(html);
}

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

function suspendedPage(res, site, tpl) {
  const biz = (site && site.business_name) ? String(site.business_name) : 'This website';
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const tok = (s) => esc(String(s == null ? '' : s)).replace(/\{\{\s*businessName\s*\}\}/g, esc(biz));
  const t = tpl && typeof tpl === 'object' ? tpl : {};
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(t.bg || '') ? t.bg : '#0f1620';
  const fg = /^#[0-9a-fA-F]{3,8}$/.test(t.fg || '') ? t.fg : '#e7edf5';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(t.accent || '') ? t.accent : '#ff6a1f';
  const heading = tok(t.heading || 'This website is temporarily unavailable');
  const message = tok(t.message || (esc(biz) + ' is paused while a billing matter is being resolved.'));
  const note = tok(t.note || 'If this is your website, please settle the outstanding hosting payment to restore it.');
  res.status(503);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('retry-after', '86400');
  return res.send('<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>' + esc(biz) + ' — unavailable</title>' +
    '<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:' + bg + ';color:' + fg + ';display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">' +
    '<div style="max-width:540px;text-align:center;">' +
    '<div style="font-size:46px;margin-bottom:14px;color:' + accent + ';">&#9888;&#65039;</div>' +
    '<h1 style="font-size:25px;margin:0 0 12px;line-height:1.2;">' + heading + '</h1>' +
    '<p style="font-size:16px;line-height:1.55;opacity:.92;margin:0 0 8px;">' + message + '</p>' +
    '<p style="font-size:14px;opacity:.7;margin:0;">' + note + '</p>' +
    '</div></body></html>');
}

module.exports = async (req, res) => {
  try {
    const rawHost = (req.headers.host || '').toLowerCase();
    const host = rawHost.replace(/^www\./, '');
    const slug = (req.query && req.query.slug) || '';
    let page = (req.query && req.query.page) || '';
    const isCustom = !!host && !PRIMARY_HOSTS.includes(host);

    // A "/" hit on the primary host (or with no host) is the marketing homepage,
    // not a tenant page. Bounce to the static index so we never shadow it.
    if (!slug && (!host || PRIMARY_HOSTS.includes(host))) {
      res.statusCode = 302;
      res.setHeader('location', '/index.html');
      return res.end();
    }

    // Resolve the tenant:
    //   - custom domain -> by Host header; any /:slug segment is a PAGE path.
    //   - primary host  -> by slug (the leadpages address); ?page is the optional sub-page.
    let site = null, error = null;
    if (isCustom) {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('custom_domain', host).maybeSingle());
      if (slug && !page) page = slug;
    } else if (slug) {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('slug', slug).single());
    } else {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('custom_domain', host).maybeSingle());
    }

    if (error || !site) return notFound(res);
    const isPreview = !!(req.query && req.query.preview);
    const isLive = site.status === 'live';
    // Non-live sites (e.g. partner drafts) are hidden from the public: a clean URL
    // 404s. The builder can still preview them via ?preview=, and those responses
    // are never cached or indexed (see sendHtml).
    if (!isLive && !isPreview) return notFound(res);
    if (isLive && (site.billing_status === 'suspended' || site.billing_status === 'flagged_deletion')) {
      const key = site.is_system ? 'suspended_system' : (site.is_demo ? 'suspended_demo' : 'suspended_client');
      let tpl = null;
      try { const r = await supabase.from('system_pages').select('content').eq('key', key).maybeSingle(); tpl = r.data && r.data.content; } catch (e) { tpl = null; }
      return suspendedPage(res, site, tpl);
    }

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
      return sendHtml(res, html, isLive);
    }

    // ---- token templates: broker-leads / trade ----
    const tpl = TOKEN_TEMPLATES[template] || TOKEN_TEMPLATES['broker-leads'];

    const cfg = Object.assign(
      { business: site.business_name, slug: site.slug, siteId: site.id },
      site.config || {}
    );
    if (template === 'trade' && !cfg.trade) cfg.trade = '';

    // Sub-page routing: /:site/:page (or /:page on a custom domain) must resolve to a
    // PUBLISHED landing page in the config; otherwise it's a hard 404 (no soft-404s).
    let _pageRow = null;
    if (page) {
      const _pages = Array.isArray(cfg.pages) ? cfg.pages : [];
      _pageRow = _pages.find(p => p && p.slug === page && p.status === 'published') || null;
      if (!_pageRow) return notFound(res);
    }

    // ---- SEO title/description (per-tenant, graceful, never plumber-specific) ----
    // Driven by business name + the site's own trade/service type, with optional
    // cfg.seoTitle / cfg.seoDescription overrides. Works for trades, services and
    // business types alike (cafe, accommodation, etc.).
    const _biz   = (cfg.business || site.business_name || '').trim();
    const _trade = (cfg.trade || '').trim();
    let pageTitle = (cfg.seoTitle || '').trim()
      || (_trade ? `${_biz} — ${_trade} in Canberra & the ACT`
                 : `${_biz} — Canberra & the ACT`);
    let pageDesc = (cfg.seoDescription || '').trim()
      || (_trade ? `${_biz} — licensed, local ${_trade.toLowerCase()} across Canberra and the ACT. Fast, free quotes. Get in touch today.`
                 : `${_biz} — trusted local service across Canberra and the ACT. Fast, free quotes. Get in touch today.`);

    // A landing page supplies its own SEO title/description.
    if (_pageRow) {
      if (_pageRow.title) pageTitle = `${_pageRow.title}${_biz ? ' \u2014 ' + _biz : ''}`;
      if (_pageRow.meta)  pageDesc  = _pageRow.meta;
    }

    let html = tpl.replaceAll('__SITE_CONFIG__', safeJson(cfg));
    const tokens = {
      '{{businessName}}': esc(site.business_name),
      '{{phoneText}}':    esc(cfg.phoneText),
      '{{email}}':        esc(cfg.email),
      '{{phone}}':        esc(cfg.phone),
      '{{domain}}':       esc(host),
      '{{initial}}':      esc((site.business_name || 'B').trim().charAt(0).toUpperCase()),
      '{{trade}}':        esc(_trade),
      '{{pageTitle}}':    esc(pageTitle),
      '{{pageDesc}}':     esc(pageDesc)
    };
    for (const [k, v] of Object.entries(tokens)) html = html.replaceAll(k, v);

    return sendHtml(res, html, isLive);
  } catch (e) {
    console.error('render error:', e);
    return res.status(500).send('Server error');
  }
};
