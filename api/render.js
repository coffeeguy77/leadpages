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
const agencyTpl   = require('../agency.template.json');     // partner web-studio homepage
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
function demoGateHtml(site, tried) {
  const biz = esc(site.business_name || 'This sample');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>' + biz + ' \u2014 private preview</title>' +
    '<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#15191e;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">' +
    '<form method="get" style="max-width:380px;width:100%;text-align:center">' +
    '<input type="hidden" name="preview" value="1">' +
    '<div style="font-size:34px;margin-bottom:10px">&#128274;</div>' +
    '<h1 style="font-family:Archivo,sans-serif;font-size:23px;margin:0 0 6px">Private preview</h1>' +
    '<p style="opacity:.75;margin:0 0 18px">Enter the password you were sent to view this sample.</p>' +
    (tried ? '<p style="color:#ff8a65;margin:0 0 12px;font-size:14px">That password didn\u2019t match. Try again.</p>' : '') +
    '<input name="pw" type="password" autofocus placeholder="Password" style="width:100%;padding:13px 15px;border-radius:11px;border:0;font-size:16px;margin-bottom:12px">' +
    '<button type="submit" style="width:100%;padding:13px;border-radius:11px;border:0;background:#ff6a1a;color:#fff;font-weight:700;font-size:16px;cursor:pointer">View sample</button>' +
    '</form></body></html>';
}
function scCard(demo, base) {
  const cfg = demo.config || {};
  const trade = esc((cfg.trade || '').toString());
  const logoUrl = (cfg.logo && cfg.logo.imageUrl) ? esc(cfg.logo.imageUrl) : '';
  const url = 'https://' + base + '/' + encodeURIComponent(demo.slug) + '?preview=1';
  const chip = logoUrl
    ? '<span class="sc-card-logo"><img src="' + logoUrl + '" alt="" loading="lazy"></span>'
    : '<span class="sc-card-logo mono">' + esc((demo.business_name || '?').trim().slice(0, 1).toUpperCase()) + '</span>';
  return '<a class="sc-card" href="' + url + '" target="_blank" rel="noopener">' +
    '<div class="sc-card-top">' + chip + (trade ? '<span class="sc-trade">' + trade + '</span>' : '') + '</div>' +
    '<div class="sc-card-body"><div class="sc-name">' + esc(demo.business_name || demo.slug) + '</div>' +
    '<div class="sc-view">View demo &rarr;</div></div></a>';
}
function scFeature(icon, title, body) {
  return '<div class="sc-feat"><div class="sc-feat-ic">' + icon + '</div><h3>' + title + '</h3><p>' + body + '</p></div>';
}
function showcaseHtml(prof, partner, demos, base) {
  const cfg = prof.showcase_config || {};
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(cfg.accent || '') ? cfg.accent : '#ff6a1a';
  const name = esc(partner.display_name || 'Local Web');
  const headline = esc(prof.showcase_headline || 'Websites that get local tradies booked');
  const intro = esc(cfg.intro || 'Professional, mobile-first websites built for tradespeople \u2014 with a lead form that reaches you the moment someone needs a quote. Take a look at some recent designs below.');
  const logo = cfg.logo ? ('<img src="' + esc(cfg.logo) + '" alt="' + name + '" class="sc-logo">') : ('<span class="sc-logo-text">' + name + '</span>');
  const email = prof.support_email ? esc(prof.support_email) : '';
  const phone = prof.support_phone ? esc(prof.support_phone) : '';
  const tel = phone ? phone.replace(/[^+0-9]/g, '') : '';
  const navCta = email ? '<a class="sc-btn sm" href="mailto:' + email + '">Get in touch</a>'
    : (phone ? '<a class="sc-btn sm" href="tel:' + tel + '">Call us</a>' : '');
  const heroCtas = '<div class="sc-hero-ctas">'
    + (demos.length ? '<a class="sc-btn" href="#work">See recent work</a>' : '')
    + (email ? '<a class="sc-btn ghost" href="mailto:' + email + '">Get a website</a>'
             : (phone ? '<a class="sc-btn ghost" href="tel:' + tel + '">Call ' + name + '</a>' : ''))
    + '</div>';

  const feats = '<div class="sc-feats">'
    + scFeature('&#128241;', 'Built for mobile', 'Most tradie enquiries come from a phone. Every site looks sharp and loads fast on mobile first.')
    + scFeature('&#9889;', 'Leads reach you instantly', 'A built-in quote form that emails you the moment someone needs work \u2014 no missed jobs.')
    + scFeature('&#128269;', 'Found on Google', 'Local search basics are baked in so nearby customers can actually find you.')
    + scFeature('&#128640;', 'Live in days', 'No drawn-out web project. Your site can be online and taking enquiries this week.')
    + scFeature('&#9999;&#65039;', 'Easy to update', 'Prices, services, hours \u2014 change anything any time, no developer needed.')
    + scFeature('&#129309;', 'Local support', 'A real person who knows your business, not an overseas help desk.')
    + '</div>';

  const grid = demos.length
    ? '<div class="sc-grid">' + demos.map(d => scCard(d, base)).join('') + '</div>'
    : '<p class="sc-empty">New designs coming soon.</p>';
  const work = demos.length
    ? '<section class="sc-work" id="work"><div class="wrap"><h2>Recent work</h2><p class="sc-sub">Tap any design to see it live.</p>' + grid + '</div></section>'
    : '';

  const contactBits = [];
  if (email) contactBits.push('<a class="sc-btn" href="mailto:' + email + '">Email ' + name + '</a>');
  if (phone) contactBits.push('<a class="sc-btn ghost" href="tel:' + tel + '">' + phone + '</a>');
  const contact = (email || phone)
    ? '<section class="sc-contact" id="contact"><div class="wrap"><h2>Ready for a website that works?</h2>'
      + '<p class="sc-sub" style="max-width:52ch;margin-inline:auto">Tell ' + name + ' about your trade and we\u2019ll put together a site that brings in the work.</p>'
      + '<div class="sc-contact-btns">' + contactBits.join('') + '</div></div></section>'
    : '';

  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + name + ' \u2014 Websites for tradies</title>' +
    '<meta name="description" content="' + intro + '">' +
    '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' +
    ':root{--accent:' + accent + ';--ink:#15191e;--steel:#5b6571;--line:#e6e8ec;--paper:#fff;--hi:#f5f7f9}' +
    '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);line-height:1.55}' +
    'h1,h2,h3{font-family:Archivo,sans-serif;font-weight:900;letter-spacing:-.02em;margin:0}a{color:inherit}' +
    '.wrap{max-width:1080px;margin:0 auto;padding:0 22px}' +
    '.sc-btn{display:inline-flex;align-items:center;gap:8px;font-family:Archivo;font-weight:800;font-size:15.5px;padding:14px 24px;border-radius:13px;background:var(--accent);color:#fff;text-decoration:none;border:1.5px solid var(--accent)}' +
    '.sc-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.3)}' +
    '.sc-btn.sm{padding:9px 16px;font-size:14px}' +
    '.sc-top{position:sticky;top:0;z-index:5;background:rgba(21,25,30,.82);backdrop-filter:blur(8px)}' +
    '.sc-top .sc-nav{display:flex;align-items:center;justify-content:space-between;height:66px}' +
    '.sc-logo{max-height:40px;max-width:190px;display:block}.sc-logo-text{font-family:Archivo;font-weight:900;font-size:21px;color:#fff}' +
    '.sc-hero{background:radial-gradient(130% 130% at 85% -20%,#222a33,#13171c);color:#fff;padding:70px 0 84px;text-align:left}' +
    '.sc-hero h1{font-size:clamp(32px,5.4vw,56px);line-height:1.03;max-width:16ch}' +
    '.sc-hero p{color:#c4ccd4;font-size:19px;margin:18px 0 0;max-width:56ch}' +
    '.sc-hero-ctas{margin-top:30px;display:flex;gap:13px;flex-wrap:wrap}' +
    '.sc-why{padding:64px 0 20px}.sc-why h2{font-size:clamp(24px,3.4vw,32px);text-align:center}.sc-why .sc-sub{text-align:center}' +
    '.sc-sub{color:var(--steel);margin:8px 0 0}' +
    '.sc-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:36px}' +
    '.sc-feat{border:1px solid var(--line);border-radius:16px;padding:24px;background:var(--paper)}' +
    '.sc-feat-ic{font-size:26px;width:50px;height:50px;border-radius:12px;background:var(--hi);display:flex;align-items:center;justify-content:center;margin-bottom:14px}' +
    '.sc-feat h3{font-size:18px}.sc-feat p{color:var(--steel);margin:8px 0 0;font-size:14.5px}' +
    '.sc-work{padding:60px 0}.sc-work h2{font-size:clamp(24px,3.4vw,32px)}' +
    '.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin-top:22px}' +
    '.sc-card{display:block;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .1s,box-shadow .15s;background:var(--paper)}' +
    '.sc-card:hover{transform:translateY(-3px);box-shadow:0 16px 36px -18px rgba(0,0,0,.3)}' +
    '.sc-card-top{position:relative;height:104px;background:linear-gradient(135deg,var(--accent),#15191e);display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:12px}.sc-card-logo{width:48px;height:48px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 18px -8px rgba(0,0,0,.55);flex:0 0 auto}.sc-card-logo img{max-width:84%;max-height:84%;object-fit:contain}.sc-card-logo.mono{font-family:Archivo;font-weight:900;color:var(--accent);font-size:21px}' +
    '.sc-trade{font-family:Inter;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.25);padding:4px 9px;border-radius:7px}' +
    '.sc-card-body{padding:15px 16px}.sc-name{font-family:Archivo;font-weight:800;font-size:17px}.sc-view{color:var(--accent);font-weight:700;font-size:14px;margin-top:7px}' +
    '.sc-empty{color:var(--steel)}' +
    '.sc-contact{background:var(--hi);padding:66px 0;text-align:center}.sc-contact h2{font-size:clamp(24px,3.6vw,34px)}' +
    '.sc-contact-btns{margin-top:24px;display:flex;gap:13px;flex-wrap:wrap;justify-content:center}' +
    '.sc-contact .sc-btn.ghost{color:var(--ink);border-color:var(--line)}' +
    '.sc-foot{border-top:1px solid var(--line);padding:26px 0;color:var(--steel);font-size:13px;text-align:center}' +
    '@media(max-width:640px){.sc-hero{padding:52px 0 60px}}' +
    '</style></head><body>' +
    '<div class="sc-top"><div class="wrap"><div class="sc-nav">' + logo + (navCta || '') + '</div></div></div>' +
    '<header class="sc-hero"><div class="wrap"><h1>' + headline + '</h1><p>' + intro + '</p>' + heroCtas + '</div></header>' +
    '<section class="sc-why"><div class="wrap"><h2>Why a website built for your trade</h2><p class="sc-sub">Everything a local tradie needs to win more work \u2014 nothing they don\u2019t.</p>' + feats + '</div></section>' +
    work +
    contact +
    '<footer class="sc-foot"><div class="wrap">' + name + ' \u00b7 Powered by LeadPages</div></footer></body></html>';
}

