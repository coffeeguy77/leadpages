'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('cart.js add_item returns packed result without trailing getCart', function () {
  const fs = require('fs');
  const path = require('path');
  const cartApi = fs.readFileSync(path.join(__dirname, '..', 'api/order/cart.js'), 'utf8');
  const cartLib = fs.readFileSync(path.join(__dirname, '..', 'lib/order/cart.js'), 'utf8');
  assert.match(cartApi, /const result = await addOrUpdateItem/);
  assert.match(cartApi, /packCartResponse\(system, result, \{ lite: true \}\)/);
  assert.equal(cartApi.indexOf('await getCart(packed.cart.id)'), -1);
  assert.match(cartLib, /syncCartTotals\(cart\.id, \{ cart: cart, items:/);
});

test('storefront uses optimistic cart updates and lite cart fetch', function () {
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/cart.js'), 'utf8');
  assert.match(js, /optimisticAddProduct/);
  assert.match(js, /refreshCartChrome/);
  assert.match(js, /&lite=1/);
  assert.match(api, /packCartResponse\(system, result, \{ lite: true \}\)/);
  assert.match(api, /q\.lite === '1'/);
});
