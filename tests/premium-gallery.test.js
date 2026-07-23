'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_PREMIUM_GALLERY,
  cloneDefaultPremiumGallery,
  SMART_PRESETS,
  applySmartPreset,
  regenerateMosaicLayout
} = require('../lib/premium-gallery-defaults');
const { SECTION_CATEGORY } = require('../lib/marketplace-categories');
const { OPTIONAL_SECTIONS, OFF_BY_DEFAULT } = require('../lib/section-order');
const adapters = require('../lib/website-composer/adapters/registry');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const demoShared = fs.readFileSync(
  path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'),
  'utf8'
);
const events = fs.readFileSync(path.join(__dirname, '..', 'api/events.js'), 'utf8');
const catalogue = fs.readFileSync(
  path.join(__dirname, '..', 'lib/website-composer/marketplace/catalogue-data.json'),
  'utf8'
);
const appMeta = fs.readFileSync(
  path.join(__dirname, '..', 'lib/website-composer/marketplace/app-metadata.js'),
  'utf8'
);

describe('Premium Gallery marketplace app', () => {
  it('ships defaults with mixed-orientation sample images', () => {
    assert.equal(DEFAULT_PREMIUM_GALLERY.layout, 'smart-mosaic');
    assert.equal(DEFAULT_PREMIUM_GALLERY.mosaicLocked, true);
    assert.equal(DEFAULT_PREMIUM_GALLERY.urlMode, 'hash');
    assert.equal(DEFAULT_PREMIUM_GALLERY.analyticsOn, true);
    assert.ok(DEFAULT_PREMIUM_GALLERY.virtualizeAt >= 24);
    assert.ok(DEFAULT_PREMIUM_GALLERY.images.length >= 8);
  });

  it('is registered in Images & Media upper zone', () => {
    assert.equal(SECTION_CATEGORY.premiumGallery, 'images-media');
    assert.ok(OPTIONAL_SECTIONS.includes('premiumGallery'));
    assert.ok(OFF_BY_DEFAULT.includes('premiumGallery'));
  });

  it('wires manage editor + bulk upload + mosaic lock', () => {
    assert.match(manage, /sub==='premiumGallery'/);
    assert.match(manage, /Smart preset/);
    assert.match(manage, /pg-mosaic-regen/);
    assert.match(manage, /pg-up-folder/);
    assert.match(manage, /pg-up-zip/);
    assert.match(manage, /function cwPickMany/);
    assert.match(manage, /function cwExpandImageFiles/);
    assert.match(manage, /URL mode/);
    assert.match(manage, /Virtualise after/);
    assert.match(manage, /value="collage"/);
    assert.match(manage, /value="random-mosaic"/);
  });

  it('renders collage, SEO paths, analytics and virtualisation helpers', () => {
    assert.match(demoShared, /function _pgRenderPremiumGallery/);
    assert.match(demoShared, /_pgWriteUrlState/);
    assert.match(demoShared, /_pgTrack/);
    assert.match(demoShared, /gallery_lightbox/);
    assert.match(demoShared, /IntersectionObserver/);
    assert.match(demoShared, /pg-collage/);
    assert.match(demoShared, /virtualizeAt/);
    assert.match(demoShared, /_pgApplySmartPreset/);
  });

  it('allows gallery analytics events server-side', () => {
    assert.match(events, /gallery_impression/);
    assert.match(events, /gallery_lightbox/);
    assert.match(events, /gallery_filter/);
    assert.match(events, /gallery_load_more/);
  });

  it('exposes Website Studio smart presets + adapter', () => {
    assert.ok(SMART_PRESETS.clean);
    assert.ok(SMART_PRESETS.cinematic);
    assert.ok(SMART_PRESETS.collage);
    const applied = applySmartPreset({ heading: 'X' }, 'editorial');
    assert.equal(applied.layout, 'editorial');
    assert.equal(applied.smartPreset, 'editorial');
    const mosaic = regenerateMosaicLayout(cloneDefaultPremiumGallery().images, 42);
    assert.equal(mosaic.mosaicSeed, 42);
    assert.equal(mosaic.mosaicLocked, true);
    assert.ok(mosaic.mosaicLayout.length >= 8);

    const adapted = adapters.ADAPTERS.premiumGallery({
      heading: 'Studio gallery',
      smartPreset: 'cinematic',
      images: [
        { title: 'One', src: 'https://example.com/1.jpg' },
        { title: 'Two', src: 'https://example.com/2.jpg' },
        { title: 'Three', src: 'https://example.com/3.jpg' },
        { title: 'Four', src: 'https://example.com/4.jpg' }
      ]
    });
    assert.equal(adapted.ok, true);
    assert.equal(adapted.sectionKey, 'premiumGallery');
    assert.equal(adapted.config.smartPreset, 'cinematic');
    assert.match(catalogue, /"appId": "premiumGallery"/);
    assert.match(appMeta, /premiumGallery:\s*meta\(/);
  });
});
