'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const { renderDraftPreviewHtml } = require('../lib/theme-studio/render-preview');
const { searchSampleStock } = require('../lib/image-service/providers/sample-stock');

const RC_BRIEF = {
  businessName: 'RC Car Shop',
  industry: 'RC cars, parts and hobby retail',
  businessType: 'Retail',
  specialisation: 'RC Car sales and service',
  location: 'Canberra',
  mainServices: 'RC Car sales and service, parts, upgrades, track days',
  conversionGoal: 'Plan your visit',
  desiredStyle: 'Industrial, Premium, Dynamic',
  preferredColours: ['#3a1f2b', '#f4efe8', '#c4a484'],
  audience: 'hobbyists and families',
  differentiators: 'in-store track, expert tuning',
  logoImageUrl:
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#c4a484"/><text x="12" y="26" fill="#1a1a1a" font-family="sans-serif" font-size="16" font-weight="700">RC</text></svg>'
    ),
  notes: 'Hobby RC cars for multi-terrain fun.'
};

describe('Website Studio — RC content, images, logo', () => {
  it('sample stock returns reachable photo URLs for RC queries', () => {
    const out = searchSampleStock({ query: 'remote control rc car racing', perPage: 3 });
    assert.equal(out.ok, true);
    assert.ok(out.results.length >= 2);
    for (const r of out.results) {
      assert.match(r.selectedVariantUrl, /^https:\/\/images\.(pexels|unsplash)\.com\//);
      assert.doesNotMatch(r.selectedVariantUrl, /example\.com/);
      assert.doesNotMatch(r.selectedVariantUrl, /^data:/);
    }
  });

  it('composes RC draft with photo URLs, logo image mode, and painted preview content', async () => {
    const result = await composeWebsiteConcepts(RC_BRIEF, {
      count: 1,
      allowMockImages: true,
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) })
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors || [], null, 2));
    assert.equal(result.recipeId, 'recipe-hobby-retail');

    const cfg = result.concepts[0].draftConfig;
    assert.equal(cfg.logo.mode, 'image');
    assert.match(cfg.logo.imageUrl, /^data:image\//);

    assert.ok((cfg.services || []).length >= 3);
    for (const s of cfg.services) {
      assert.ok(s.title && s.title === s.title.replace(/^parts$/i, 'nope'));
      assert.doesNotMatch(s.title, /^parts$/i);
      assert.doesNotMatch(s.title, /^service$/i);
    }

    const heroImg = (cfg.sections.hero && (cfg.sections.hero.image || cfg.sections.hero.imageUrl)) || '';
    assert.match(heroImg, /^https:\/\/images\.(pexels|unsplash)\.com\//, 'hero should use sample stock photo');

    const withImages = (cfg.services || []).filter((s) => s.image);
    assert.ok(withImages.length >= 1, 'service cards should receive images');

    const html = renderDraftPreviewHtml(cfg, { mode: 'desktop' });
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<(section|footer|aside|header|div)\b[^>]*\bhidden\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    assert.doesNotMatch(visible, /Hot water/i);
    assert.doesNotMatch(visible, /Same-day service/i);
    assert.doesNotMatch(visible, /Services built around you/i);
    assert.match(visible, /RC Car Shop/i);
    assert.match(visible, /Browse &amp; get set up|Browse & get set up/i);
    assert.match(visible, /https:\/\/images\.(pexels|unsplash)\.com\//);
    assert.match(visible, /data-hero-ssr="1"/);
    assert.match(visible, /class="svc/);
    assert.match(visible, /lp-logo/);

    // Gallery / trust should not collapse to duplicate placeholder SVGs
    const photoUrls = (JSON.stringify(cfg).match(/https:\/\/images\.(pexels|unsplash)\.com\/[^"\\]+/g) || []);
    assert.ok(photoUrls.length >= 4, 'expected multiple stock photos, got ' + photoUrls.length);
  });

  it('shell static footer still mentions Hot water before paint (documents residual)', () => {
    const shell = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'landing-shell-neutral-v1.template.json'), 'utf8')
    ).html;
    assert.match(shell, /Hot water/);
  });
});
