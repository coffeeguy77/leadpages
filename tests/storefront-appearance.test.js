'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sectionToAppearance,
  mergeStorefront,
  normalizeStorefrontSettings,
  normalizeCutoffMode,
  hexOk
} = require('../lib/order/storefront-appearance');

test('normalizeCutoffMode maps legacy weekday_time to weekday_rule', function () {
  assert.equal(normalizeCutoffMode('weekday_time'), 'weekday_rule');
  assert.equal(normalizeCutoffMode('weekday_rule'), 'weekday_rule');
  assert.equal(normalizeCutoffMode('days_before'), 'days_before');
  assert.equal(normalizeCutoffMode(''), '');
});

test('sectionToAppearance maps page editor fields', function () {
  var a = sectionToAppearance({
    accent: '#112233',
    cardBg: '#aabbcc',
    cardBorder: '#ddeeff',
    text: '#010203',
    muted: '#040506',
    btnBg: '#070809',
    btnText: '#0a0b0c',
    inputBg: '#0d0e0f',
    inputBorder: '#101112',
    bg: '#131415',
    maxWidth: 1200,
    padding: 20,
    radius: 8
  });
  assert.equal(a.accent, '#112233');
  assert.equal(a.card_bg, '#aabbcc');
  assert.equal(a.card_border, '#ddeeff');
  assert.equal(a.page_bg, '#131415');
  assert.equal(a.max_width, 1200);
  assert.equal(a.padding, 20);
  assert.equal(a.radius, 8);
});

test('sectionToAppearance ignores invalid hex', function () {
  var a = sectionToAppearance({ accent: 'red', maxWidth: 'wide' });
  assert.equal(a.accent, undefined);
  assert.equal(a.max_width, undefined);
});

test('mergeStorefront deep-merges appearance', function () {
  var merged = mergeStorefront(
    { shop_mode: 'fast', appearance: { accent: '#111111', text: '#222222' } },
    { appearance: { accent: '#333333', btn_bg: '#444444' } }
  );
  assert.equal(merged.shop_mode, 'fast');
  assert.equal(merged.staff_order_mode, 'fast');
  assert.equal(merged.appearance.accent, '#333333');
  assert.equal(merged.appearance.text, '#222222');
  assert.equal(merged.appearance.btn_bg, '#444444');
});

test('normalizeStorefrontSettings preserves customer shop_mode and forces staff fast', function () {
  assert.deepEqual(normalizeStorefrontSettings({ shop_mode: 'fast', staff_order_mode: 'traditional' }), {
    shop_mode: 'fast',
    staff_order_mode: 'fast'
  });
  assert.deepEqual(normalizeStorefrontSettings({ shop_mode: 'traditional', staff_order_mode: 'traditional' }), {
    shop_mode: 'traditional',
    staff_order_mode: 'fast'
  });
  assert.deepEqual(normalizeStorefrontSettings(null), {
    shop_mode: 'fast',
    staff_order_mode: 'fast'
  });
  assert.deepEqual(normalizeStorefrontSettings({}), {
    shop_mode: 'fast',
    staff_order_mode: 'fast'
  });
});

test('hexOk validates six-digit hex', function () {
  assert.equal(hexOk('#aabbcc'), true);
  assert.equal(hexOk('#AABBCC'), true);
  assert.equal(hexOk('aabbcc'), false);
  assert.equal(hexOk('#abc'), false);
});
