'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  sectionToAppearance,
  resolveStorefrontAppearance
} = require('../lib/order/storefront-appearance');
const { applyColorOverridesToHtml } = require('../lib/color-overrides');

test('resolveStorefrontAppearance prefers page editor section colours', function () {
  var appearance = resolveStorefrontAppearance(
    { appearance: { accent: '#111111', text: '#222222' } },
    {
      sections: {
        orderStorefront: { accent: '#abcdef', text: '#fedcba', btnBg: '#010203' }
      }
    }
  );
  assert.equal(appearance.accent, '#abcdef');
  assert.equal(appearance.text, '#fedcba');
  assert.equal(appearance.btn_bg, '#010203');
});

test('resolveStorefrontAppearance remaps via colorOverrides', function () {
  var appearance = resolveStorefrontAppearance(
    { appearance: {} },
    {
      colorOverrides: [{ from: '#ff00aa', to: '#00aa55' }],
      sections: {
        orderStorefront: { accent: '#ff00aa', cardBg: '#ffffff' }
      }
    }
  );
  assert.equal(appearance.accent, '#00aa55');
  assert.equal(appearance.card_bg, '#ffffff');
});

test('colorOverrides remap injected order storefront section styles', function () {
  var html =
    '<section data-sec="orderStorefront" style="background:#ff00aa;--lp-oe-accent:#ff00aa">' +
    '<div id="lp-order-storefront"></div></section>';
  var out = applyColorOverridesToHtml(html, [{ from: '#ff00aa', to: '#112233' }]);
  assert.match(out, /background:#112233/);
  assert.match(out, /--lp-oe-accent:#112233/);
  assert.doesNotMatch(out, /#ff00aa/i);
});

test('demo-shared applyCfg shows and boots orderStorefront', function () {
  var js = fs.readFileSync(path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(js, /'onlineQuote','orderStorefront','bookingStorefront','customHtml'/);
  assert.match(js, /SEC\.orderStorefront/);
  assert.match(js, /LPOrderStorefront\.scan/);
  assert.match(js, /--lp-oe-accent/);
});

test('storefront applyAppearance prefers section CSS vars', function () {
  var js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(js, /sectionVar\('--lp-oe-accent'\)/);
  assert.match(js, /Only trust inline section styles/);
  assert.match(js, /__lpOeApp/);
});

test('render reapplies color overrides after order storefront inject', function () {
  var render = fs.readFileSync(path.join(__dirname, '..', 'api/render.js'), 'utf8');
  var injectAt = render.indexOf('injectOrderStorefront');
  var reapplyAt = render.indexOf('Colour overrides run again after dynamic injects');
  assert.ok(injectAt > 0);
  assert.ok(reapplyAt > injectAt);
  assert.match(render, /lp-order-storefront\.js\?v=oe-17/);
});
