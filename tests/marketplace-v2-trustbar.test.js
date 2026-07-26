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
    assert.equal(bean.badges.length, 4);
    assert.ok(bean.badges.every((b) => b.image));
  });

  it('defaults image presets to four items with working image URLs', async () => {
    const landscaper = md.filePresets['trustbar-landscaper-images'].site_config.sections.trustBar;
    assert.equal(landscaper.badges.length, 4);
    assert.equal(landscaper.imageHeight, 220);
    for (const b of landscaper.badges) {
      assert.ok(b.image, 'missing image for ' + b.label);
      const res = await fetch(b.image, { method: 'HEAD' });
      assert.equal(res.status, 200, b.label + ' image should return 200');
    }
  });

  it('default trustBar playground config has four items', () => {
    const tb = md.defaultConfigs.trustBar.trustBar;
    assert.equal(tb.badges.length, 4);
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
    assert.match(demo, /"sections"\s*:\s*\{[\s\S]*"trustBar"/);
    assert.doesNotMatch(demo, /"items":\s*\[\s*\{\s*"icon"/);
  });

  it('ships Trust Bar editor + V2 feature scripts', () => {
    assert.ok(fs.existsSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js')));
    assert.ok(fs.existsSync(path.join(root, 'assets/js/marketplace/marketplace-feature-v2.js')));
    assert.ok(fs.existsSync(path.join(root, 'app-demo-trust-bar.html')));
  });

  it('Trust Bar V2 page is compact: coloured info + white demo', () => {
    const html = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-feature-v2.js'), 'utf8');
    assert.match(html, /mp-info-hero/);
    assert.match(html, /mp-demo-article/);
    assert.match(html, /mp-info-list/);
    assert.match(html, /Try the demo/);
    assert.match(html, /feat-hero-grid/);
    assert.match(html, /feat-hero-media/);
    assert.match(html, /class="himg"/);
    assert.doesNotMatch(html, /mp-demo-cta|Ready to use this on your website/);
    assert.doesNotMatch(html, /Try it in the editor/);
    assert.doesNotMatch(html, /mk-modes/);
    assert.doesNotMatch(html, /mk-industry/);
    assert.doesNotMatch(html, /mk-same-editor/);
    assert.doesNotMatch(html, /In context/);
  });

  it('classic feature page shows hero image and hides editor upsell', () => {
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /feat-hero-grid/);
    assert.match(feat, /heroImg=safeUrl\(f\.hero_image_url\)/);
    assert.match(feat, /Green hero media is always a still image/);
    assert.doesNotMatch(feat, /himg-demo-frame/);
    assert.doesNotMatch(feat, /Ready to use /);
    assert.doesNotMatch(feat, /Try it in the editor/);
    assert.doesNotMatch(feat, /data-r="pg-footer"/);
    assert.doesNotMatch(feat, /\.feat-hero \.himg.*display:\s*none/);
  });

  it('marketplace demos use the shared icon picker', () => {
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /lp-icon-picker\.js/);
    assert.match(feat, /LPIconPicker/);
    assert.match(feat, /case 'image':\s*\n\s*return '';/);
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.match(editor, /LPIconPicker\.controlHtml/);
    assert.ok(fs.existsSync(path.join(root, 'assets/js/marketplace/lp-icon-picker.js')));
  });

  it('playground supports local image override without upload', () => {
    const loc = fs.readFileSync(path.join(root, 'assets/js/marketplace/lp-local-image.js'), 'utf8');
    assert.match(loc, /readAsDataURL|toDataURL/);
    assert.match(loc, /On your screen only|Local only|Only on your screen/);
    // Native label→file input (required for iOS / iPad). Never rely on
    // programmatic .click() of a [hidden] file input.
    assert.match(loc, /<label class="btn ghost sm lp-locimg-choose" for="/);
    assert.match(loc, /<label class="lp-locimg-prev/);
    assert.doesNotMatch(loc, /fileInp\.click\(|openFilePicker/);
    assert.doesNotMatch(loc, /cloudinary|cwUpload|FormData/i);
    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/lp-local-image.css'), 'utf8');
    assert.match(css, /clip-path:\s*inset\(50%\)/);
    assert.doesNotMatch(css, /\.lp-locimg-file[^{]*\{[^}]*display:\s*none/i);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /lp-local-image\.js/);
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.match(editor, /LPLocalImage\.controlHtml/);
    assert.match(editor, /marketplace-playground/);
  });

  it('Trust Bar editor is compact with tabbed items and no Show on page', () => {
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.doesNotMatch(editor, /Show on page|Show Trust Bar on the page/);
    assert.doesNotMatch(editor, /modePreviewHtml|tb-ed-mode-preview|tb-mode-preview/);
    assert.match(editor, /tb-ed-tab/);
    assert.match(editor, /data-tab/);
    assert.match(editor, /trustBar\.on = true/);
    assert.match(editor, /tb-ed-color-grid|tb-ed-hex/);
    assert.match(editor, /tb-ed-zones/);
    assert.match(editor, /tb-ed-zone-items/);
    assert.match(editor, /tb-ed-zone-style/);
    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.css'), 'utf8');
    assert.match(css, /\.tb-ed-tabs/);
    assert.match(css, /\.tb-ed-hex/);
    assert.match(css, /\.tb-ed-zones/);
    assert.match(css, /\.tb-ed-zone-style/);
    assert.match(css, /color-mix\(in srgb, var\(--theme-primary/);
    assert.match(css, /max-width:\s*640px/);
    assert.doesNotMatch(css, /\.tb-ed-mode-preview/);
  });

  it('height slider uses lightweight onHeight scrub path', () => {
    const editor = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.js'), 'utf8');
    assert.match(editor, /onHeight/);
    assert.match(editor, /step="1"/);
    const v2 = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-feature-v2.js'), 'utf8');
    assert.match(v2, /applyTileHeight/);
    assert.match(v2, /--tb-img-h/);
    assert.match(v2, /onHeight:\s*function/);
    assert.match(v2, /pinScrollToHeightControl|scrollBy/);
    assert.match(v2, /overflow-anchor:none/);
  });

  it('marketplace header uses white logo at 50% larger size', () => {
    const css = fs.readFileSync(path.join(root, 'assets/lp-logo.css'), 'utf8');
    assert.match(css, /\.sitenav \.lp-logo-wrap/);
    assert.match(css, /--lp-logo-ink:\s*#ffffff\s*!important/);
    assert.match(css, /height:\s*78px\s*!important/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /data-lp-logo-ink="light"/);
    assert.match(feat, /\.sitenav \.leadpages-logo\{height:78px/);
    const logoJs = fs.readFileSync(path.join(root, 'assets/lp-logo.js'), 'utf8');
    assert.match(logoJs, /Never stomp explicit light\/dark ink/);
    assert.match(logoJs, /inkAttr === 'light' \|\| inkAttr === 'dark'/);
  });

  it('hero image fills its side column beside the copy', () => {
    const v2 = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-feature-v2.js'), 'utf8');
    assert.match(v2, /align-items:stretch/);
    assert.match(v2, /\.mp-info-hero \.himg img\{[^}]*position:absolute/);
    assert.match(v2, /max-height:none/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /align-items:stretch/);
    assert.match(feat, /\.himg img\{[^}]*position:absolute/);
  });

  it('demo trust bar applies tile images via DOM so local data URLs work', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(demo, /data-tb-bg/);
    assert.match(demo, /style\.backgroundImage\s*=\s*'url\('\s*\+\s*JSON\.stringify/);
    const tb = demo.slice(demo.indexOf('var TB=SEC.trustBar||{}'));
    const tbChunk = tb.slice(0, 5000);
    assert.doesNotMatch(tbChunk, /background-image:url\(/);
  });
});
