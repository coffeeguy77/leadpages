'use strict';

/**
 * Image library (per site) + farm/provenance layouts: trust bar stacked, services feature,
 * CTA boxes, How it works milestone, product cards (Order shop category links), text box bleed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');
const lib = require('../api/cloudinary/library.js');

test('library: site folders and in-use check ignore stale *_pid keys', () => {
  assert.deepEqual(lib._sitePrefixes({ id: 'ABC-1', slug: 'grif' }), ['leadpages/abc-1/', 'leadpages/grif/']);
  const cfg = { sections: { a: { img: 'https://x/upload/v1/leadpages/s/a/one.jpg', img_pid: 'leadpages/s/b/old' } } };
  assert.equal(lib._inUse(cfg, 'leadpages/s/a/one'), true);
  assert.equal(lib._inUse(cfg, 'leadpages/s/b/old'), false);
  assert.equal(lib._inUse(cfg, ''), false);
});

test('library: unauthenticated requests are refused', async () => {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await lib({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('editor: Library button on image fields, manager in Branding, deletes only unused images', () => {
  assert.match(manage, /class="btn ghost cw-lib"/);
  assert.match(manage, /function cwLibOpen\(onPick\)/);
  assert.match(manage, /\/api\/cloudinary\/library/);
  assert.match(manage, /id="lp-imglib-open"/);
  const del = manage.slice(manage.indexOf('async function cwDelete(publicId)'), manage.indexOf('async function cwDeletePrefix'));
  assert.match(del, /if\(cwImageInUse\(publicId\)\) return;/);
});

test('layouts are drawn, styled and opt-in', () => {
  for (const [fn, cls] of [['trustBar', 'tb-stacked'], ['servicesFeature', 'svcs-feature'], ['ctaBoxes', 'cb-boxes'], ['spMilestone', 'sp-milestone'], ['projectsShop', 'fp-shop'], ['textBleed', 'tbx-bleed']]) {
    assert.match(js, new RegExp('function ' + fn + '\\('), fn);
    assert.match(css, new RegExp('\\.' + cls), cls);
  }
  assert.match(js, /faq, trustBar, mapHours, ctaBanner,/);
  for (const k of ["'stacked'", "'feature'", "'boxes'", "'milestone'", "'shop'", "'bleed'"]) assert.ok(manage.indexOf(k) >= 0, k);
  assert.match(manage, /servicesFeatureItems:\{secId:'services',key:'featureItems'/);
  assert.match(manage, /ctaBannerBoxes:\{secId:'ctaBanner',key:'boxes'/);
  assert.match(manage, /type:'orderCat'/);
});

test('page links keep the site address; product cards open an Order shop category', () => {
  const sandbox = { window: {}, document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, documentElement: { classList: { toggle() {}, add() {}, remove() {} }, style: { setProperty() {}, removeProperty() {} } } }, location: { pathname: '/griffithbutchery/bellevue', search: '' }, getComputedStyle() { return {}; }, setTimeout() {} };
  sandbox.window.__lpLiveCfg = { pages: [{ slug: 'bellevue' }] };
  sandbox.window.addEventListener = function () {};
  const src = js.replace(/\}\)\(\);?\s*$/, ';window.__t={hrefOf:hrefOf,orderCatHref:orderCatHref};})();');
  vm.runInNewContext(src, sandbox);
  const t = sandbox.window.__t;
  assert.ok(t, 'helpers exposed');
  assert.equal(t.hrefOf('/online-butcher-canberra'), '/griffithbutchery/online-butcher-canberra');
  assert.equal(t.hrefOf('/griffithbutchery/x'), '/griffithbutchery/x');
  assert.equal(t.hrefOf('#quote'), '#quote');
  assert.equal(t.orderCatHref('beef'), '/griffithbutchery/order?cat=beef');
});

test('order shop reads ?cat= to open a category', () => {
  const sf = read('assets/lp-order-storefront.js');
  assert.match(sf, /categoryFromUrl = function/);
  assert.match(sf, /var linkedCat = this\.categoryFromUrl\(\);/);
  assert.match(read('api/render.js'), /lp-order-storefront\.js\?v=oe-21/);
});

test('trust bar stacked: items per row (default one line), phone rows, spacing', () => {
  assert.match(js, /if \(!\(per >= 1 && per <= 12\)\) per = items\.length;/);
  assert.match(js, /tbs-rsm/);
  assert.match(css, /tbs-sp-compact\{--tbs-py:12px/);
  assert.match(manage, /k:'stackPerRow',label:'Items per row'/);
  assert.match(manage, /k:'stackSpacing',label:'Spacing'/);
});

test('trust bar items can open an Order shop category, switched in place when the shop is on the page', () => {
  assert.match(manage, /\['orderCat','Order shop category'\]/);
  assert.match(manage, /\{k:'orderCategory',label:'Order shop category',type:'orderCat'\}/);
  assert.match(manage, /show\('orderCategory',act==='orderCat'\);/);
  assert.match(js, /act === 'orderCat' && txt\(b\.orderCategory\)/);
  assert.match(js, /app\.openCategory\(cat\)/);
  const sf = read('assets/lp-order-storefront.js');
  assert.match(sf, /OrderStorefront\.prototype\.openCategory = function/);
  const tpl = JSON.parse(read('trade.template.json')).html;
  assert.match(tpl, /if\(act==='orderCat'\)\{ var oc=String\(b\.orderCategory/);
});

test('image library: transparent images on a light checkerboard, not cropped, with fallback', () => {
  const m = require('fs').readFileSync(require('path').join(__dirname, '..', 'manage.html'), 'utf8');
  assert.match(m, /function cwLibClear\(it\)/);
  assert.match(m, /clear\?'\/upload\/c_limit,w_320,h_240,f_png\/'/);
  assert.match(m, /#cwlib \.cwl-img\.cwl-clear\{background:#fff repeating-conic-gradient/);
  assert.match(m, /onerror="if\(this\.dataset\.full/);
});
