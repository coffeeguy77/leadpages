/**
 * Promotions CTA: External URL opens in a new tab (_blank).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('manage promotions editor has External URL action + URL field', function () {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(manage, /\['url','External URL \(new tab\)'\]/);
  assert.match(manage, /pr-'\+i\+'-ctaurl'|pr-'\+i\+'-ctaurl/);
  assert.match(manage, /p\.cta\.url/);
  assert.match(manage, /_prDraw\(\)/);
});

test('marketplace promotions editor supports url CTA', function () {
  const ed = fs.readFileSync(path.join(root, 'assets/js/marketplace/promotions-editor.js'), 'utf8');
  assert.match(ed, /\['url',\s*'External URL \(new tab\)'\]/);
  assert.match(ed, /pr-ctaurl/);
  assert.match(ed, /p\.cta\.url\s*=\s*t\.value/);
});

test('trade + landing + demo render promo URL with target=_blank', function () {
  const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
  assert.match(trade, /a==='url'/);
  assert.match(trade, /promo-url/);
  assert.match(trade, /target="_blank"/);
  assert.match(trade, /p\.cta\.url/);

  const landing = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8')).html;
  assert.match(landing, /a==='url'/);
  assert.match(landing, /target="_blank"/);

  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(demo, /a==='url'/);
  assert.match(demo, /target="_blank"/);
  assert.match(demo, /noopener noreferrer/);
});

test('playground field defs include promotions cta.action and cta.url', function () {
  const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
  const promo = defs.promotions || [];
  const action = promo.find(function (f) { return f.key === 'sections.promotions.items.0.cta.action'; });
  const url = promo.find(function (f) { return f.key === 'sections.promotions.items.0.cta.url'; });
  assert.ok(action);
  assert.ok(action.options.some(function (o) { return o.value === 'url'; }));
  assert.ok(url);
});
