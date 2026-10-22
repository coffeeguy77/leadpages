'use strict';

/** After sign-in / Order again, customers land on the site's designed shop page, not /order-shop. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { shopPageSlug, shopUrlFor } = require('../lib/order/shop-page');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const site = {
  slug: 'griffithbutchery',
  pages: [
    { slug: 'about', status: 'published' },
    { slug: 'draft-shop', status: 'draft', pageApps: [{ key: 'orderStorefront' }] },
    { slug: 'online-butcher-canberra', status: 'published', pageApps: [{ key: 'orderStorefront' }] }
  ]
};

test('finds the first published page with the order storefront', () => {
  assert.equal(shopPageSlug(site.pages), 'online-butcher-canberra');
  assert.equal(shopPageSlug([{ slug: 'x', pageLayoutOrder: ['orderStorefront'], pageSections: { orderStorefront: { on: false } } }]), '');
});

test('custom domain → /page; platform → /slug/page; none → /order-shop', () => {
  assert.equal(shopUrlFor(site, 'www.griffithbutchery.com.au', { account: 1 }), '/online-butcher-canberra?account=1#lp-order-storefront');
  assert.equal(shopUrlFor(site, 'leadpages.com.au', { cart_id: 'c 1' }), '/griffithbutchery/online-butcher-canberra?cart_id=c%201#lp-order-storefront');
  assert.equal(shopUrlFor({ slug: 'plain', pages: [] }, 'plain.com.au', { account: 1 }), '/order-shop?slug=plain&account=1');
});

test('sign-in, saved session and Order again use the shop page link', () => {
  const pa = read('api/order/portal-auth.js');
  assert.match(pa, /action === 'shop_url'/);
  assert.match(pa, /shop_url: shopUrlFor\(site, reqHost, \{ account: 1 \}\)/);
  assert.match(pa, /shop_url: shopUrlFor\(site, reqHost, \{ cart_id: cart\.id \}\)/);
  const op = read('order-portal.html');
  assert.match(op, /location\.href = out\.shop_url \|\| \('\/order-shop\?slug='/);
  assert.match(op, /action:'shop_url', slug: slug, account: 1/);
});
