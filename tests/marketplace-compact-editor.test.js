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
});
