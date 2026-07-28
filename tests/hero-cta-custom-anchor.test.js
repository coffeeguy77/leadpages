'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');

test('Hero CTA editor supports Custom anchor section picker', function () {
  assert.match(manage, /HERO_CTA_SCROLL_TARGETS/);
  assert.match(manage, /Custom anchor \(section\)/);
  assert.match(manage, /id="hcta-quoteTarget"/);
  assert.match(manage, /id="hcta-callTarget"/);
  assert.match(manage, /quoteTarget/);
  assert.match(manage, /callTarget/);
  assert.match(manage, /customHtml','Custom HTML/);
  assert.match(manage, /onlineQuote','Online Quote/);
});

test('Hero Slider schema includes scroll action + section targets', function () {
  assert.match(manage, /\['scroll','Custom anchor'\]/);
  assert.match(manage, /primaryCtaTarget/);
  assert.match(manage, /secondaryCtaTarget/);
});

test('demo-shared scrolls to data-sec and records cta_click', function () {
  assert.match(demo, /a==='scroll'/);
  assert.match(demo, /hsl-cta-scroll/);
  assert.match(demo, /__lpBindScrollCta/);
  assert.match(demo, /trackEvent\('cta_click'/);
  assert.match(demo, /\[data-sec="/);
  assert.match(demo, /quoteAction==='scroll'/);
  assert.match(demo, /callAction==='scroll'/);
});
