/**
 * Marketplace V2 — Trust Bar reference implementation tests.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const flags = require('../lib/marketplace-v2-flags');
const access = require('../lib/marketplace-access');
const md = require('../lib/marketplace-data');
const pp = require('../lib/playground-preset');

describe('marketplace V2 flags', () => {
  it('exposes expected flag keys', () => {
    assert.ok(flags.FLAG_KEYS.includes('APP_MARKETPLACE_V2'));
    assert.ok(flags.FLAG_KEYS.includes('APP_MARKETPLACE_PLAYGROUND'));
    assert.ok(flags.FLAG_KEYS.includes('APP_MARKETPLACE_THEME_INHERITANCE'));
  });

  it('flagsScriptTag emits injectable JSON', () => {
    const html = flags.flagsScriptTag({
      APP_MARKETPLACE_V2: true,
      APP_DEMO_PAGES: false,
      APP_DEMO_PRESETS: false,
      APP_DEMO_BUILDER: false,
      APP_MARKETPLACE_PLAYGROUND: true,
      APP_MARKETPLACE_ACCESS_LABELS: true,
      APP_MARKETPLACE_PREMIUM: false,
      APP_MARKETPLACE_THEME_INHERITANCE: true
    });
    assert.match(html, /__LP_MARKETPLACE_FLAGS__/);
    assert.match(html, /"APP_MARKETPLACE_V2":true/);
  });
});

describe('marketplace access labels', () => {
  it('maps Trust Bar to included', () => {
    assert.equal(access.accessForSection('trustBar'), 'included');
    assert.equal(access.publicLabel('included', 'long'), 'Included with your LeadPages website');
  });

  it('does not claim premium SEO is free', () => {
    const t = access.accessForSection('premium-seo');
    assert.notEqual(t, 'free');
    assert.notEqual(t, 'included');
    assert.match(access.publicLabel(t, 'short'), /Premium|Usage/i);
  });

  it('formats AUD cents', () => {
    assert.match(access.formatAudCents(2900), /^\$29(\.00)?$/);
  });
});

describe('Trust Bar presets', () => {
  const required = [
    'trustbar-aam1',
    'trustbar-bean-culture',
    'trustbar-carpenter-badges',
    'trustbar-carpenter-images',
    'trustbar-plumber',
    'trustbar-electrician',
    'trustbar-landscaper-images',
    'trustbar-cafe-images',
    'trustbar-beauty',
    'trustbar-builder',
    'trustbar-event-hire',
    'trustbar-accountant',
    'trustbar-medical',
    'trustbar-rendering',
    'trustbar-restaurant'
  ];

  it('bundles required industry presets', () => {
    required.forEach((slug) => {
      assert.ok(md.filePresets[slug], 'missing preset ' + slug);
      const preset = pp.normalizePreset(md.filePresets[slug], {
        slug,
        section_key: 'trustBar',
        source: 'file'
      });
      assert.equal(preset.section_key, 'trustBar');
      const tb = preset.site_config.sections.trustBar;
      assert.ok(tb);
      assert.ok(Array.isArray(tb.badges) && tb.badges.length >= 3, slug + ' needs badges');
    });
  });

  it('pairs carpenter badge and image modes', () => {
    const badges = md.filePresets['trustbar-carpenter-badges'];
    const images = md.filePresets['trustbar-carpenter-images'];
    assert.equal(badges.pairedPresetId, 'trustbar-carpenter-images');
    assert.equal(images.pairedPresetId, 'trustbar-carpenter-badges');
    assert.equal(badges.site_config.sections.trustBar.mode, 'badges');
    assert.equal(images.site_config.sections.trustBar.mode, 'images');
  });

  it('includes AAM1 text-and-icon and Bean Culture image-tile examples', () => {
    const aam1 = md.filePresets['trustbar-aam1'].site_config.sections.trustBar;
    const bean = md.filePresets['trustbar-bean-culture'].site_config.sections.trustBar;
    assert.equal(aam1.mode, 'badges');
    assert.ok(aam1.badges.some((b) => /Acrylic Rendering/i.test(b.label)));
    assert.equal(bean.mode, 'images');
    assert.ok(bean.badges.some((b) => /Coffee Carts/i.test(b.label)));
    assert.ok(bean.badges.every((b) => b.image));
  });

  it('trust-bar-v2 metadata lists featured examples', () => {
    assert.ok(md.trustBarV2);
    assert.equal(md.trustBarV2.appKey, 'trustBar');
    assert.equal(md.trustBarV2.accessType, 'included');
    const ids = (md.trustBarV2.examples || []).map((e) => e.id);
    assert.ok(ids.includes('aam1-coating'));
    assert.ok(ids.includes('bean-culture'));
  });
});

describe('public marketplace theme + copy safety', () => {
  it('marketplace pages load theme bridge CSS', () => {
    const home = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(home, /marketplace-theme\.css/);
    assert.match(feat, /marketplace-theme\.css/);
    assert.match(home, /--theme-page-background/);
    assert.match(feat, /--theme-primary/);
  });

  it('does not claim every marketplace feature is free', () => {
    const home = fs.readFileSync(path.join(root, 'marketplace.html'), 'utf8');
    assert.doesNotMatch(home, /no extra subscriptions/i);
    assert.doesNotMatch(home, /Every marketplace feature comes standard/i);
    assert.match(home, /Premium and usage-based tools are clearly marked/i);
  });

  it('demo-trustBar uses sections.trustBar contract', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-trustBar.html'), 'utf8');
    assert.match(demo, /sections:\s*\{[\s\S]*trustBar/);
    assert.doesNotMatch(demo, /"items":\s*\[\s*\{\s*"icon"/);
  });

  it('ships Trust Bar editor + V2 feature scripts', () => {
    assert.ok(fs.existsSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js')));
    assert.ok(fs.existsSync(path.join(root, 'assets/js/marketplace/marketplace-feature-v2.js')));
    assert.ok(fs.existsSync(path.join(root, 'app-demo-trust-bar.html')));
  });
});
