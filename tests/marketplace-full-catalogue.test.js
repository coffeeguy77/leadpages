/**
 * Marketplace hub lists the full sell-templates catalogue with playground-ready apps.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
const sell = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/sell-templates.json'), 'utf8'));
const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));

function kebab(camel) {
  return String(camel).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

test('marketplace explore grid lists every sell-template app', () => {
  const sellKeys = Object.keys(sell);
  assert.ok(sellKeys.length >= 46, 'expected full catalogue');
  const grid = html.split('id="mp-tile-grid"')[1].split('id="mp-empty"')[0];
  const apps = [...grid.matchAll(/data-app="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(apps.length, sellKeys.length);
  for (const key of sellKeys) {
    const slug = key === 'emerg' ? 'emergency-cta' : kebab(key);
    // emerg tile uses href emergency-cta but data-app may be emergency-cta
    const dataApp = kebab(key);
    assert.ok(
      apps.includes(dataApp) || apps.includes(slug),
      'missing hub tile for ' + key
    );
  }
});

test('booking CTA has sell template, demo, defaults and field defs', () => {
  assert.ok(sell.bookingCta);
  assert.match(sell.bookingCta.name, /Booking CTA/i);
  assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-bookingCta.html')));
  assert.ok(defaults.bookingCta);
  assert.ok(defaults.bookingCta.bookingCta);
  assert.ok(Array.isArray(defs.bookingCta));
  assert.ok(defs.bookingCta.length >= 6);
  assert.ok(defs.bookingCta.some((f) => /ctaLabel/.test(f.key)));
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-bookingCta.html'), 'utf8');
  assert.match(demo, /data-sec="bookingCta"/);
  assert.match(demo, /lp-demo-config/);
});

test('customHtml playground defaults and editor fields exist', () => {
  assert.ok(defaults.customHtml);
  assert.ok(defs.customHtml.some((f) => f.key === 'sections.customHtml.html'));
  assert.ok(defs.customHtml.some((f) => f.key === 'theme.pipe'));
});

test('hub category filters cover new catalogue groups', () => {
  assert.match(html, /data-filter="heroes"/);
  assert.match(html, /data-filter="content"/);
  assert.match(html, /data-filter="proof"/);
  assert.match(html, /data-filter="platform"/);
  assert.match(html, /data-filter="reviews"/);
  assert.match(html, /data-sidebar-filter="heroes"/);
});
