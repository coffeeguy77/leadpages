/**
 * Promotions & Offers must appear in the in-app App Marketplace as sections.promotions,
 * matching the public hub at /marketplace/promotions (not stale hero/inline split apps).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('api-apps auto-registers / heals Promotions & Offers', function () {
  const apiApps = fs.readFileSync(path.join(root, 'api/api-apps.js'), 'utf8');
  assert.match(apiApps, /ensurePromotionsApp/);
  assert.match(apiApps, /section_key:\s*'promotions'/);
  assert.match(apiApps, /slug:\s*'promotions'/);
  assert.match(apiApps, /name:\s*'Promotions & Offers'/);
  assert.match(apiApps, /builder_visible:\s*true/);
  assert.match(apiApps, /await ensurePromotionsApp\(\)/);
  assert.match(apiApps, /promotions-hero/);
  assert.match(apiApps, /promotions-inline/);
});

test('manage injects Promotions & Offers and hides stale split apps', function () {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(manage, /function _aaInjectBuiltinApps/);
  assert.match(manage, /section_key:'promotions'/);
  assert.match(manage, /name:'Promotions & Offers'/);
  assert.match(manage, /promotions-hero/);
  assert.match(manage, /promotions-inline/);
  assert.match(manage, /'promotions':'megaphone'/);
  assert.match(manage, /function _ampAppVisible/);
  assert.match(manage, /builder_visible===false/);
});

test('public marketplace + sell template use promotions section_key', function () {
  const hub = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
  assert.match(hub, /href="\/marketplace\/promotions"/);
  assert.match(hub, /Promotions & Offers/);
  const sell = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/sell-templates.json'), 'utf8'));
  assert.ok(sell.promotions);
  assert.equal(sell.promotions.name, 'Promotions & Offers');
  const playground = (sell.promotions.blocks || []).find(function(b) { return b.block_type === 'playground'; });
  assert.ok(playground);
  assert.equal(playground.payload.section_key, 'promotions');
});

test('ops seed + register scripts exist', function () {
  assert.ok(fs.existsSync(path.join(root, 'scripts/seed-promotions-app.sql')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/register-promotions-app.js')));
  const seed = fs.readFileSync(path.join(root, 'scripts/seed-promotions-app.sql'), 'utf8');
  assert.match(seed, /Promotions & Offers/);
  assert.match(seed, /section_key/);
  assert.match(seed, /promotions-hero/);
  const reg = fs.readFileSync(path.join(root, 'scripts/register-promotions-app.js'), 'utf8');
  assert.match(reg, /SECTION_KEY = 'promotions'/);
  assert.match(reg, /promotions-hero/);
});
