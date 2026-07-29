const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('marketplace compact editor parity', () => {
  it('ships shared compact editor and wires it on feature pages', () => {
    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /LPMarketplaceCompactEditor/);
    assert.match(js, /tb-ed-zones/);
    assert.match(js, /Have a play/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /marketplace-compact-editor\.js/);
    assert.match(feat, /LPMarketplaceCompactEditor\.mount/);
  });

  it('certifications / navMenu / serviceAreaMap demos include working content', () => {
    const cert = fs.readFileSync(path.join(root, 'marketplace/demos/demo-certifications.html'), 'utf8');
    assert.match(cert, /"sections"\s*:\s*\{[\s\S]*"certifications"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(cert, /"name"\s*:\s*"Licensed"/);
    assert.match(cert, /\/marketplace\/demos\/media\/certs\/licensed\.svg/);
    assert.match(cert, /\/marketplace\/demos\/media\/certs\/master-plumbers\.svg/);
    assert.match(cert, /\/marketplace\/demos\/media\/certs\/fully-insured\.svg/);
    assert.doesNotMatch(cert, /images\.unsplash\.com/);
    ['licensed.svg', 'master-plumbers.svg', 'fully-insured.svg'].forEach((f) => {
      assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/media/certs', f)), 'missing ' + f);
    });
    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    assert.match(defaults.certifications.certifications.items[0].image, /licensed\.svg$/);
    assert.match(defaults.certifications.certifications.items[1].image, /master-plumbers\.svg$/);
    assert.match(defaults.certifications.certifications.items[2].image, /fully-insured\.svg$/);
    const shared = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(shared, /cert-ph/);
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.certifications.some((f) => f.key === 'sections.certifications.items.0.image'));

    const nav = fs.readFileSync(path.join(root, 'marketplace/demos/demo-navMenu.html'), 'utf8');
    assert.match(nav, /"navMenu"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(nav, /"placement"\s*:\s*"section"/);
    assert.match(nav, /"label"\s*:\s*"Services"/);
    assert.doesNotMatch(nav, /"items"\s*:\s*\[\s*\]/);

    const map = fs.readFileSync(path.join(root, 'marketplace/demos/demo-serviceAreaMap.html'), 'utf8');
    assert.match(map, /"serviceAreaMap"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(map, /"serviceAreas"\s*:\s*\{[\s\S]*"areas"\s*:\s*\[/);
    assert.match(map, /"name"\s*:\s*"Belconnen"/);
  });

  it('navMenu and serviceAreaMap field defs cover items / areas', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.navMenu.some((f) => /navMenu\.items\.\d+\.label/.test(f.key)));
    assert.ok(defs.navMenu.some((f) => f.key === 'sections.navMenu.style'));
    assert.ok(defs.serviceAreaMap.some((f) => f.key === 'sections.serviceAreas.areas'));
  });

  it('area field defs include chip suburb list (add / remove)', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    const suburbs = defs.area.find((f) => f.key === 'sections.area.suburbs');
    assert.ok(suburbs, 'suburbs field');
    assert.equal(suburbs.type, 'textarea');
    assert.equal(suburbs.join, '\n');
    assert.equal(suburbs.listUi, 'chips');
    assert.match(suburbs.label || '', /suburb/i);
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-area.html'), 'utf8');
    assert.match(demo, /"suburbs"\s*:\s*\[/);
    assert.match(demo, /Gungahlin/);
    const compact = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(compact, /f\.join && Array\.isArray\(val\)/);
    assert.match(compact, /data-mp-chip-add/);
    assert.match(compact, /data-mp-chip-rm/);
    assert.match(compact, /listUi === 'chips'/);
    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.css'), 'utf8');
    assert.match(css, /\.tb-ed-chip\b/);
    assert.match(css, /\.tb-ed-chiplist\b/);
  });

  it('reviews field defs cover eyebrow, title, star colour, card background, quote text', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.reviews.some((f) => f.key === 'sections.reviews.eyebrow'));
    assert.ok(defs.reviews.some((f) => f.key === 'sections.reviews.heading' && f.label === 'Title'));
    assert.ok(defs.reviews.some((f) => f.key === 'sections.reviews.starColor'));
    assert.ok(defs.reviews.some((f) => f.key === 'sections.reviews.cardBg'));
    assert.ok(defs.reviews.some((f) => f.key === 'sections.reviews.textColor'));
    assert.ok(defs.reviews.some((f) => /reviews\.items\.\d+\.text/.test(f.key)));
  });

  it('section appearance edges reserve padding so transitions do not cover text', () => {
    const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(js, /_secAppApplyEdgePad/);
    assert.match(js, /LP_SEC_EDGE_H\s*=\s*52/);
    assert.match(js, /data-lp-edge-pad0/);
  });

  it('diagonal and soft-curve transitions paint the adjacent colour (not the section fill)', () => {
    const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    const angleIdx = js.indexOf("type==='angle'");
    const curveIdx = js.indexOf("type==='curve'");
    assert.ok(angleIdx > 0, 'angle branch');
    assert.ok(curveIdx > angleIdx, 'curve branch after angle');
    const angleBlock = js.slice(angleIdx, curveIdx);
    const curveBlock = js.slice(curveIdx, curveIdx + 700);
    /* SVG wedges use fromCol (fc) on top / toCol (tc) on bottom */
    assert.ok(angleBlock.includes("fill=\"'+fc+'\""), 'angle top uses adjacent from colour');
    assert.ok(angleBlock.includes("fill=\"'+tc+'\""), 'angle bottom uses adjacent to colour');
    assert.ok(curveBlock.includes("fill=\"'+fc+'\""), 'curve top uses adjacent from colour');
    assert.ok(curveBlock.includes("fill=\"'+tc+'\""), 'curve bottom uses adjacent to colour');
    /* CSS fallbacks must not paint --lp-edge-to on top (same as section = invisible) */
    assert.match(js, /lp-sec-edge-angle\.lp-sec-edge-top\{background:var\(--lp-edge-from\)/);
    assert.match(js, /lp-sec-edge-angle\.lp-sec-edge-bottom\{background:var\(--lp-edge-to\)/);
    assert.match(js, /lp-sec-edge-curve\.lp-sec-edge-top\{background:var\(--lp-edge-from\)/);
    assert.match(js, /lp-sec-edge-curve\.lp-sec-edge-bottom\{background:var\(--lp-edge-to\)/);
    assert.doesNotMatch(
      js,
      /lp-sec-edge-angle\.lp-sec-edge-top\{background:var\(--lp-edge-to\)/
    );
  });

  it('specialOffer editor mirrors manage copy + appearance controls', () => {
    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/special-offer-editor.js'), 'utf8');
    assert.match(js, /LPSpecialOfferEditor/);
    assert.match(js, /Small label/);
    assert.match(js, /Offer headline/);
    assert.match(js, /Deadline \/ subline/);
    assert.match(js, /Button text/);
    assert.match(js, /Section container style/);
    assert.match(js, /Offer points/);
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.specialOffer.some((f) => f.key === 'sections.specialOffer.eyebrow'));
    assert.ok(defs.specialOffer.some((f) => f.key === 'sections.specialOffer.cta'));
    assert.ok(!defs.specialOffer.some((f) => f.key === 'sections.specialOffer.ctaText'));
    const compact = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(compact, /withAppearanceDefs/);
  });

  it('quote demo restores steel gradient and form editing fields', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-quote.html'), 'utf8');
    assert.match(demo, /class="quote"/);
    assert.match(demo, /data-sec="quote"/);
    assert.match(demo, /"formTitle"\s*:\s*"Get my quote"/);
    assert.match(demo, /"jobOptions"\s*:\s*\[/);
    assert.match(demo, /"formStyle"\s*:\s*"default"/);

    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /\.quote\{[^}]*linear-gradient/);

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    const keys = (defs.quote || []).map((f) => f.key);
    [
      'sections.quote.eyebrow',
      'sections.quote.heading',
      'sections.quote.sub',
      'sections.quote.formTitle',
      'sections.quote.button',
      'sections.quote.formStyle',
      'sections.quote.lblName',
      'sections.quote.lblJob',
      'sections.quote.jobOptions.0.text',
      'sections.quote.points.0.text',
      'sections.quote.btnBg'
    ].forEach((k) => assert.ok(keys.includes(k), 'missing ' + k));
    assert.ok(!keys.includes('sections.quote.intro'));

    const shared = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(shared, /Q\.eyebrow\s*!=\s*null/);
    assert.match(shared, /Q\.heading\s*!=\s*null/);

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    assert.equal(defaults.quote.quote.formStyle, 'default');
    assert.ok(defaults.quote.quote.jobOptions.length >= 3);
  });

  it('playground compact editor stacks single column and groups custom style', () => {
    const compact = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(compact, /tb-ed-stack/);
    assert.match(compact, /tb-ed-app-box/);
    assert.match(compact, /Enable custom style/);
    assert.match(compact, /isAppearanceCustomToggle/);
    assert.match(compact, /setEditorLayout/);
    assert.match(compact, /editorLayout/);
    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.css'), 'utf8');
    assert.match(css, /\.tb-ed-stack\b/);
    assert.match(css, /\.tb-ed-app-box\b/);
    assert.match(css, /\.tb-ed-app-fields\b/);
    /* Stack must beat copyheavy two-column leftover empty pane */
    assert.match(css, /\.tb-ed-stack\.tb-ed-root\.tb-ed-copyheavy \.tb-ed-zones/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /pg-device-fill/);
    assert.match(feat, /applyPreviewDeviceHints/);
    assert.match(feat, /device === 'phone'\) cols = 2/);
    assert.match(feat, /device === 'tablet'\) cols = 3/);
    assert.match(feat, /syncEditorLayout/);
    assert.match(feat, /editorLayout: 'stack'/);
    assert.match(feat, /function fitStage/);
    const ig = fs.readFileSync(path.join(root, 'marketplace/demos/demo-instaGallery.html'), 'utf8');
    assert.match(ig, /data-pg-device/);
    assert.match(ig, /pgDev === 'phone'/);
  });

  it('quote compact editor puts copy on the left and style on the right', () => {
    const compact = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(compact, /function isStyleField/);
    assert.match(compact, /tb-ed-zone-content/);
    assert.match(compact, /data-mp-content/);
    assert.match(compact, /Trust points/);
    assert.match(compact, /contentFields/);

    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.css'), 'utf8');
    assert.match(css, /\.tb-ed-zone-left/);
    assert.match(css, /\.tb-ed-zone-content/);

    /* Load splitter without a browser: evaluate the pure helpers via vm */
    const vm = require('vm');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(compact + '\nthis.API = LPMarketplaceCompactEditor;', sandbox);
    const api = sandbox.API;
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    const quoteDefs = api.withAppearanceDefs('quote', defs.quote);
    const split = api.splitDefs('quote', 'points', quoteDefs);

    const contentKeys = split.contentFields.map((f) => f.key);
    const styleKeys = split.styleFields.map((f) => f.key);

    assert.ok(contentKeys.includes('sections.quote.eyebrow'));
    assert.ok(contentKeys.includes('sections.quote.heading'));
    assert.ok(contentKeys.includes('sections.quote.lblName'));
    assert.ok(contentKeys.includes('sections.quote.jobOptions.0.text'));
    assert.ok(contentKeys.includes('sections.quote.fineText'));
    assert.ok(!contentKeys.includes('sections.quote.btnBg'));
    assert.ok(!contentKeys.includes('sections.quote.formStyle'));

    assert.ok(styleKeys.includes('sections.quote.btnBg'));
    assert.ok(styleKeys.includes('sections.quote.formStyle'));
    assert.ok(styleKeys.includes('theme.pipe'));
    assert.ok(styleKeys.some((k) => /\.appearance\.custom$/.test(k)));
    assert.ok(styleKeys.some((k) => /\.appearance\.eyebrowColor$/.test(k)));
    assert.ok(styleKeys.some((k) => /\.appearance\.titleColor$/.test(k)));
    assert.ok(styleKeys.some((k) => /\.appearance\.introColor$/.test(k)));
    const appKeys = quoteDefs.map((f) => f.key).filter((k) => /\.appearance\./.test(k));
    const bgI = appKeys.indexOf('sections.quote.appearance.containerBg');
    const strokeI = appKeys.indexOf('sections.quote.appearance.strokeColor');
    const ebI = appKeys.indexOf('sections.quote.appearance.eyebrowColor');
    const titleI = appKeys.indexOf('sections.quote.appearance.titleColor');
    assert.ok(bgI >= 0 && strokeI === bgI + 1, 'bg|stroke dual pair');
    assert.ok(ebI === strokeI + 1 && titleI === ebI + 1, 'eyebrow|title dual pair');

    assert.ok(split.itemFieldsByIndex[0] && split.itemFieldsByIndex[0].length);
    assert.equal(api.isStyleField({ type: 'color', key: 'sections.quote.btnBg' }), true);
    assert.equal(api.isStyleField({ type: 'text', key: 'sections.quote.eyebrow', label: 'Eyebrow' }), false);
  });

  it('heroSlider demo seeds slide images and hero copy', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-heroSlider.html'), 'utf8');
    assert.match(demo, /"slides"\s*:\s*\[/);
    assert.match(demo, /"imageUrl"\s*:\s*"https:\/\//);
    assert.match(demo, /"heading"\s*:\s*"Solar that pays for itself"/);
    assert.match(demo, /"highlightText"/);
    assert.match(demo, /"primaryCtaText"/);
    assert.match(demo, /photo-1509391366360-2e959784a276/);
    assert.doesNotMatch(demo, /"img"\s*:/);
    assert.doesNotMatch(demo, /"headline"\s*:/);

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const slides = defaults.heroSlider.heroSlider.slides;
    assert.ok(Array.isArray(slides) && slides.length >= 2);
    slides.forEach((s, i) => {
      assert.match(s.imageUrl || '', /^https:\/\//, 'slide ' + i + ' imageUrl');
      assert.ok(s.heading, 'slide ' + i + ' heading');
      assert.ok(s.subText, 'slide ' + i + ' subText');
    });

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.heroSlider.some((f) => f.key === 'sections.heroSlider.slides.0.imageUrl'));
    assert.ok(defs.heroSlider.some((f) => f.key === 'sections.heroSlider.slides.0.heading'));
    assert.ok(defs.heroSlider.some((f) => f.key === 'sections.heroSlider.transitionEffect'));

    const sell = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/sell-templates.json'), 'utf8'));
    assert.match(sell.heroSlider.hero_image_url, /photo-1509391366360-2e959784a276/);
  });

  it('projectFeed demo uses light background and manage-parity controls', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-projectFeed.html'), 'utf8');
    assert.match(demo, /background:var\(--light/);
    assert.match(demo, /data-sec="projectFeed"/);
    assert.match(demo, /"image"\s*:\s*"https:\/\//);
    assert.match(demo, /"cardStyle"\s*:\s*"overlay"/);
    assert.match(demo, /Merbau Deck/);
    assert.match(demo, /photo-1600585154340-be6161a56a0c/);
    assert.doesNotMatch(demo, /background:transparent/);

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const pf = defaults.projectFeed.projectFeed;
    assert.equal(pf.cardStyle, 'overlay');
    assert.ok(Array.isArray(pf.items) && pf.items.length >= 3);
    const imgs = pf.items.map((it) => it.image);
    assert.ok(imgs.every((u) => /^https:\/\//.test(u || '')));
    assert.equal(new Set(imgs).size, imgs.length);

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.items.0.title'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.items.0.image'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.cardStyle'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.showTag'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.source'));
    assert.ok(defs.projectFeed.some((f) => f.key === 'sections.projectFeed.textBg'));

    const sell = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/sell-templates.json'), 'utf8'));
    assert.match(sell.projectFeed.hero_image_url, /photo-1600585154340-be6161a56a0c/);
  });

  it('heroBeforeAfter demo seeds before/after images and editor fields', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-heroBeforeAfter.html'), 'utf8');
    assert.match(demo, /"beforeImage"\s*:\s*"https:\/\//);
    assert.match(demo, /"afterImage"\s*:\s*"https:\/\//);
    assert.match(demo, /photo-1503387762-592deb58ef4e/);
    assert.match(demo, /photo-1584622650111-993a426fbf0a/);
    assert.doesNotMatch(demo, /"beforeImage"\s*:\s*""/);

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const hb = defaults.heroBeforeAfter.heroBeforeAfter;
    assert.match(hb.beforeImage, /^https:\/\//);
    assert.match(hb.afterImage, /^https:\/\//);
    assert.notEqual(hb.beforeImage, hb.afterImage);

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.heroBeforeAfter.some((f) => f.key === 'sections.heroBeforeAfter.beforeImage'));
    assert.ok(defs.heroBeforeAfter.some((f) => f.key === 'sections.heroBeforeAfter.afterImage'));
    assert.ok(defs.heroBeforeAfter.some((f) => f.key === 'sections.heroBeforeAfter.title'));
    assert.ok(defs.heroBeforeAfter.some((f) => f.key === 'sections.heroBeforeAfter.caption'));
  });

  it('activityTimeline demo and editor cover timeline events', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-activityTimeline.html'), 'utf8');
    assert.match(demo, /"events"\s*:\s*\[/);
    assert.match(demo, /Hot water system replacement/);
    assert.match(demo, /"on"\s*:\s*true/);
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.activityTimeline.some((f) => /activityTimeline\.events\.\d+\.task/.test(f.key)));
    assert.ok(defs.activityTimeline.some((f) => /activityTimeline\.events\.\d+\.status/.test(f.key)));
    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /'events'/);
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /seedFromDefaultConfigs/);
    assert.match(feat, /ensureSectionOn/);
  });

  it('videoReels demo seeds thumbnails and keeps cards inside the iframe', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-videoReels.html'), 'utf8');
    assert.match(demo, /"videoReels"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(demo, /"thumbnail"\s*:\s*"https:\/\/images\.unsplash\.com\//);
    assert.match(demo, /photo-1584622650111-993a426fbf0a/);
    assert.match(demo, /photo-1504328345606-18bbc8c9d7d1/);
    assert.match(demo, /photo-1621905252507-b35492cc74b4/);
    assert.match(demo, /max-width:560px/);
    assert.match(demo, /background:var\(--light,#eef2f6\)!important/);
    assert.doesNotMatch(demo, /"thumbnail"\s*:\s*""/);

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const reels = defaults.videoReels.videoReels.reels;
    assert.equal(reels.length, 3);
    assert.ok(reels.every((r) => r.thumbnail && /^https:\/\//.test(r.thumbnail)));
    assert.ok(reels.every((r) => r.title && r.tag));

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.videoReels.some((f) => f.type === 'image' && /reels\.0\.thumbnail/.test(f.key)));
    assert.ok(defs.videoReels.some((f) => /reels\.0\.title/.test(f.key)));
    assert.ok(defs.videoReels.some((f) => f.key === 'sections.videoReels.intro'));

    const apply = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(apply, /photo-1584622650111-993a426fbf0a/);

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /h > 1100/);
    assert.match(feat, /900/);
  });

  it('emergencyAvailability editor covers manage-parity availability controls', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    const ea = defs.emergencyAvailability || [];
    const keys = ea.map((f) => f.key);
    [
      'sections.emergencyAvailability.heading',
      'sections.emergencyAvailability.intro',
      'sections.emergencyAvailability.availableLabel',
      'sections.emergencyAvailability.responseText',
      'sections.emergencyAvailability.afterHoursLabel',
      'sections.emergencyAvailability.afterHoursText',
      'sections.emergencyAvailability.emergencyText',
      'sections.emergencyAvailability.mode',
      'sections.emergencyAvailability.available',
      'sections.emergencyAvailability.weekdayOpen',
      'sections.emergencyAvailability.weekdayClose',
      'sections.emergencyAvailability.satOpen',
      'sections.emergencyAvailability.satClose',
      'sections.emergencyAvailability.sunOpen',
      'sections.emergencyAvailability.sunClose',
      'sections.emergencyAvailability.cta.text',
      'sections.emergencyAvailability.cta.action'
    ].forEach((k) => assert.ok(keys.includes(k), 'missing field ' + k));
    const mode = ea.find((f) => f.key === 'sections.emergencyAvailability.mode');
    assert.equal(mode.type, 'select');
    assert.ok(mode.options.some((o) => o.value === 'schedule'));
    assert.ok(mode.options.some((o) => o.value === 'manual'));
    const action = ea.find((f) => f.key === 'sections.emergencyAvailability.cta.action');
    assert.equal(action.type, 'select');
    assert.ok(action.options.some((o) => o.value === 'call'));
    assert.ok(!keys.includes('sections.emergencyAvailability.eyebrow'));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    assert.equal(defaults.emergencyAvailability.emergencyAvailability.mode, 'schedule');
    assert.ok(defaults.emergencyAvailability.emergencyAvailability.cta);
    assert.equal(defaults.emergencyAvailability.emergencyAvailability.cta.action, 'call');

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-emergencyAvailability.html'), 'utf8');
    assert.match(demo, /"emergencyAvailability"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(demo, /"mode"\s*:\s*"schedule"/);
    assert.match(demo, /afterHoursLabel/);
  });

  it('why Choose Us editor exposes icons, numbers and style controls', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.why.some((f) => f.type === 'icon' && f.key === 'sections.why.items.0.icon'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.items.0.n'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.items.3.icon'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.iconAlign'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.iconSize'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.iconColor'));
    assert.ok(defs.why.some((f) => f.key === 'sections.why.eyebrow'));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const items = defaults.why.why.items;
    assert.equal(items.length, 4);
    assert.ok(items.every((it) => it.icon && /^[a-z0-9-]+$/.test(it.icon)));
    assert.equal(items[0].icon, 'dollar-sign');
    assert.equal(items[2].icon, 'shield-check');

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-why.html'), 'utf8');
    assert.match(demo, /"icon"\s*:\s*"dollar-sign"/);
    assert.match(demo, /"icon"\s*:\s*"home"/);
    assert.match(demo, /why-grid/);

    const apply = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(apply, /w\.icon/);
    assert.match(apply, /iconAlign/);
    assert.match(apply, /tok\(WY\.eyebrow\)/);

    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /function labelForItemIndex/);
    assert.match(js, /Point/);

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /local\.length > fieldDefs\.length/);
  });

  it('textBox editor covers copy, image, layout and side controls', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.textBox.some((f) => f.key === 'sections.textBox.eyebrow'));
    const contentDef = defs.textBox.find((f) => f.key === 'sections.textBox.content');
    assert.ok(contentDef && contentDef.type === 'textarea');
    assert.equal(contentDef.rows, 12);
    const introDef = defs.textBox.find((f) => f.key === 'sections.textBox.intro');
    assert.ok(introDef && introDef.rows === 5);
    assert.ok(defs.textBox.some((f) => f.key === 'sections.textBox.image' && f.type === 'image'));
    assert.ok(defs.textBox.some((f) => f.key === 'sections.textBox.imageLayout' && f.type === 'select'));
    assert.ok(defs.textBox.some((f) => f.key === 'sections.textBox.imageSide'));
    assert.ok(defs.textBox.some((f) => f.key === 'sections.textBox.textAlign'));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const tb = defaults.textBox.textBox;
    assert.equal(tb.on, true);
    assert.match(tb.image, /^https:\/\//);
    assert.equal(tb.imageLayout, 'beside');

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-textBox.html'), 'utf8');
    assert.match(demo, /"textBox"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(demo, /photo-1503387762-592deb58ef4e/);
    assert.match(demo, /background:var\(--light,#eef2f6\)!important/);

    const apply = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(apply, /businessName/);
    assert.match(apply, /\.tb-content/);
    assert.match(apply, /imageLayout/);

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /local\.length > fieldDefs\.length/);

    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /tb-ed-zone-content/);
    assert.match(js, /showLeft \|\| hasStyle \? 'Style' : 'Content'/);
    assert.match(js, /tb-ed-textarea-main/);
    assert.match(js, /tb-ed-copyheavy/);
    assert.match(js, /function textareaRows/);

    const css = fs.readFileSync(path.join(root, 'assets/js/marketplace/trust-bar-editor.css'), 'utf8');
    assert.match(css, /\.tb-ed-textarea-main textarea/);
    assert.match(css, /\.tb-ed-sec-textBox/);
    assert.match(css, /min-height:\s*180px/);

    /* Content stays left; layout/colours go right — fills the first empty Style column */
    const vm = require('vm');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(js + '\nthis.API = LPMarketplaceCompactEditor;', sandbox);
    const split = sandbox.API.splitDefs(
      'textBox',
      'items',
      sandbox.API.withAppearanceDefs('textBox', defs.textBox)
    );
    const contentKeys = split.contentFields.map((f) => f.key);
    const styleKeys = split.styleFields.map((f) => f.key);
    assert.ok(contentKeys.includes('sections.textBox.content'));
    assert.ok(contentKeys.includes('sections.textBox.intro'));
    assert.ok(contentKeys.includes('sections.textBox.image'));
    assert.ok(styleKeys.includes('sections.textBox.imageLayout'));
    assert.ok(styleKeys.includes('sections.textBox.textAlign'));
    assert.ok(styleKeys.includes('theme.pipe'));
  });

  it('services grid seeds root cards and exposes icon/size/card style editors', () => {
    const pp = require('../lib/playground-preset');
    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    assert.ok(Array.isArray(defaults.services.services));
    assert.equal(defaults.services.services.length, 4);
    assert.equal(defaults.services.services[0].icon, 'droplet');
    assert.ok(defaults.services.servicesMeta && defaults.services.servicesMeta.heading);

    const site = pp.flatDemoToSiteConfig(defaults.services, 'services');
    assert.ok(Array.isArray(site.services));
    assert.equal(site.services.length, 4);
    assert.equal(site.sections.services.heading, 'One call sorts the lot.');
    const flatBack = pp.siteConfigToFlatDemo(site);
    assert.ok(Array.isArray(flatBack.services));
    assert.equal(flatBack.services[0].icon, 'droplet');
    assert.ok(flatBack.servicesMeta && flatBack.servicesMeta.heading);

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.services.some((f) => f.type === 'icon' && f.key === 'services.0.icon'));
    assert.ok(defs.services.some((f) => f.key === 'services.0.mediaSize'));
    assert.ok(defs.services.some((f) => f.key === 'services.0.bg'));
    assert.ok(defs.services.some((f) => f.key === 'services.0.image'));
    assert.ok(defs.services.some((f) => f.key === 'sections.services.eyebrowColor'));

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-services.html'), 'utf8');
    assert.match(demo, /"services"\s*:\s*\[[\s\S]*"icon"\s*:\s*"droplet"/);
    assert.match(demo, /background:var\(--light,#eef2f6\)!important/);

    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /servicesMeta/);
    assert.match(feat, /cfg\.services = JSON\.parse/);

    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /function labelForItemIndex/);
    assert.match(js, /mediaScale/);
  });

  it('serviceProcess field defs expose icons and editor renumbers step labels', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.serviceProcess.some((f) => f.type === 'icon' && f.key === 'sections.serviceProcess.steps.0.icon'));
    assert.ok(defs.serviceProcess.some((f) => f.type === 'icon' && f.key === 'sections.serviceProcess.steps.5.icon'));
    assert.ok(defs.serviceProcess.some((f) => f.key === 'sections.serviceProcess.steps.5.title'));
    assert.ok(defs.serviceProcess.some((f) => f.key === 'sections.serviceProcess.eyebrow'));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const steps = defaults.serviceProcess.serviceProcess.steps;
    assert.ok(steps.length >= 5);
    assert.equal(steps[0].icon, 'phone-call');
    assert.ok(steps.every((s) => s.icon && /^[a-z0-9-]+$/.test(s.icon)));

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-serviceProcess.html'), 'utf8');
    assert.match(demo, /"icon"\s*:\s*"phone-call"/);
    assert.match(demo, /"serviceProcess"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);

    const js = fs.readFileSync(path.join(root, 'assets/js/marketplace/marketplace-compact-editor.js'), 'utf8');
    assert.match(js, /function labelForItemIndex/);
    assert.match(js, /labelForItemIndex\(f\.label, activeIdx\)/);
    assert.match(js, /f\.type === 'icon'.*circle-check|type === 'icon'\) it\[f\.prop\] = 'circle-check'/);
  });

  it('activityCounter editor exposes eyebrow, heading and per-stat icons', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.activityCounter.some((f) => f.key === 'sections.activityCounter.eyebrow'));
    assert.ok(defs.activityCounter.some((f) => f.key === 'sections.activityCounter.heading'));
    assert.ok(defs.activityCounter.some((f) => f.key === 'sections.activityCounter.intro'));
    assert.ok(defs.activityCounter.some((f) => f.type === 'icon' && f.key === 'sections.activityCounter.stats.0.icon'));
    assert.ok(defs.activityCounter.some((f) => f.type === 'icon' && f.key === 'sections.activityCounter.stats.3.icon'));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const stats = defaults.activityCounter.activityCounter.stats;
    assert.equal(stats.length, 4);
    assert.equal(defaults.activityCounter.activityCounter.eyebrow, "Today's activity");
    assert.ok(stats.every((it) => it.icon && /^[a-z0-9-]+$/.test(it.icon)));
    assert.equal(stats[0].icon, 'wrench');
    assert.equal(stats[3].icon, 'star');
    assert.equal(stats[3].value, '4.9');

    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-activityCounter.html'), 'utf8');
    assert.match(demo, /"icon"\s*:\s*"wrench"/);
    assert.match(demo, /"icon"\s*:\s*"star"/);
    assert.match(demo, /"eyebrow"\s*:\s*"Today's activity"/);

    const apply = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(apply, /ac-value-row/);
    assert.match(apply, /ac-ic/);
    assert.match(apply, /it\.icon/);

    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /\.ac-value-row/);
    assert.match(css, /\.ac-ic/);

    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /activityStats:\{[^}]*k:'icon',label:'Icon',type:'icon'/);

    const trade = fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8');
    assert.match(trade, /ac-value-row/);
    assert.match(trade, /ac-ic/);
  });

  it('responseCards demo uses LP icons, wraps titles, and exposes icon editors', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-responseCards.html'), 'utf8');
    assert.match(demo, /"responseCards"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
    assert.match(demo, /"icon"\s*:\s*"clock"/);
    assert.match(demo, /"icon"\s*:\s*"zap"/);
    assert.match(demo, /"icon"\s*:\s*"headset"/);
    assert.match(demo, /background:var\(--light,#eef2f6\)!important/);
    assert.doesNotMatch(demo, /"icon"\s*:\s*"⏱"/);

    const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
    assert.match(css, /\.rcards\{[^}]*minmax\(0,1fr\)/);
    assert.match(css, /\.rc-tx\{[^}]*min-width:0/);
    assert.match(css, /\.rc-tx h3\{[^}]*overflow-wrap:anywhere/);

    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.responseCards.some((f) => f.key === 'sections.responseCards.eyebrow'));
    assert.ok(defs.responseCards.some((f) => f.key === 'sections.responseCards.heading'));
    assert.ok(defs.responseCards.some((f) => f.type === 'icon' && /cards\.0\.icon/.test(f.key)));
    assert.ok(defs.responseCards.some((f) => f.type === 'icon' && /cards\.5\.icon/.test(f.key)));
    assert.ok(defs.responseCards.some((f) => /cards\.5\.title/.test(f.key)));

    const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
    const cards = defaults.responseCards.responseCards.cards;
    assert.equal(cards.length, 6);
    assert.equal(cards[0].icon, 'clock');
    assert.equal(cards[5].icon, 'headset');

    const apply = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
    assert.match(apply, /icon:'clock'/);
    assert.match(apply, /icon:'headset'/);
  });
});
