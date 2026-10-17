'use strict';

/** Shop loads early, early category clicks stay on the page, links go to the shop page, Send to homepage. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('render starts the menu request in <head> on pages with the shop (homepage or landing page)', () => {
  const r = read('api/render.js');
  assert.match(r, /function withOrderPrefetch\(doc, slug\)/);
  assert.match(r, /window\.__lpOePre=\{url:u,p:fetch\(u\)/);
  assert.match(r, /if \(pageHasOrderStorefront\(_pageRow\)\) html = withOrderPrefetch\(html, site\.slug\);/);
  assert.match(r, /return withPrefetch\(ensureScript\(html\)\);/);
});

test('storefront uses the early request once, then fetches normally', () => {
  const js = read('assets/lp-order-storefront.js');
  assert.match(js, /function takePrefetch\(path, opts\)/);
  assert.match(js, /window\.__lpOePre = null;/);
  assert.match(js, /var pre = takePrefetch\(path, opts\);/);
});

test('storefront API reads only the config it needs, in parallel, with a short CDN cache', () => {
  const api = read('api/order/storefront.js');
  assert.match(api, /cfg_os:config->sections->orderStorefront,cfg_co:config->colorOverrides/);
  assert.doesNotMatch(api, /\.select\('id,slug,business_name,config'\)/);
  assert.match(api, /await Promise\.all\(\[categoriesPromise, productsPromise\]\)/);
  assert.match(api, /'public, s-maxage=15, stale-while-revalidate=45'/);
  assert.match(read('manage.html'), /\/api\/order\/storefront\?fresh=1&slug=/);
});

test('category links go to the shop page and early clicks stay on the page', () => {
  const l = read('assets/lp-layouts.js');
  assert.match(l, /function shopPageSlug\(\)/);
  assert.match(l, /withBase\('\/' \+ shop\) \+ q \+ '#lp-order-storefront'/);
  assert.match(l, /nu\.searchParams\.set\('cat', cat\); history\.replaceState/);
  assert.match(read('assets/lp-order-storefront.js'), /location\.hash === '#lp-order-storefront'/);
});

test('landing page apps can be sent to the homepage with an overwrite warning', () => {
  const m = read('manage.html');
  assert.match(m, /function lpPageAppSendHome\(secKey\)/);
  assert.match(m, /The homepage version\\u2019s content will be overwritten/);
  assert.match(m, /id="lpx-app-sendhome"/);
  assert.match(m, /class="btn ghost sm lp-app-send-home"/);
});
