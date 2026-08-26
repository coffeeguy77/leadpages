/**
 * Marketplace V2 — Scrolling Sponsor Banner tests.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const md = require('../lib/marketplace-data');
const pp = require('../lib/playground-preset');

describe('Scrolling Sponsor Banner V2 preset', () => {
  it('bundles veterans cycling preset', () => {
    assert.ok(md.filePresets['ssb-veterans-cycling'], 'missing ssb-veterans-cycling preset');
    const preset = pp.normalizePreset(md.filePresets['ssb-veterans-cycling'], {
      slug: 'ssb-veterans-cycling',
      section_key: 'scrollingSponsorBanner',
      source: 'file'
    });
    assert.equal(preset.section_key, 'scrollingSponsorBanner');
    const ssb = preset.site_config.sections.scrollingSponsorBanner;
    assert.ok(ssb && ssb.on);
    assert.ok(Array.isArray(ssb.instances) && ssb.instances.length >= 1);
    const inst = ssb.instances[0];
    assert.equal(inst.heading.title, 'Sponsors');
    assert.match(inst.heading.eyebrow || '', /support our event/i);
    assert.ok(Array.isArray(inst.tiles) && inst.tiles.length >= 10);
    assert.equal(inst.motion.speedPxPerSec, 77);
  });

  it('metadata points at veterans preset', () => {
    assert.ok(md.scrollingSponsorBannerV2);
    assert.equal(md.scrollingSponsorBannerV2.appKey, 'scrollingSponsorBanner');
    assert.equal(md.scrollingSponsorBannerV2.defaultPlaygroundPreset, 'ssb-veterans-cycling');
    const ex = (md.scrollingSponsorBannerV2.examples || [])[0];
    assert.ok(ex);
    assert.equal(ex.presetSlug, 'ssb-veterans-cycling');
    assert.match(ex.businessName, /Veterans Cycling/i);
  });
});

describe('SSB marketplace assets', () => {
  it('demo embed uses veterans cycling config', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-scrollingSponsorBanner.html'), 'utf8');
    assert.match(demo, /Veterans Cycling/);
    assert.match(demo, /support our event/);
    assert.doesNotMatch(demo, /Harbour Club/);
    assert.doesNotMatch(demo, /Proudly supported by/);
    assert.match(demo, /speedPxPerSec: 77/);
    assert.match(demo, /raklox/);
    assert.match(demo, /KJR_Logo/);
  });

  it('marketplace feature defers scrolling-sponsor-banner to SSB v2', () => {
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /slug === 'scrolling-sponsor-banner'/);
    assert.doesNotMatch(feat, /__mpV2 && slug === 'scrolling-sponsor-banner'/);
    assert.match(feat, /LPScrollingSponsorBannerEditor/);
    assert.match(feat, /secKey === 'scrollingSponsorBanner'/);
  });

  it('playground editor exposes mount API and heading colours', () => {
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/scrolling-sponsor-banner-editor.js'), 'utf8');
    assert.match(editor, /LPScrollingSponsorBannerEditor/);
    assert.match(editor, /marketplace-playground/);
    assert.match(editor, /eyebrowColor/);
    assert.match(editor, /titleColor/);
    assert.match(editor, /introColor/);
    assert.match(editor, /LPLocalImage/);
  });

  it('manage editor promotes heading colour pickers', () => {
    const manage = fs.readFileSync(path.join(root, 'assets/js/marketplace/scrolling-sponsor-banner-manage.js'), 'utf8');
    assert.match(manage, /type="color"/);
    assert.match(manage, /Heading colours/);
    assert.match(manage, /wireColorField\('ssb-eyebrow-c'/);
    assert.doesNotMatch(manage, /<summary>Heading colours/);
  });

  it('SSB v2 page boots without marketplace V2 flag', () => {
    const v2 = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-feature-ssb-v2.js'), 'utf8');
    assert.doesNotMatch(v2, /if \(!v2On\(\) \|\| slug !== 'scrolling-sponsor-banner'/);
    assert.doesNotMatch(v2, /if \(!v2On\(\) \|\| !isSsb/);
    assert.match(v2, /slug !== 'scrolling-sponsor-banner'/);
  });
});
