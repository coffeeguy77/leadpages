'use strict';

/** Customer order links use the shop's own domain once it's live; never a broken link. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const pb = require('../lib/order/public-base');
const { portalUrl, shopUrl } = require('../lib/order/notify');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('live shop domain is used (redirect target, e.g. www)', async () => {
  pb._setChecker(async (host) => (host === 'griffithbutchery.com.au' ? 'www.griffithbutchery.com.au' : null));
  const base = await pb.orderLinkBase({ id: 's1', custom_domain: 'griffithbutchery.com.au' });
  assert.equal(base, 'https://www.griffithbutchery.com.au');
  assert.equal(portalUrl('tok1', base), 'https://www.griffithbutchery.com.au/order-portal?t=tok1');
  assert.equal(shopUrl('griffithbutchery', 'c1', base), 'https://www.griffithbutchery.com.au/order-shop?slug=griffithbutchery&cart=c1');
});

test('falls back to the platform when no domain, not live, slow or erroring', async () => {
  pb._setChecker(async () => null);
  assert.equal(await pb.orderLinkBase({ id: 's1', custom_domain: 'notpointed.com.au' }), pb.PUBLIC_BASE);
  assert.equal(await pb.orderLinkBase({ id: 's1', custom_domain: '' }), pb.PUBLIC_BASE);
  assert.equal(await pb.orderLinkBase({ id: 's1', custom_domain: 'leadpages.com.au' }), pb.PUBLIC_BASE);
  pb._setChecker(async () => { throw new Error('vercel down'); });
  assert.equal(await pb.orderLinkBase({ id: 's1', custom_domain: 'shop.com.au' }), pb.PUBLIC_BASE);
  pb._setChecker(() => new Promise(() => {})); // never answers → timeout fallback
  const t0 = Date.now();
  assert.equal(await pb.orderLinkBase({ id: 's1', custom_domain: 'slow.com.au' }), pb.PUBLIC_BASE);
  assert.ok(Date.now() - t0 < 4000);
  assert.equal(portalUrl('t'), pb.PUBLIC_BASE + '/order-portal?t=t');
  pb._setChecker(null);
});

test('result is cached per domain', async () => {
  let calls = 0;
  pb._setChecker(async () => { calls += 1; return 'www.cached.com.au'; });
  await pb.orderLinkBase({ custom_domain: 'cached.com.au' });
  await pb.orderLinkBase({ custom_domain: 'cached.com.au' });
  assert.equal(calls, 1);
  pb._setChecker(null);
});

test('every customer link builder goes through orderLinkBase', () => {
  assert.match(read('api/order/cart.js'), /portalUrl\(created\.portal_token, linkBase\)/);
  assert.match(read('api/order/orders.js'), /linkBase \+ '\/order-portal\?t='/);
  assert.equal((read('lib/order/staff-order-actions.js').match(/await orderLinkBase\(/g) || []).length, 2);
  assert.match(read('api/order/checkout-deposit.js'), /const success = linkBase \+ '\/order-portal\?paid=1&'/);
  assert.match(read('lib/order/qr.js'), /portalUrl\(tok\.token, linkBase\)/);
  assert.match(read('api/cron/order-abandoned.js'), /shopUrl\(site\.slug, cart\.id, await orderLinkBase\(site\)\)/);
  // the portal page itself is served on any host that points here
  assert.match(read('vercel.json'), /"source": "\/order-portal",\s*"destination": "\/order-portal\.html"/);
});
