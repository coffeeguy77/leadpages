const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  inferDisplayMode,
  displayPx,
  publicChoiceFields,
  normalizeImageScale
} = require('../../lib/quote-system/display');

test('inferDisplayMode — explicit and inferred', function() {
  assert.equal(inferDisplayMode({ displayMode: 'text', icon: 'coffee' }), 'text');
  assert.equal(inferDisplayMode({ imageUrl: 'https://x/img.jpg' }), 'image');
  assert.equal(inferDisplayMode({ icon: 'truck' }), 'icon');
  assert.equal(inferDisplayMode({ label: 'Only text' }), 'text');
});

test('displayPx — size and scale', function() {
  assert.equal(displayPx('standard', 100), 80);
  assert.equal(displayPx('large', 150), 180);
  assert.equal(displayPx('compact', 200), 112);
});

test('normalizeImageScale — clamps', function() {
  assert.equal(normalizeImageScale(300), 250);
  assert.equal(normalizeImageScale(10), 50);
});

test('publicChoiceFields — hides image when text mode', function() {
  var out = publicChoiceFields({
    displayMode: 'text',
    imageUrl: 'https://x/a.jpg',
    icon: 'coffee'
  });
  assert.equal(out.displayMode, 'text');
  assert.equal(out.imageUrl, null);
  assert.equal(out.icon, null);
});

test('publicChoiceFields — image mode exposes url and scale', function() {
  var out = publicChoiceFields({
    displayMode: 'image',
    imageUrl: 'https://x/a.jpg',
    imageSize: 'hero',
    imageScale: 125
  });
  assert.equal(out.imageUrl, 'https://x/a.jpg');
  assert.equal(out.imageSize, 'hero');
  assert.equal(out.imageScale, 125);
});