function hexOr(v, d) { return /^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : d; }

function buildAgencyHtml(site, host, demos, base) {
  const cfg = site.config || {};
  const sec = cfg.sections || {};
  const hero = sec.hero || {};
  const theme = cfg.theme || {};
  const accent = hexOr(theme.hivis, '#ff6a1a');
  const ink = hexOr(theme.steel, '#15191e');
  const brand = hexOr(theme.pipe, accent);
  const studio = esc(site.business_name || 'Web Studio');
  const logoUrl = (cfg.logo && cfg.logo.imageUrl) ? esc(cfg.logo.imageUrl) : '';
  const logo = logoUrl ? ('<img src="' + logoUrl + '" alt="' + studio + '" class="ag-logo-img">') : ('<span class="ag-logo-txt">' + studio + '</span>');

  const heroTitleRaw = (hero.title != null && String(hero.title).trim()) ? String(hero.title) : 'Websites that bring in the work';
  const heroHl = (hero.titleHl != null) ? String(hero.titleHl).trim() : '';
  let heroTitle = esc(heroTitleRaw);
  if (heroHl) {
    const safeHl = esc(heroHl);
    heroTitle = (heroTitle.indexOf(safeHl) >= 0) ? heroTitle.replace(safeHl, '<span class="hl">' + safeHl + '</span>') : (heroTitle + ' <span class="hl">' + safeHl + '</span>');
  }
  const heroEyebrow = esc(hero.eyebrow || 'Web design studio');
  const heroSub = esc((hero.sub && String(hero.sub).trim()) || 'Professional, mobile-first websites for local businesses across Canberra and the ACT \u2014 built fast, with lead forms that put enquiries straight in your inbox.');

  const phone = (cfg.phone || '').trim();
  const phoneHref = phone.replace(/[^+0-9]/g, '');
  const email = (cfg.email || '').trim();
  const heroCall = phone ? ('<a class="call" href="tel:' + esc(phoneHref) + '">Or call ' + esc(phone) + '</a>') : (email ? ('<a class="call" href="mailto:' + esc(email) + '">Or email us</a>') : '');

  const svcs = (Array.isArray(cfg.services) ? cfg.services : []).filter(function (x) { return x && x.on !== false && (x.title || x.body); }).slice(0, 6);
  const svcList = svcs.length ? svcs : [
    { icon: '\uD83D\uDCF1', title: 'Mobile-first design', body: 'Sites that look sharp and load fast on the phone, where most local customers find you.' },
    { icon: '\u26A1', title: 'Lead forms that work', body: 'Enquiry forms that land straight in your inbox so you never miss a job.' },
    { icon: '\uD83D\uDD0E', title: 'Found on Google', body: 'Local search basics built in so nearby customers can actually find you.' }
  ];
  const services = svcList.map(function (x) { return '<div class="svc"><span class="ic">' + esc(x.icon || '\u2728') + '</span><h3>' + esc(x.title || '') + '</h3><p>' + esc(x.body || x.desc || '') + '</p></div>'; }).join('');

  const work = (demos && demos.length) ? demos.map(function (d) {
    const dc = d.config || {}; const trade = esc((dc.trade || '').toString());
    const lg = (dc.logo && dc.logo.imageUrl) ? esc(dc.logo.imageUrl) : '';
    const lock = d.preview_password ? '<span class="ag-lock">&#128274;</span>' : '';
    const chip = lg ? ('<span class="ag-chip"><img src="' + lg + '" alt="" loading="lazy"></span>') : ('<span class="ag-chip mono">' + esc((d.business_name || '?').trim().slice(0, 1).toUpperCase()) + '</span>');
    const url = 'https://' + base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    return '<a class="ag-card" href="' + url + '" target="_blank" rel="noopener"><div class="ag-top">' + chip + (trade ? '<span class="ag-trade">' + trade + '</span>' : '') + lock + '</div><div class="ag-body"><div class="ag-name">' + esc(d.business_name || d.slug) + '</div><div class="ag-view">View site &rarr;</div></div></a>';
  }).join('') : '<p class="ag-empty">New work coming soon.</p>';

  const tb = sec.textBox || {};
  const aboutEyebrow = esc(tb.eyebrow || 'About the studio');
  const aboutHeading = esc((tb.heading && String(tb.heading).replace(/\{\{\s*businessName\s*\}\}/g, site.business_name || 'us')) || 'Local websites, done properly');
  const aboutBody = esc((tb.content && String(tb.content).trim()) || (tb.intro && String(tb.intro).trim()) || 'We design and build websites for local trades and small businesses \u2014 clean, quick to launch, and easy to update. You get a site that earns its keep and a real person to call when you need a change.');
  const aboutImgUrl = tb.image ? esc(tb.image) : '';
  const aboutImg = aboutImgUrl ? ('<div class="about-img"><img src="' + aboutImgUrl + '" alt=""></div>') : '<div class="about-img"></div>';

  let cbtns = '';
  if (email) cbtns += '<a class="btn" href="mailto:' + esc(email) + '">Email ' + studio + '</a>';
  if (phone) cbtns += '<a class="btn ghost" href="tel:' + esc(phoneHref) + '">' + esc(phone) + '</a>';
  if (!cbtns) cbtns = '<a class="btn" href="#">Get in touch</a>';

  const domainAction = 'https://' + (base || 'leadpages.com.au') + '/domains';

  let html = agencyTpl.html;
  const map = {
    '{{ACCENT}}': accent, '{{INK}}': ink, '{{BRAND}}': brand, '{{STUDIO}}': studio, '{{LOGO}}': logo,
    '{{HERO_EYEBROW}}': heroEyebrow, '{{HERO_TITLE}}': heroTitle, '{{HERO_SUB}}': heroSub, '{{HERO_CALL}}': heroCall,
    '{{DOMAIN_ACTION}}': domainAction, '{{SERVICES}}': services, '{{WORK}}': work,
    '{{ABOUT_EYEBROW}}': aboutEyebrow, '{{ABOUT_HEADING}}': aboutHeading, '{{ABOUT_BODY}}': aboutBody, '{{ABOUT_IMG}}': aboutImg,
    '{{CONTACT_HEADING}}': 'Let\u2019s build yours', '{{CONTACT_SUB}}': esc('Tell us about your business and we\u2019ll put together a site that brings in the work.'),
    '{{CONTACT_BTNS}}': cbtns, '{{YEAR}}': String(new Date().getFullYear())
  };
  for (const k of Object.keys(map)) html = html.split(k).join(map[k]);
  return html;
}

