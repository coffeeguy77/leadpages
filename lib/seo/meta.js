'use strict';

/**
 * Shared SEO meta helpers for published tenant pages (api/render.js).
 * Keeps titles/descriptions SERP-safe and builds path-correct canonicals.
 */

function clipSeoText(input, maxChars) {
  const s = String(input || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const sp = cut.lastIndexOf(' ');
  const base = sp > Math.floor(maxChars * 0.6) ? cut.slice(0, sp) : cut;
  return base.replace(/[.,;:–—-]\s*$/, '').trim() + '…';
}

/** ~Google desktop title pixel budget (~580px ≈ 55–60 chars). */
function clipSeoTitle(input) {
  return clipSeoText(input, 60);
}

/** ~Google desktop description budget (~920–1000px ≈ 150–160 chars). */
function clipSeoDescription(input) {
  return clipSeoText(input, 155);
}

/**
 * Prefer the request Host (including www) so canonical matches the URL Google crawled.
 * Falls back to stored custom_domain / stripped host.
 */
function canonicalHost(rawHost, site) {
  const fromReq = String(rawHost || '').toLowerCase().split(':')[0].trim();
  if (fromReq) return fromReq;
  const stored = String((site && site.custom_domain) || '').toLowerCase().trim();
  if (stored) return stored;
  return '';
}

/**
 * Build absolute canonical / og:url for homepage or landing page.
 * Custom domain: https://host/ or https://host/{page}
 * Platform host: https://host/{slug} or https://host/{slug}/{page}
 */
function buildCanonicalUrl(rawHost, site, page, isCustom) {
  const host = canonicalHost(rawHost, site);
  if (!host) return '';
  const slug = site && site.slug ? encodeURIComponent(String(site.slug)) : '';
  const pageSeg = page ? encodeURIComponent(String(page).replace(/^\/+|\/+$/g, '')) : '';
  let path = '/';
  if (isCustom) {
    path = pageSeg ? '/' + pageSeg : '/';
  } else if (slug) {
    path = '/' + slug + (pageSeg ? '/' + pageSeg : '');
  }
  return 'https://' + host + path;
}

/** Avoid "Title — Biz — Biz" when landing title already includes the business name. */
function landingPageTitle(pageTitle, businessName) {
  const t = String(pageTitle || '').trim();
  const biz = String(businessName || '').trim();
  if (!t) return biz;
  if (!biz) return t;
  if (t.toLowerCase().includes(biz.toLowerCase())) return t;
  return t + ' — ' + biz;
}

module.exports = {
  clipSeoText,
  clipSeoTitle,
  clipSeoDescription,
  canonicalHost,
  buildCanonicalUrl,
  landingPageTitle
};
