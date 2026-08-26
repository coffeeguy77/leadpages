/**
 * Scrolling Sponsor Banner — marketplace registration, config helpers, manage wiring.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ssb = require('../lib/scrolling-sponsor-banner');

test('lib defaults and normalisation', function () {
  const sec = ssb.normalizeSection({});
  assert.equal(sec.on, false);
  assert.ok(Array.isArray(sec.instances));
  assert.ok(sec.instances.length >= 1);
  assert.equal(sec.instances[0].motion.speedPxPerSec, 40);
  assert.equal(sec.instances[0].layout.imageFit, 'contain');

  const bad = ssb.normalizeTile({ linkUrl: 'javascript:alert(1)', linkEnabled: true });
  assert.equal(bad.linkUrl, '');
  assert.equal(ssb.isSafeHttpUrl('https://example.com/x'), true);
  assert.equal(ssb.isSafeHttpUrl('ftp://x'), false);
});

test('schedule statuses', function () {
  const now = Date.parse('2026-06-15T12:00:00Z');
  assert.equal(ssb.tileScheduleStatus({ enabled: false }, now), 'hidden');
  assert.equal(ssb.tileScheduleStatus({ enabled: true, startAt: '2026-07-01T00:00:00Z' }, now), 'scheduled');
  assert.equal(ssb.tileScheduleStatus({ enabled: true, endAt: '2026-01-01T00:00:00Z' }, now), 'expired');
  assert.equal(ssb.tileScheduleStatus({ enabled: true }, now), 'active');
  const dup = ssb.duplicateTile({ id: 'a', name: 'Logo', image: 'https://x/y.png' });
  assert.notEqual(dup.id, 'a');
  assert.match(dup.name, /copy/i);
});

test('api-apps auto-registers Scrolling Sponsor Banner', function () {
  const apiApps = fs.readFileSync(path.join(root, 'api/api-apps.js'), 'utf8');
  assert.match(apiApps, /ensureScrollingSponsorBannerApp/);
  assert.match(apiApps, /section_key:\s*'scrollingSponsorBanner'/);
  assert.match(apiApps, /slug:\s*'scrolling-sponsor-banner'/);
  assert.match(apiApps, /await ensureScrollingSponsorBannerApp\(\)/);
});

test('manage injects app, editor scripts and subtab', function () {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(manage, /section_key:'scrollingSponsorBanner'/);
  assert.match(manage, /name:'Scrolling Sponsor Banner'/);
  assert.match(manage, /\['scrollingSponsorBanner','Scrolling Sponsor Banner'\]/);
  assert.match(manage, /sub==='scrollingSponsorBanner'/);
  assert.match(manage, /LpSsbManage\.render/);
  assert.match(manage, /lp-scrolling-sponsor-banner\.js/);
  assert.match(manage, /scrolling-sponsor-banner-manage\.js/);
  assert.match(manage, /'scrollingSponsorBanner':'layers'/);
  assert.ok(manage.includes("'scrollingSponsorBanner'") || manage.includes('scrollingSponsorBanner'));
});

test('section order lists optional + off-by-default', function () {
  const so = require('../lib/section-order');
  assert.ok(so.OPTIONAL_SECTIONS.indexOf('scrollingSponsorBanner') >= 0);
  assert.ok(so.OFF_BY_DEFAULT.indexOf('scrollingSponsorBanner') >= 0);
});

test('trade template has shell, assets and hydrate', function () {
  const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8'));
  const html = tpl.html || '';
  assert.match(html, /data-sec="scrollingSponsorBanner"/);
  assert.match(html, /lp-scrolling-sponsor-banner\.css/);
  assert.match(html, /lp-scrolling-sponsor-banner\.js/);
  assert.match(html, /LpScrollingSponsorBanner\.mount/);
});

test('public marketplace + sell template use scrollingSponsorBanner', function () {
  const hub = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
  assert.match(hub, /href="\/marketplace\/scrolling-sponsor-banner"/);
  assert.match(hub, /Scrolling Sponsor Banner/);
  const sell = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/sell-templates.json'), 'utf8'));
  assert.ok(sell.scrollingSponsorBanner);
  assert.equal(sell.scrollingSponsorBanner.name, 'Scrolling Sponsor Banner');
  const playground = (sell.scrollingSponsorBanner.blocks || []).find(function (b) {
    return b.block_type === 'playground';
  });
  assert.ok(playground);
  assert.equal(playground.payload.section_key, 'scrollingSponsorBanner');
});

test('ops seed + register scripts exist', function () {
  assert.ok(fs.existsSync(path.join(root, 'scripts/seed-scrolling-sponsor-banner-app.sql')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/register-scrolling-sponsor-banner-app.js')));
  const seed = fs.readFileSync(path.join(root, 'scripts/seed-scrolling-sponsor-banner-app.sql'), 'utf8');
  assert.match(seed, /Scrolling Sponsor Banner/);
  assert.match(seed, /scrollingSponsorBanner/);
  const reg = fs.readFileSync(path.join(root, 'scripts/register-scrolling-sponsor-banner-app.js'), 'utf8');
  assert.match(reg, /SECTION_KEY = 'scrollingSponsorBanner'/);
});

test('renderer + manage assets expose APIs', function () {
  const js = fs.readFileSync(path.join(root, 'assets/lp-scrolling-sponsor-banner.js'), 'utf8');
  assert.match(js, /LpScrollingSponsorBanner/);
  assert.match(js, /preview/);
  assert.match(js, /cta_click/);
  assert.match(js, /scrollingSponsorBanner/);
  const manageJs = fs.readFileSync(path.join(root, 'assets/js/marketplace/scrolling-sponsor-banner-manage.js'), 'utf8');
  assert.match(manageJs, /LpSsbManage/);
  assert.match(manageJs, /scrolling-banner/);
  assert.match(manageJs, /Bulk upload/);
});

test('marketplace category mapping', function () {
  const cats = require('../lib/marketplace-categories');
  assert.equal(cats.categoryForSection('scrollingSponsorBanner'), 'trust-conversion');
});