function buildTradeHtml(site, host) {
  const template = templateFor(site);
  const tpl = TOKEN_TEMPLATES[template] || TOKEN_TEMPLATES['broker-leads'];
  const cfg = Object.assign({ business: site.business_name, slug: site.slug, siteId: site.id }, site.config || {});
  if (template === 'trade' && !cfg.trade) cfg.trade = '';
  const _biz = (cfg.business || site.business_name || '').trim();
  const _trade = (cfg.trade || '').trim();
  const pageTitle = (cfg.seoTitle || '').trim() || (_trade ? (_biz + ' \u2014 ' + _trade + ' in Canberra & the ACT') : (_biz + ' \u2014 Canberra & the ACT'));
  const pageDesc = (cfg.seoDescription || '').trim() || (_biz + ' \u2014 professional websites for local trades across Canberra and the ACT.');
  let html = tpl.replaceAll('__SITE_CONFIG__', safeJson(cfg));
  const tokens = {
    '{{businessName}}': esc(site.business_name), '{{phoneText}}': esc(cfg.phoneText), '{{email}}': esc(cfg.email),
    '{{phone}}': esc(cfg.phone), '{{domain}}': esc(host), '{{initial}}': esc((site.business_name || 'B').trim().charAt(0).toUpperCase()),
    '{{trade}}': esc(_trade), '{{pageTitle}}': esc(pageTitle), '{{pageDesc}}': esc(pageDesc)
  };
  for (const [k, v] of Object.entries(tokens)) html = html.replaceAll(k, v);
  return html;
}

