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
const crypto = require('crypto');
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

// ---- Partner showcase (a per-partner homepage on <slug>.leadpages.com.au) -----
const SHOWCASE_SUFFIXES = (process.env.SHOWCASE_BASES || 'leadpages.com.au,leadpages.webculture.au')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function showcaseSlugFromHost(host) {
  for (const base of SHOWCASE_SUFFIXES) {
    if (host.endsWith('.' + base)) {
      const label = host.slice(0, host.length - ('.' + base).length);
      if (label && label !== 'www' && label.indexOf('.') < 0) return { slug: label, base };
    }
  }
  return null;
}
function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function scPasswordHtml(slug, partner, tried) {
  const who = esc(partner.display_name || 'This partner');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>' + who + ' — protected</title>' +
    '<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#15191e;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">' +
    '<form method="get" action="/" style="max-width:380px;width:100%;text-align:center">' +
    '<div style="font-size:34px;margin-bottom:10px">&#128274;</div>' +
    '<h1 style="font-family:Archivo,sans-serif;font-size:24px;margin:0 0 6px">Protected portfolio</h1>' +
    '<p style="opacity:.75;margin:0 0 18px">Enter the password ' + who + ' shared with you.</p>' +
    (tried ? '<p style="color:#ff8a65;margin:0 0 12px;font-size:14px">That password didn\u2019t match. Try again.</p>' : '') +
    '<input name="pw" type="password" autofocus placeholder="Password" style="width:100%;padding:13px 15px;border-radius:11px;border:0;font-size:16px;margin-bottom:12px">' +
    '<button type="submit" style="width:100%;padding:13px;border-radius:11px;border:0;background:#ff6a1a;color:#fff;font-weight:700;font-size:16px;cursor:pointer">View portfolio</button>' +
    '</form></body></html>';
}
function scCard(demo, base) {
  const cfg = demo.config || {};
  const trade = esc((cfg.trade || '').toString());
  const url = 'https://' + base + '/' + encodeURIComponent(demo.slug) + '?preview=1';
  return '<a class="sc-card" href="' + url + '" target="_blank" rel="noopener">' +
    '<div class="sc-card-top">' + (trade ? '<span class="sc-trade">' + trade + '</span>' : '') + '</div>' +
    '<div class="sc-card-body"><div class="sc-name">' + esc(demo.business_name || demo.slug) + '</div>' +
    '<div class="sc-view">View demo &rarr;</div></div></a>';
}
function showcaseHtml(prof, partner, demos, base) {
  const cfg = prof.showcase_config || {};
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(cfg.accent || '') ? cfg.accent : '#ff6a1a';
  const name = esc(partner.display_name || 'Local Web Partner');
  const headline = esc(prof.showcase_headline || (partner.display_name ? (partner.display_name + ' — websites that make the phone ring') : 'Websites that make the phone ring'));
  const intro = esc(cfg.intro || 'Professional, mobile-friendly websites for local businesses — built fast, with lead forms and local support. Take a look at some recent designs below.');
  const logo = cfg.logo ? ('<img src="' + esc(cfg.logo) + '" alt="' + name + '" class="sc-logo">') : ('<span class="sc-logo-text">' + name + '</span>');
  const email = prof.support_email ? esc(prof.support_email) : '';
  const phone = prof.support_phone ? esc(prof.support_phone) : '';
  const contact = (email || phone)
    ? '<div class="sc-contact">' + (email ? '<a class="sc-btn" href="mailto:' + email + '">Email ' + name + '</a>' : '') + (phone ? '<a class="sc-btn ghost" href="tel:' + phone.replace(/[^+0-9]/g, '') + '">' + phone + '</a>' : '') + '</div>'
    : '';
  const grid = demos.length
    ? '<div class="sc-grid">' + demos.map(d => scCard(d, base)).join('') + '</div>'
    : '<p class="sc-empty">New designs coming soon.</p>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + name + ' — Local business websites</title>' +
    '<meta name="description" content="' + intro + '">' +
    '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' +
    ':root{--accent:' + accent + ';--ink:#15191e;--steel:#5b6571;--line:#e3e5e9;--paper:#fff;--hi:#f4f6f8}' +
    '*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);line-height:1.55}' +
    'h1,h2,h3{font-family:Archivo,sans-serif;font-weight:900;letter-spacing:-.02em;margin:0}a{color:inherit}' +
    '.wrap{max-width:1080px;margin:0 auto;padding:0 22px}' +
    '.sc-head{background:radial-gradient(120% 120% at 80% -10%,#1e242c,#15191e);color:#fff;padding:30px 0 64px}' +
    '.sc-nav{display:flex;align-items:center;justify-content:space-between;height:64px}' +
    '.sc-logo{max-height:42px;max-width:200px;display:block}.sc-logo-text{font-family:Archivo;font-weight:900;font-size:22px}' +
    '.sc-hero{max-width:760px;margin-top:26px}.sc-hero h1{font-size:clamp(30px,5vw,50px);line-height:1.04}' +
    '.sc-hero p{color:#c4ccd4;font-size:18px;margin:16px 0 0;max-width:60ch}' +
    '.sc-contact{margin-top:24px;display:flex;gap:12px;flex-wrap:wrap}' +
    '.sc-btn{display:inline-flex;align-items:center;font-family:Archivo;font-weight:800;font-size:15px;padding:13px 22px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none}' +
    '.sc-btn.ghost{background:transparent;border:1.5px solid rgba(255,255,255,.25);color:#fff}' +
    '.sc-body{padding:54px 0 70px}.sc-body h2{font-size:26px;margin-bottom:6px}.sc-sub{color:var(--steel);margin:0 0 26px}' +
    '.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}' +
    '.sc-card{display:block;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .1s,box-shadow .15s;background:var(--paper)}' +
    '.sc-card:hover{transform:translateY(-3px);box-shadow:0 16px 36px -18px rgba(0,0,0,.3)}' +
    '.sc-card-top{height:96px;background:linear-gradient(135deg,var(--accent),#15191e);display:flex;align-items:flex-end;padding:12px}' +
    '.sc-trade{font-family:Inter;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.25);padding:4px 9px;border-radius:7px}' +
    '.sc-card-body{padding:15px 16px}.sc-name{font-family:Archivo;font-weight:800;font-size:17px}.sc-view{color:var(--accent);font-weight:700;font-size:14px;margin-top:7px}' +
    '.sc-empty{color:var(--steel)}' +
    '.sc-foot{border-top:1px solid var(--line);padding:24px 0;color:var(--steel);font-size:13px;text-align:center}' +
    '</style></head><body>' +
    '<header class="sc-head"><div class="wrap"><div class="sc-nav">' + logo + '</div>' +
    '<div class="sc-hero"><h1>' + headline + '</h1><p>' + intro + '</p>' + contact + '</div></div></header>' +
    '<main class="sc-body"><div class="wrap"><h2>Recent designs</h2><p class="sc-sub">Tap any design to see it live.</p>' + grid + '</div></main>' +
    '<footer class="sc-foot"><div class="wrap">Powered by LeadPages</div></footer></body></html>';
}
async function renderShowcase(req, res, slug, base) {
  try {
    const prof = (await supabase.from('partner_profiles')
      .select('partner_id,showcase_slug,showcase_enabled,showcase_protected,showcase_password,showcase_headline,showcase_config,support_email,support_phone')
      .ilike('showcase_slug', slug).maybeSingle()).data;
    if (!prof || !prof.showcase_enabled) return notFound(res);
    const partner = (await supabase.from('partners').select('display_name,status').eq('id', prof.partner_id).maybeSingle()).data;
    if (!partner || partner.status === 'suspended' || partner.status === 'terminated') return notFound(res);

    if (prof.showcase_protected && prof.showcase_password) {
      const token = crypto.createHash('sha1').update(String(prof.showcase_password) + ':' + slug).digest('hex');
      const cookies = parseCookies(req.headers.cookie);
      if (cookies['lp_sc_' + slug] !== token) {
        const pw = (req.query && req.query.pw) || '';
        if (pw && pw === prof.showcase_password) {
          res.setHeader('Set-Cookie', 'lp_sc_' + slug + '=' + token + '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax');
          res.statusCode = 302; res.setHeader('location', '/'); return res.end();
        }
        res.status(200).setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
        return res.send(scPasswordHtml(slug, partner, !!pw));
      }
    }

    const demos = (await supabase.from('sites')
      .select('slug,business_name,config')
      .eq('show_on_showcase', true)
      .or('servicing_partner_id.eq.' + prof.partner_id + ',referring_partner_id.eq.' + prof.partner_id)
      .limit(48)).data || [];

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.status(200).send(showcaseHtml(prof, partner, demos, base));
  } catch (e) { console.error('showcase error:', e); return notFound(res); }
}

module.exports = async (req, res) => {
  try {
    const rawHost = (req.headers.host || '').toLowerCase();
    const host = rawHost.replace(/^www\./, '');
    const slug = (req.query && req.query.slug) || '';
    let page = (req.query && req.query.page) || '';
    const isCustom = !!host && !PRIMARY_HOSTS.includes(host);

    // Partner showcase: <slug>.leadpages.com.au serves the partner's homepage.
    const _sc = showcaseSlugFromHost(host);
    if (_sc) return renderShowcase(req, res, _sc.slug, _sc.base);

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
