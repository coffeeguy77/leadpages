'use strict';

/** Built-in /order page: the menu's "Order shop (full page)" link (api/render.js). */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test';
const { _orderShopPage } = require('../api/render.js');

test('/order becomes a page with only the Order app when the site has it', () => {
  const cfg = { business: 'Test Butchery', sections: { orderStorefront: { on: false, intro: 'Pick up in store.' } } };
  const p = _orderShopPage(cfg, 'order');
  assert.equal(p.slug, 'order');
  assert.equal(p.status, 'published');
  assert.deepEqual(p.pageApps, [{ key: 'orderStorefront', mode: 'shared' }]);
  assert.match(p.title, /Order online/);
  assert.match(p.title, /Test Butchery/);
  // The app is switched on for this request so the server mounts it…
  assert.equal(cfg.sections.orderStorefront.on, true);
});

test('no Order app, or another page name: no built-in page (stays 404)', () => {
  assert.equal(_orderShopPage({ sections: {} }, 'order'), null);
  assert.equal(_orderShopPage({}, 'order'), null);
  assert.equal(_orderShopPage({ sections: { orderStorefront: {} } }, 'about'), null);
});

test('the homepage config object is not changed in place', () => {
  const sec = { on: false };
  const cfg = { sections: { orderStorefront: sec } };
  _orderShopPage(cfg, 'ORDER');
  assert.equal(sec.on, false);
});
