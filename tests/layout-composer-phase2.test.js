'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const {
  positioningLayoutToPresetBlueprint,
  customisePresetBlueprint,
} = require('../lib/layout-composer/preset-adapter');
const {
  isLayoutComposerEnabled,
  layoutComposerFlagPayload,
} = require('../lib/layout-composer/flags');

const sql = fs.readFileSync(path.join(root, 'db/design_blueprints.sql'), 'utf8');
const stub = fs.readFileSync(path.join(root, 'layout-composer.html'), 'utf8');
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
const apiFlags = fs.readFileSync(path.join(root, 'api/layout-composer/flags.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const arch = fs.readFileSync(
  path.join(root, 'docs/features/Layout-Composer-Architecture.md'),
  'utf8'
);

describe('Layout Composer Phase 2 foundations', () => {
  it('maps positioning_layouts to a read-only preset blueprint DTO', () => {
    const dto = positioningLayoutToPresetBlueprint({
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'trade-trust',
      name: 'Trade Trust',
      description: 'Trust-forward trade home',
      section_order: ['hero', 'trust', 'services', 'contact'],
      apps: [
        { section_key: 'hero', enabled: true },
        { section_key: 'trust', enabled: true },
        { section_key: 'gallery', enabled: false },
      ],
      demo_packs: { hero: { heading: 'Sample' } },
      theme_image_url: 'https://example.com/theme.jpg',
      layout_image_url: 'https://example.com/layout.jpg',
      industry_tags: ['plumbing'],
      visibility: 'partners',
    });

    assert.equal(dto.kind, 'preset');
    assert.equal(dto.readOnly, true);
    assert.equal(dto.source, 'positioning_layouts');
    assert.equal(dto.slug, 'trade-trust');
    assert.equal(dto.pages.length, 1);
    assert.equal(dto.pages[0].id, 'home');
    const keys = dto.pages[0].sections.map((s) => s.key);
    assert.equal(keys[0], 'hero');
    assert.ok(keys.includes('trust'));
    assert.ok(keys.includes('services'));
    assert.ok(keys.includes('contact'));
    assert.ok(keys.includes('gallery'));
    assert.equal(dto.preview.hasSamplePacks, true);
    assert.ok(dto.preview.samplePackKeys.includes('hero'));

    const custom = customisePresetBlueprint(dto, { userId: 'u1' });
    assert.equal(custom.kind, 'user_design');
    assert.equal(custom.readOnly, false);
    assert.equal(custom.sourcePresetSlug, 'trade-trust');
    assert.match(custom.name, /custom/i);
  });

  it('does not mutate the source layout object', () => {
    const layout = {
      slug: 'x',
      name: 'X',
      section_order: ['hero'],
      apps: [{ section_key: 'hero', enabled: true }],
      demo_packs: { hero: { heading: 'Keep' } },
    };
    const before = JSON.stringify(layout);
    positioningLayoutToPresetBlueprint(layout);
    assert.equal(JSON.stringify(layout), before);
  });

  it('ships additive blueprint SQL without dropping sites or themes', () => {
    assert.match(sql, /create table if not exists public\.design_blueprints/i);
    assert.match(sql, /create table if not exists public\.design_blueprint_versions/i);
    assert.match(sql, /create table if not exists public\.user_designs/i);
    assert.match(sql, /add column if not exists blueprint_id/);
    assert.doesNotMatch(sql, /drop table\s+public\.sites/i);
    assert.doesNotMatch(sql, /drop table\s+public\.positioning_layouts/i);
  });

  it('feature-flags entry stub and API', () => {
    assert.equal(isLayoutComposerEnabled({ LAYOUT_COMPOSER: '1' }), true);
    assert.equal(isLayoutComposerEnabled({ LAYOUT_COMPOSER: '0' }), false);
    assert.equal(layoutComposerFlagPayload({}).enabled, false);
    assert.equal(layoutComposerFlagPayload({ LAYOUT_COMPOSER: 'true' }).enabled, true);
    assert.match(stub, /Layout Composer/);
    assert.match(stub, /Preset Designs/);
    assert.match(stub, /My Designs/);
    assert.match(stub, /Start from scratch/);
    assert.match(stub, /Existing site/);
    assert.match(stub, /\/api\/layout-composer\/flags/);
    assert.match(apiFlags, /layoutComposerFlagPayload/);
    assert.match(vercel, /"\/layout-composer"/);
    assert.match(manage, /btn-layout-composer/);
  });

  it('architecture doc records Phase 2 delivery notes', () => {
    assert.match(arch, /Phase 2/);
    assert.match(arch, /design_blueprints/);
    assert.match(arch, /libraryOnly/);
  });
});
