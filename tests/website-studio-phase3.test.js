'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  composeWebsiteConcepts,
  listCatalogueApps,
  listSupportedApps,
  listAppMetadataIds,
  listAdapterIds,
  adaptApp,
  assertSupportedApp,
  selectAppsForConcept,
  getFoundation,
  selectFoundationCandidates,
  selectRecipe,
  classifyBusiness
} = require('../lib/website-composer');
const { renderDraftPreviewHtml } = require('../lib/theme-studio/render-preview');
const { assertAiImageAccess } = require('../lib/image-service');
const briefs = require('../fixtures/website-composer/briefs');

describe('Website Studio Phase 3 — marketplace catalogue integrity', () => {
  it('catalogues every audited app with a Website Studio support status', () => {
    const apps = listCatalogueApps();
    assert.ok(apps.length >= 40);
    const statuses = new Set([
      'supported',
      'supported-with-limitations',
      'requires-adapter',
      'requires-metadata',
      'incompatible',
      'deprecated'
    ]);
    for (const app of apps) {
      assert.ok(app.appId);
      assert.ok(app.sectionKey);
      assert.ok(statuses.has(app.websiteStudioSupport), app.appId + ' bad status');
      assert.ok(Array.isArray(app.sourceFilesInspected));
    }
  });

  it('only auto-selects supported apps with adapters', () => {
    const supported = new Set(listSupportedApps().map((a) => a.appId));
    const adapters = new Set(listAdapterIds());
    const meta = new Set(listAppMetadataIds());
    for (const id of supported) {
      assert.ok(meta.has(id), 'metadata missing ' + id);
      assert.ok(adapters.has(id) || id === 'footer', 'adapter missing ' + id);
    }
    // Unsupported must fail assert
    const unsupported = listCatalogueApps().find((a) => a.websiteStudioSupport !== 'supported');
    assert.ok(unsupported);
    assert.equal(assertSupportedApp(unsupported.appId).ok, false);
  });
});

describe('Website Studio Phase 3 — fixture app selections', () => {
  it('Bean Culture selects event coffee narrative apps', async () => {
    const result = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    const order = result.concepts[0].draftConfig.sectionOrder;
    for (const need of ['services', 'featuredProjects', 'specialOffer', 'serviceProcess', 'faq', 'quote']) {
      assert.ok(order.includes(need), 'missing ' + need);
    }
    assert.ok(!order.includes('emerg'));
    assert.ok(!order.includes('beforeAfter'));
    assert.ok(!order.includes('area'));
    const text = JSON.stringify(result.concepts[0].draftConfig.sections);
    assert.doesNotMatch(text, /blocked\s*drain|plumber|landscap(e|ing)\s+(design|crew)|pergola/i);
    assert.match(text, /Coffee cart|Coffee van|Coffee caravan/i);
  });

  it('Pink Diamond avoids trade apps and trade copy', async () => {
    const result = await composeWebsiteConcepts(briefs.PINK_DIAMOND_VAULT, {
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    const order = result.concepts[0].draftConfig.sectionOrder.join(',');
    assert.doesNotMatch(order, /emerg|beforeAfter|area|certifications/);
    const text = JSON.stringify(result.concepts[0].draftConfig.sections);
    assert.doesNotMatch(text, /\bplumb|\bdrains?\b|hi-?vis|tradie/i);
    assert.match(text, /Pink Diamond|appointment|collection/i);
  });

  it('Electrician may use trade-oriented apps without jewellery leakage', async () => {
    const result = await composeWebsiteConcepts(briefs.CANBERRA_ELECTRICIAN, {
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    const text = JSON.stringify(result.concepts[0].draftConfig.sections);
    assert.doesNotMatch(text, /pink\s+diamond|engagement\s+ring/i);
    assert.match(text, /Electrician|electrical/i);
  });
});

describe('Website Studio Phase 3 — renderer shell neutralization', () => {
  it('Bean Culture and Pink Diamond preview inject shell neutralize and keep drafts inheritance-none', async () => {
    for (const brief of [briefs.BEAN_CULTURE, briefs.PINK_DIAMOND_VAULT]) {
      const result = await composeWebsiteConcepts(brief, {
        count: 1,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true);
      const draft = result.concepts[0].draftConfig;
      assert.equal(draft.__websiteComposer.contentInheritance, 'none');
      assert.equal(draft.__websiteComposer.neutralizeShellDefaults, true);
      const html = renderDraftPreviewHtml(draft, { mode: 'desktop' });
      assert.match(html, /ws-shell-neutralize/);
      assert.match(html, /Website Studio preview/);
      // Diagnostics retain shell limitation note
      const warnings = result.concepts[0].diagnostics.rendererWarnings || [];
      assert.ok(warnings.some((w) => /shell|landing-shell|trade\.template/i.test(JSON.stringify(w))));
    }
  });

  it('Electrician preview still renders with trade-capable sections active when selected', async () => {
    const result = await composeWebsiteConcepts(briefs.CANBERRA_ELECTRICIAN, {
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const draft = result.concepts[0].draftConfig;
    const html = renderDraftPreviewHtml(draft, { mode: 'mobile' });
    assert.match(html, /ts-mobile-frame|max-width:412px/);
    assert.ok(draft.sections.services && draft.sections.services.on === true);
  });
});

describe('Website Studio Phase 3 — AI image server gate', () => {
  it('partners and clients cannot invoke AI image generation', () => {
    assert.equal(assertAiImageAccess({ isPartner: true, role: 'partner' }).ok, false);
    assert.equal(assertAiImageAccess({ isClient: true, role: 'client' }).ok, false);
    assert.equal(assertAiImageAccess({ isSuperuser: true }).ok, true);
  });
});

describe('Website Studio Phase 3 — incompatible apps excluded', () => {
  it('hospitality foundation excludes emerg/beforeAfter from selection', () => {
    const brief = briefs.BEAN_CULTURE;
    const profile = classifyBusiness(brief);
    const foundation = getFoundation(selectFoundationCandidates(brief, { limit: 1 })[0].foundationId);
    const recipe = selectRecipe(
      {
        foundationId: foundation.id,
        industry: brief.industry,
        specialisation: brief.specialisation,
        profileId: profile.profileId
      },
      { recipeId: profile.preferredRecipeId }
    );
    const sel = selectAppsForConcept({ foundation, recipe, profile, brief, slot: 0 });
    assert.ok(!sel.sectionOrder.includes('emerg'));
    assert.ok(!sel.sectionOrder.includes('beforeAfter'));
    assert.ok(sel.sectionOrder.includes('serviceProcess'));
  });
});

describe('Website Studio Phase 3 — adapter required fields', () => {
  it('rejects empty required hero fields', () => {
    const bad = adaptApp('hero', { title: '', sub: '' });
    assert.equal(bad.ok, false);
  });

  it('accepts populated services grid with item constraints', () => {
    const ok = adaptApp('services', {
      heading: 'Services',
      items: [
        { title: 'A', text: 'one' },
        { title: 'B', text: 'two' },
        { title: 'C', text: 'three' }
      ]
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.config.on, true);
  });
});
