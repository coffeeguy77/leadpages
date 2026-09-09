'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const {
  listCatalogueSections,
  scratchBlueprint,
} = require('../lib/layout-composer/section-catalogue');
const { compileBlueprintToConfig, assertStructureUnchanged } = require('../lib/layout-composer/compile');
const {
  fillConfigFromBrief,
  recommendLandingPages,
  buildResearchBrief,
} = require('../lib/layout-composer/generate');
const { positioningLayoutToPresetBlueprint } = require('../lib/layout-composer/preset-adapter');
const { isLayoutComposerEnabled } = require('../lib/layout-composer/flags');

const html = fs.readFileSync(path.join(root, 'layout-composer.html'), 'utf8');
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');

describe('Layout Composer Phase 3–5 pipeline', () => {
  it('scratch blueprint compiles with Trust Bar pin and fills without structure change', () => {
    const bp = scratchBlueprint('Demo Co');
    const compiled = compileBlueprintToConfig(bp, {
      identity: { name: 'Demo Co', trade: 'Plumber', location: 'Canberra' },
    });
    assert.ok(compiled.sectionOrder.includes('hero'));
    assert.ok(compiled.sectionOrder.includes('trustBar'));
    const heroIdx = compiled.sectionOrder.indexOf('hero');
    const trustIdx = compiled.sectionOrder.indexOf('trustBar');
    assert.equal(trustIdx, heroIdx + 1);

    const filled = fillConfigFromBrief(compiled.config, bp, {
      businessName: 'Demo Co',
      trade: 'Plumber',
      location: 'Canberra',
    });
    assert.ok(filled.filledKeys.includes('hero'));
    assert.equal(filled.config.name, 'Demo Co');
    assert.doesNotThrow(function () {
      assertStructureUnchanged(bp, bp);
    });
  });

  it('rejects silently-mutated structure', () => {
    const bp = scratchBlueprint('X');
    const mutated = JSON.parse(JSON.stringify(bp));
    mutated.pages[0].sections.push({ key: 'videoReels', enabled: true });
    assert.throws(
      function () { assertStructureUnchanged(bp, mutated); },
      function (err) { return err && err.code === 'STRUCTURE_CHANGED'; }
    );
  });

  it('research + landing recommendations are checkbox-friendly', () => {
    const research = buildResearchBrief({ trade: 'Electrician', location: 'Sydney' });
    assert.equal(research.ok, true);
    assert.ok(Array.isArray(research.sources));
    assert.ok(research.sources.every(function (s) { return typeof s.confidence === 'number'; }));

    const landings = recommendLandingPages({ trade: 'Electrician', location: 'Sydney' });
    assert.ok(landings.length >= 2);
    assert.ok(landings.every(function (l) {
      return l.id && l.title && l.path && typeof l.selectedDefault === 'boolean';
    }));
  });

  it('preset adapter stays read-only and catalogue is labelled', () => {
    const layout = {
      id: 'abc',
      slug: 'trade-trust',
      name: 'Trade Trust',
      section_order: ['hero', 'services', 'reviews'],
      apps: [{ section_key: 'hero', enabled: true }, { section_key: 'gallery', enabled: false }],
      demo_packs: { hero: { heading: 'Hi' } },
    };
    const before = JSON.stringify(layout);
    const dto = positioningLayoutToPresetBlueprint(layout);
    assert.equal(JSON.stringify(layout), before);
    assert.equal(dto.kind, 'preset');
    assert.equal(dto.readOnly, true);
    assert.ok(dto.preview.hasSamplePacks);

    const cats = listCatalogueSections();
    assert.ok(cats.length > 5);
    assert.ok(cats.every(function (c) { return c.key && c.label; }));
  });

  it('ships builder UI + APIs + flag wiring', () => {
    assert.equal(isLayoutComposerEnabled({ LAYOUT_COMPOSER: '1' }), true);
    assert.match(html, /data-start="preset"/);
    assert.match(html, /data-start="mine"/);
    assert.match(html, /data-start="scratch"/);
    assert.match(html, /Confirm layout/);
    assert.match(html, /Generate content into layout/);
    assert.match(html, /\/api\/layout-composer\/generate/);
    assert.match(html, /layoutComposer=1/);
    assert.match(html, /lp_layout_composer_handoff/);
    const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
    assert.match(manage, /lpConsumeLayoutComposerHandoff/);
    const genApi = fs.readFileSync(path.join(root, 'api/layout-composer/generate.js'), 'utf8');
    assert.match(genApi, /Auth optional/);
    const presetsApi = fs.readFileSync(path.join(root, 'api/layout-composer/presets.js'), 'utf8');
    assert.match(presetsApi, /positioning_layouts/);
    assert.match(presetsApi, /\['partners', 'public'\]/);
    assert.doesNotMatch(presetsApi, /presets:\s*\[\],\s*signedIn:\s*false/);
    assert.match(html, /Loading Themes presets/);
    assert.match(html, /\/api\/layout-composer\/research/);
    assert.match(html, /\/api\/layout-composer\/landings/);
    assert.match(html, /cataloguePreview/);
    assert.match(html, /UNIT_PX/);
    assert.match(html, /data-trust-variant/);
    assert.match(html, /preview-pane/);
    assert.match(html, /leadpages\/layout-composer\/stock/);
    assert.match(vercel, /"\/layout-composer"/);
    for (const f of [
      'api/layout-composer/catalogue.js',
      'api/layout-composer/presets.js',
      'api/layout-composer/compile.js',
      'api/layout-composer/generate.js',
      'api/layout-composer/research.js',
      'api/layout-composer/landings.js',
      'lib/layout-composer/preview-stock.js',
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), f);
    }
  });

  it('preview stock proportions: hero full, trust images 1/3, trust text 1/5', () => {
    const {
      previewMetaForSection,
      HERO_UNITS,
    } = require('../lib/layout-composer/preview-stock');
    const hero = previewMetaForSection('hero');
    const slider = previewMetaForSection('heroSlider');
    const trustImg = previewMetaForSection({ key: 'trustBar', previewVariant: 'images' });
    const trustText = previewMetaForSection({ key: 'trustBar', previewVariant: 'text' });
    assert.equal(hero.units, HERO_UNITS);
    assert.equal(slider.units, HERO_UNITS);
    assert.equal(hero.uploadWidth, slider.uploadWidth);
    assert.equal(trustImg.units, 5);
    assert.equal(trustText.units, 3);
    assert.equal(trustImg.uploadHeight, Math.round(hero.uploadHeight / 3));
    assert.equal(trustText.uploadHeight, Math.round(hero.uploadHeight / 5));
    assert.ok(hero.imageUrl || hero.placeholderUrl);
    const cats = listCatalogueSections();
    assert.ok(cats.every(function (c) { return c.preview && c.preview.units > 0; }));
  });
});