function partnerDemosBlock(demos, base, accent) {
  if (!demos || !demos.length) return '';
  const ac = /^#[0-9a-fA-F]{3,8}$/.test(accent || '') ? accent : '#ff6a1a';
  const cards = demos.map(function (d) {
    const cfg = d.config || {}; const trade = esc((cfg.trade || '').toString());
    const logoUrl = (cfg.logo && cfg.logo.imageUrl) ? esc(cfg.logo.imageUrl) : '';
    const url = 'https://' + base + '/' + encodeURIComponent(d.slug) + '?preview=1';
    const chip = logoUrl
      ? '<span class="lpw-logo"><img src="' + logoUrl + '" alt="" loading="lazy"></span>'
      : '<span class="lpw-logo lpw-mono">' + esc((d.business_name || '?').trim().slice(0, 1).toUpperCase()) + '</span>';
    return '<a class="lpw-card" href="' + url + '" target="_blank" rel="noopener"><div class="lpw-top">' + chip + (trade ? '<span class="lpw-trade">' + trade + '</span>' : '') + '</div><div class="lpw-body"><div class="lpw-name">' + esc(d.business_name || d.slug) + '</div><div class="lpw-view">View demo &rarr;</div></div></a>';
  }).join('');
  return '<style>'
    + '.lpw-wrap{--lpw-ac:' + ac + ';font-family:Inter,system-ui,sans-serif;background:#fff;color:#15191e;padding:60px 22px;border-top:1px solid #e6e8ec}'
    + '.lpw-in{max-width:1080px;margin:0 auto}.lpw-h{font-family:Archivo,Arial,sans-serif;font-weight:900;letter-spacing:-.02em;font-size:clamp(23px,3.3vw,30px);margin:0}'
    + '.lpw-sub{color:#5b6571;margin:8px 0 24px}.lpw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}'
    + '.lpw-card{display:block;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .1s,box-shadow .15s;background:#fff}'
    + '.lpw-card:hover{transform:translateY(-3px);box-shadow:0 16px 36px -18px rgba(0,0,0,.3)}'
    + '.lpw-top{position:relative;height:104px;background:linear-gradient(135deg,var(--lpw-ac),#15191e);display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:12px}'
    + '.lpw-logo{width:48px;height:48px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 18px -8px rgba(0,0,0,.55);flex:0 0 auto}'
    + '.lpw-logo img{max-width:84%;max-height:84%;object-fit:contain}.lpw-mono{font-family:Archivo,Arial;font-weight:900;color:var(--lpw-ac);font-size:21px}'
    + '.lpw-trade{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.25);padding:4px 9px;border-radius:7px}'
    + '.lpw-body{padding:15px 16px}.lpw-name{font-family:Archivo,Arial;font-weight:800;font-size:17px}.lpw-view{color:var(--lpw-ac);font-weight:700;font-size:14px;margin-top:7px}'
    + '</style>'
    + '<section class="lpw-wrap" id="recent-work"><div class="lpw-in"><h2 class="lpw-h">Recent work</h2><p class="lpw-sub">A few sites we\u2019ve designed for local trades \u2014 tap any one to see it live.</p><div class="lpw-grid">' + cards + '</div></div></section>';
}

