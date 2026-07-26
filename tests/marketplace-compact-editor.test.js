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
    assert.match(cert, /sections:\s*\{[\s\S]*certifications:\s*\{[\s\S]*on:\s*true/);
    assert.match(cert, /name:\s*"Licensed"/);

    const nav = fs.readFileSync(path.join(root, 'marketplace/demos/demo-navMenu.html'), 'utf8');
    assert.match(nav, /navMenu:\s*\{[\s\S]*on:\s*true/);
    assert.match(nav, /placement:\s*"section"/);
    assert.match(nav, /label:\s*"Services"/);
    assert.doesNotMatch(nav, /items:\s*\[\s*\]/);

    const map = fs.readFileSync(path.join(root, 'marketplace/demos/demo-serviceAreaMap.html'), 'utf8');
    assert.match(map, /serviceAreaMap:\s*\{[\s\S]*on:\s*true/);
    assert.match(map, /serviceAreas:\s*\{[\s\S]*areas:\s*\[/);
    assert.match(map, /name:\s*"Belconnen"/);
  });

  it('navMenu and serviceAreaMap field defs cover items / areas', () => {
    const defs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
    assert.ok(defs.navMenu.some((f) => /navMenu\.items\.\d+\.label/.test(f.key)));
    assert.ok(defs.navMenu.some((f) => f.key === 'sections.navMenu.style'));
    assert.ok(defs.serviceAreaMap.some((f) => f.key === 'sections.serviceAreas.areas'));
  });
});
