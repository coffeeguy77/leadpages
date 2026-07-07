// lib/seo/template.js
// Load the public landing template and inject server-rendered, suburb-localized SEO.

export async function loadTemplate() {
  // Point this at wherever your trade.template.json is served (it has an `html` field).
  const url = process.env.SEO_TEMPLATE_URL;
  if (!url) throw new Error('Set SEO_TEMPLATE_URL to your trade.template.json URL');
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error('template fetch ' + r.status);
  const j = await r.json();
  return j.html || '';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Replace the template's own per-tenant double-brace tokens.
export function applyTenantTokens(html, tok, host) {
  return html
    .replace(/\{\{businessName\}\}/g, esc(tok.business || ''))
    .replace(/\{\{phoneText\}\}/g, esc(tok.phone || ''))
    .replace(/\{\{domain\}\}/g, esc(host || ''));
}

// Server-render the <head> so crawlers get a localized title/description/canonical/OG
// in the RAW HTML (not only after JS hydration).
export function applySeoHead(html, { title, description, canonical, image, robots, googleVerification }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');

  const metaDesc = '<meta name="description" content="' + esc(description) + '">';
  html = /<meta[^>]*name="description"[^>]*>/.test(html)
    ? html.replace(/<meta[^>]*name="description"[^>]*>/, metaDesc)
    : html.replace('</head>', metaDesc + '\n</head>');

  const link = '<link rel="canonical" href="' + esc(canonical) + '">';
  html = /<link[^>]*rel="canonical"[^>]*>/.test(html)
    ? html.replace(/<link[^>]*rel="canonical"[^>]*>/, link)
    : html.replace('</head>', link + '\n</head>');

  if (googleVerification) {
    const gmeta =
      '<meta name="google-site-verification" content="' + esc(googleVerification) + '">';
    html = /<meta[^>]*name="google-site-verification"[^>]*>/.test(html)
      ? html.replace(/<meta[^>]*name="google-site-verification"[^>]*>/, gmeta)
      : html.replace('</head>', gmeta + '\n</head>');
  }

  const extra =
    '\n<meta property="og:title" content="' + esc(title) + '">' +
    '\n<meta property="og:description" content="' + esc(description) + '">' +
    '\n<meta property="og:url" content="' + esc(canonical) + '">' +
    '\n<meta property="og:type" content="website">' +
    (image ? '\n<meta property="og:image" content="' + esc(image) + '">' : '') +
    '\n<meta name="twitter:card" content="summary_large_image">' +
    '\n<meta name="robots" content="' + esc(robots || 'index,follow') + '">';
  return html.replace('</head>', extra + '\n</head>');
}

// Server-render the localized H1 (only if a localized title exists) and the unique
// per-suburb intro into the hero — so the key on-page signal is in the raw HTML and
// matches what hydration will set.
export function applyHero(html, { title, titleHl, intro }) {
  if (title) {
    html = html.replace(
      /(<section class="hero" data-sec="hero">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,
      (m, a, b) => a + esc(title) + (titleHl ? ' <span class="hl">' + esc(titleHl) + '</span>' : '') + b
    );
  }
  if (intro) {
    html = html.replace(
      /(<section class="hero" data-sec="hero">[\s\S]*?<p class="hero-sub">)[\s\S]*?(<\/p>)/,
      (m, a, b) => a + esc(intro) + b
    );
  }
  return html;
}

// Re-apply the suburb-merged config on load so client hydration matches the SSR output.
export function injectBootstrap(html, mergedConfig) {
  const json = JSON.stringify(mergedConfig).replace(/</g, '\\u003c');
  const boot =
    '<script>(function(){function go(){if(window.__applyTradeConfig){try{window.__applyTradeConfig(' +
    json +
    ');}catch(e){}}else{setTimeout(go,40);}}go();})();</script>';
  return html.replace('</body>', boot + '\n</body>');
}