const SC_SELECT = 'partner_id,showcase_slug,showcase_domain,showcase_enabled,showcase_headline,showcase_config,support_email,support_phone';

async function showcaseRespond(req, res, prof, base) {
  const partner = (await supabase.from('partners').select('display_name,status').eq('id', prof.partner_id).maybeSingle()).data;
  if (!partner || partner.status === 'suspended' || partner.status === 'terminated') return notFound(res);
  const demos = (await supabase.from('sites')
    .select('slug,business_name,config,preview_password')
    .eq('show_on_showcase', true)
    .or('servicing_partner_id.eq.' + prof.partner_id + ',referring_partner_id.eq.' + prof.partner_id)
    .limit(48)).data || [];
  const home = (await supabase.from('sites')
    .select('*').eq('servicing_partner_id', prof.partner_id).eq('is_partner_home', true).maybeSingle()).data;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, s-maxage=5, stale-while-revalidate=20');
  if (home) return res.status(200).send(buildAgencyHtml(home, req.headers.host || '', demos, base));
  return res.status(200).send(showcaseHtml(prof, partner, demos, base));
}

async function renderShowcase(req, res, slug, base) {
  try {
    const prof = (await supabase.from('partner_profiles').select(SC_SELECT).ilike('showcase_slug', slug).maybeSingle()).data;
    if (!prof || !prof.showcase_enabled) return notFound(res);
    return await showcaseRespond(req, res, prof, base);
  } catch (e) { console.error('showcase error:', e); return notFound(res); }
}

