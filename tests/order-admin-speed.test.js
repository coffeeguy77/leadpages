'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('orders admin warms catalog cache and supports copy-to-new-order', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /warmCatalogCache/);
  assert.match(html, /CATALOG_CACHE_TTL_MS/);
  assert.match(html, /copyOrderToNewOrder/);
  assert.match(html, /data-act="copy-new"/);
  assert.match(html, /data-copy-order/);
  assert.match(html, /applyNoCopyPrefill/);
  assert.match(html, /Promise\.all\(\[[\s\S]*api\('\/api\/order\/orders/);
});

test('customers API supports lite list without backfill', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'api', 'order', 'customers.js'), 'utf8');
  assert.match(js, /liteList/);
  assert.match(js, /liteList\)/);
  assert.match(js, /lite === '1'/);
});

test('manage prefetches orders embed for trade sites', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.match(html, /prefetchOrdersEmbed/);
  assert.match(html, /ordEmbedWarmedSiteId/);
});
