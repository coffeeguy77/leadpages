/**
 * About Us visibility + How It Works circle/arrow options.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

function tradeHtml() {
  return JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
}

test('aboutUs is mounted in trade + landing templates after merge-safe patch', function () {
  ['trade.template.json', 'landing-shell-neutral-v1.template.json'].forEach(function (name) {
    const html = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')).html;
    assert.match(html, /data-sec="aboutUs"/, name);
    assert.match(html, /section\[data-sec="aboutUs"\]\{display:none\}/, name + ' inline hide');
    assert.match(html, /lp-about-us\.css/, name);
    assert.match(html, /lp-about-us\.js/, name);
    assert.match(html, /lpApplyAboutUs/, name);
    assert.match(html, /'textBox','aboutUs'/, name + ' visibility');
  });
  assert.ok(fs.existsSync(path.join(root, 'assets/lp-about-us.js')));
  assert.ok(fs.existsSync(path.join(root, 'assets/lp-about-us.css')));
});

test('How It Works number circles default without drop shadow', function () {
  const html = tradeHtml();
  assert.match(html, /\.sp-num\{[^}]*box-shadow:none/);
  assert.match(html, /sp-circle-shadow/);
  assert.match(manage, /circleShadowOn:false/);
  assert.match(manage, /id="sp-circle-shadow"/);
  assert.match(manage, /Drop shadow on circles/);
});

test('How It Works supports padded numbers 01 02 03', function () {
  const html = tradeHtml();
  assert.match(html, /_spNumLabel/);
  assert.match(html, /numberFormat==='padded'/);
  assert.match(manage, /id="sp-numfmt"/);
  assert.match(manage, /01, 02, 03/);
});

test('How It Works circle stroke size + colour controls', function () {
  const html = tradeHtml();
  assert.match(html, /circleStrokeOn/);
  assert.match(html, /--sp-num-stroke/);
  assert.match(html, /--sp-num-stroke-w/);
  assert.match(manage, /id="sp-circle-stroke-on"/);
  assert.match(manage, /id="sp-circle-stroke-w"/);
  assert.match(manage, /Stroke around number circle/);
});

test('How It Works arrows stay visible on mobile and honour colour', function () {
  const html = tradeHtml();
  assert.match(html, /keep arrows \(smaller\)/);
  assert.doesNotMatch(
    html,
    /@media\(max-width:900px\)\{[\s\S]{0,280}\.sp-arrow\{display:none!important\}/
  );
  assert.match(html, /querySelectorAll\('\.sp-arrow svg'\)/);
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(demo, /circleStrokeOn/);
  assert.match(demo, /_spNumLabel/);
});