async function renderShowcaseByDomain(req, res, host) {
  try {
    const h = String(host || '').toLowerCase();
    const alt = h.indexOf('www.') === 0 ? h.slice(4) : ('www.' + h);
    const prof = (await supabase.from('partner_profiles').select(SC_SELECT).in('showcase_domain', [h, alt]).maybeSingle()).data;
    if (!prof || !prof.showcase_enabled) return notFound(res);
    // Demo links + domain search always point at the primary host where tenant sites live.
    return await showcaseRespond(req, res, prof, SHOWCASE_SUFFIXES[0] || 'leadpages.com.au');
  } catch (e) { console.error('showcase domain error:', e); return notFound(res); }
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
        .from('sites').select('*').eq('slug', slug).maybeSingle());
    } else {
      ({ data: site, error } = await supabase
        .from('sites').select('*').eq('custom_domain', host).maybeSingle());
    }

    if (error || !site) {
      // Partner's own domain (e.g. yourstudio.com.au) -> their studio page.
      if (isCustom) return renderShowcaseByDomain(req, res, host);
      // Path-based partner showcase: leadpages.com.au/<showcase-slug>
      if (slug && !isCustom) return renderShowcase(req, res, slug, host);
      return notFound(res);
    }
    const isPreview = !!(req.query && req.query.preview);
    const isLive = site.status === 'live';
    // Non-live sites (e.g. partner drafts) are hidden from the public: a clean URL
    // 404s. The builder can still preview them via ?preview=, and those responses
    // are never cached or indexed (see sendHtml).
    if (!isLive && !isPreview) return notFound(res);
    // Per-sample password: an individual demo/sample link can be locked so prospects
    // can't browse each other's jobs. The partner shares the password per prospect.
    if (site.preview_password) {
      const _tok = crypto.createHash('sha1').update(String(site.preview_password) + ':' + site.slug).digest('hex');
      const _ck = parseCookies(req.headers.cookie);
      if (_ck['lp_pw_' + site.slug] !== _tok) {
        const _pw = (req.query && req.query.pw) || '';
        if (_pw && _pw === site.preview_password) {
          res.setHeader('Set-Cookie', 'lp_pw_' + site.slug + '=' + _tok + '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax');
        } else {
          res.status(200).setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('cache-control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
          return res.send(demoGateHtml(site, !!_pw));
        }
      }
    }
    if (isLive && (site.billing_status === 'suspended' || site.billing_status === 'flagged_deletion')) {
      const key = site.is_system ? 'suspended_system' : (site.is_demo ? 'suspended_demo' : 'suspended_client');
      let tpl = null;
      try { const r = await supabase.from('system_pages').select('content').eq('key', key).maybeSingle(); tpl = r.data && r.data.content; } catch (e) { tpl = null; }
      return suspendedPage(res, site, tpl);
    }

    // Partner homepage: render through the premium web-studio theme (not the tradie
    // look) on the clean URL/preview, so the builder preview matches the live page.
    if (site.is_partner_home) {
      const pid = site.servicing_partner_id;
      const _demos = pid ? ((await supabase.from('sites')
        .select('slug,business_name,config,preview_password')
        .eq('show_on_showcase', true)
        .or('servicing_partner_id.eq.' + pid + ',referring_partner_id.eq.' + pid)
        .limit(48)).data || []) : [];
      return sendHtml(res, buildAgencyHtml(site, host, _demos, SHOWCASE_SUFFIXES[0] || 'leadpages.com.au'), isLive);
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
