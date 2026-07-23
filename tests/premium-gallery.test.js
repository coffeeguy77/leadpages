'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_PREMIUM_GALLERY,
  cloneDefaultPremiumGallery,
  SAMPLE_IMAGES
} = require('../lib/premium-gallery-defaults');
const { SECTION_CATEGORY, CATEGORIES } = require('../lib/marketplace-categories');
const { OPTIONAL_SECTIONS, OFF_BY_DEFAULT } = require('../lib/section-order');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const demoShared = fs.readFileSync(
  path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'),
  'utf8'
);
const appContent = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'marketplace/app-content.json'), 'utf8')
);
const catalogSeed = fs.readFileSync(
  path.join(__dirname, '..', 'lib/marketplace-catalog-seed.js'),
  'utf8'
);

describe('Premium Gallery marketplace app', () => {
  it('ships defaults with mixed-orientation sample images', () => {
    assert.equal(DEFAULT_PREMIUM_GALLERY.layout, 'smart-mosaic');
    assert.equal(DEFAULT_PREMIUM_GALLERY.density, 'balanced');
    assert.equal(DEFAULT_PREMIUM_GALLERY.columnsDesktop, 4);
    assert.ok(SAMPLE_IMAGES.length >= 8);
    const orients = new Set(SAMPLE_IMAGES.map((i) => i.orientation));
    assert.ok(orients.has('portrait'));
    assert.ok(orients.has('landscape'));
    const copy = cloneDefaultPremiumGallery();
    copy.heading = 'Changed';
    assert.notEqual(copy.heading, DEFAULT_PREMIUM_GALLERY.heading);
  });

  it('is registered in Images & Media upper zone', () => {
    assert.equal(SECTION_CATEGORY.premiumGallery, 'images-media');
    assert.ok(CATEGORIES.some((c) => c.slug === 'images-media'));
    assert.ok(OPTIONAL_SECTIONS.includes('premiumGallery'));
    assert.ok(OFF_BY_DEFAULT.includes('premiumGallery'));
    assert.match(catalogSeed, /premiumGallery:\s*'upper'/);
    assert.equal(appContent.premiumGallery.name, 'Premium Gallery');
  });

  it('wires manage editor + trade allowlists', () => {
    assert.match(manage, /\['premiumGallery','Premium Gallery'\]/);
    assert.match(manage, /premiumGalleryImages:/);
    assert.match(manage, /sub==='premiumGallery'/);
    assert.match(manage, /Structure mode/);
    assert.match(manage, /Smart mosaic/);
    assert.match(manage, /OFF_BY_DEFAULT_SECTIONS=\[[^\]]*premiumGallery/);
    assert.match(manage, /OPTIONAL_COMPONENTS=\[[^\]]*premiumGallery/);
  });

  it('renders via demo-shared applyCfg helpers', () => {
    assert.match(demoShared, /function _pgRenderPremiumGallery/);
    assert.match(demoShared, /data-sec="premiumGallery"/);
    assert.match(demoShared, /SEC\.premiumGallery/);
    assert.match(demoShared, /premiumGallery:'Premium Gallery'/);
  });
});
