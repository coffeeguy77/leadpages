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

test('order page banner: half-height Hero Slider with this page\'s eyebrow, title and photo', () => {
  const cfg = { sections: { orderStorefront: { pageBannerOn: true, pageBannerEyebrow: 'From farm to plate', pageBannerTitle: 'Place your order', pageBannerImage: 'https://x/y.jpg' } } };
  const p = _orderShopPage(cfg, 'order');
  assert.deepEqual(p.pageApps.map((a) => a.key), ['heroSlider', 'orderStorefront']);
  const hs = p.pageSections.heroSlider;
  assert.equal(hs.layout, 'half');
  assert.equal(hs.eyebrowPos, 'above');
  assert.equal(hs.slides[0].eyebrow, 'From farm to plate');
  assert.equal(hs.slides[0].heading, 'Place your order');
  assert.equal(hs.slides[0].imageUrl, 'https://x/y.jpg');
  // Off by default
  assert.equal(_orderShopPage({ sections: { orderStorefront: {} } }, 'order').pageSections, undefined);
});

test('order page banner: intro text and eyebrow / title / intro choices', () => {
  const sec = { pageBannerOn: true, pageBannerTitle: 'Order online', pageBannerIntro: 'Cut to order.', pageBannerShowEyebrow: false };
  const hs = _orderShopPage({ sections: { orderStorefront: sec } }, 'order').pageSections.heroSlider;
  assert.equal(hs.slides[0].subText, 'Cut to order.');
  assert.equal(hs.halfEyebrow, false);
  assert.equal(hs.halfTitle, true);
  assert.equal(hs.halfIntro, true);
  assert.equal(hs.layout, 'half');
});

test('half banner: intro shows by default and the banner grows instead of cropping', () => {
  const fs = require('fs'); const path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-layouts.css'), 'utf8');
  assert.match(js, /hsl-half-intro', half && HS\.halfIntro !== false/);
  assert.match(css, /hsl-half \.hsl\{--hsl-half-h:[^}]*height:auto!important;min-height:var\(--hsl-half-h\)/);
});
