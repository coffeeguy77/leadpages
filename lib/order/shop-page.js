'use strict';

/**
 * Where a customer should go to shop / see "My orders": the site's own shop page (the first
 * published page carrying the Order Storefront app — the designed, slim layout), not the
 * generic /order-shop page. Mirrors shopPageSlug() in assets/lp-layouts.js.
 */

const PLATFORM_HOST = /(^|\.)leadpages\.(com\.au|webculture\.au)$|\.vercel\.app$|^localhost(:\d+)?$/i;

function txt(v) {
  return String(v == null ? '' : v).trim();
}

/** Slug of the shop page in a site config (pages[]), or ''. */
function shopPageSlug(pages) {
  const list = Array.isArray(pages) ? pages : [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p || !txt(p.slug) || (p.status && p.status !== 'published')) continue;
    const onPage =
      (Array.isArray(p.pageLayoutOrder) && p.pageLayoutOrder.indexOf('orderStorefront') >= 0) ||
      (Array.isArray(p.pageApps) && p.pageApps.some(function (a) { return a && (a.key || a.section_key) === 'orderStorefront'; }));
    const ps = p.pageSections && p.pageSections.orderStorefront;
    if (onPage && !(ps && ps.on === false)) return txt(p.slug).replace(/^\/+|\/+$/g, '');
  }
  return '';
}

/**
 * Relative shop URL for the host the customer is on.
 * @param {{slug:string, pages?:Array}} site  site slug + config.pages
 * @param {string} host  request host (custom domain → "/page", platform → "/slug/page")
 * @param {object} [query]  e.g. { account: 1 } or { cart_id }
 */
function shopUrlFor(site, host, query) {
  const slug = txt(site && site.slug);
  const page = shopPageSlug(site && site.pages);
  const qs = Object.keys(query || {})
    .filter(function (k) { return query[k] != null && query[k] !== ''; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); });
  if (!page) {
    // No designed shop page — the generic storefront still works.
    return '/order-shop?slug=' + encodeURIComponent(slug) + (qs.length ? '&' + qs.join('&') : '');
  }
  const h = txt(host).toLowerCase().replace(/:\d+$/, '');
  const onPlatform = !h || PLATFORM_HOST.test(h);
  const path = onPlatform ? '/' + encodeURIComponent(slug) + '/' + page : '/' + page;
  return path + (qs.length ? '?' + qs.join('&') : '') + '#lp-order-storefront';
}

function requestHost(req) {
  const h = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  return String(h).split(',')[0].trim();
}

module.exports = { shopPageSlug, shopUrlFor, requestHost };
