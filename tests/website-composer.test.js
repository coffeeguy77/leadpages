'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  listFoundations,
  getFoundation,
  listRecipes,
  composeWebsiteConcepts,
  classifyBusiness,
  selectRecipeCandidates,
  KNOWN_SECTION_KEYS,
  RENDERER_SHELL_LANDING_V1,
  listSupportedApps,
  listAppMetadataIds,
  listAdapterIds,
  isAppSupported,
  assertSupportedApp,
  adaptApp,
  getAppMetadata
} = require('../lib/website-composer');

const briefs = require('../fixtures/website-composer/briefs');

const TRADE_LEAK = /\b(drains?|plumb(ing|er)?|hedge\s*trimm|hi[- ]?vis|blocked\s+drain|emergency\s+call[- ]?outs?)\b/i;
const JEWELLERY_LEAK = /\b(pink\s+diamonds?|engagement\s+rings?|carat)\b/i;
const COFFEE_LEAK = /\b(coffee\s+cart|barista|latte)\b/i;

/** Content-only scan — excludes theme token keys like `hivis` and image avoid-lists. */
function contentText(draft) {
  return JSON.stringify({
    name: draft.name,
    sections: draft.sections,
    services: draft.services,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription
  });
}

describe('Website Composer — foundations (structural only)', () => {
  it('registers foundations across required categories without sourceTemplateId trade', () => {
    const list = listFoundations();
    assert.ok(list.length >= 16);
    const categories = new Set(list.map((f) => f.category));
    for (const cat of [
      'trades',
      'professional',
      'hospitality',
      'retail',
      'health',
      'beauty',
      'events',
      'construction',
      'creative',
      'education',
      'technology',
      'non-profit',
      'travel',
      'manufacturing',
      'industrial',
      'automotive'
    ]) {
      assert.ok(categories.has(cat), 'missing category ' + cat);
    }
    for (const f of list) {
      assert.equal(f.sourceTemplateId, null, f.id + ' must not set sourceTemplateId');
      assert.equal(f.rendererShellId, RENDERER_SHELL_LANDING_V1);
      assert.ok(Array.isArray(f.sectionPlaceholders));
      assert.ok(Array.isArray(f.navigationDefaults));
      assert.ok(f.spacingProfile);
      assert.ok(Array.isArray(f.recommendedAppRegions));
      assert.equal(f.services, undefined);
      assert.equal(f.faqs, undefined);
      assert.equal(f.testimonials, undefined);
    }
  });

  it('resolves legacy foundation aliases', () => {
    assert.equal(getFoundation('retail-boutique').id, 'retail');
    assert.equal(getFoundation('trade-field-services').id, 'trades');
    assert.equal(getFoundation('hospitality-cafe').id, 'hospitality');
  });
});

describe('Website Composer — recipes independent of foundations', () => {
  it('lists recipes including hospitality variants', () => {
    const recipes = listRecipes();
    assert.ok(recipes.length >= 10);
    const ids = new Set(recipes.map((r) => r.id));
    assert.ok(ids.has('recipe-coffee-event'));
    assert.ok(ids.has('recipe-cafe'));
    assert.ok(ids.has('recipe-restaurant'));
    assert.ok(ids.has('recipe-coffee-roaster'));
    assert.ok(ids.has('recipe-luxury-jewellery'));
    assert.ok(ids.has('recipe-field-trade'));
  });

  it('allows coffee-event recipe on hospitality foundation', () => {
    const ranked = selectRecipeCandidates({
      foundationId: 'hospitality',
      industry: 'coffee-event',
      specialisation: 'mobile barista',
      profileId: 'coffee-event'
    });
    assert.ok(ranked.length >= 1);
    assert.equal(ranked[0].recipeId, 'recipe-coffee-event');
  });
});

describe('Website Composer — marketplace support gates', () => {
  it('every supported catalogue app has metadata and an adapter', () => {
    const supported = listSupportedApps();
    assert.ok(supported.length >= 15);
    const metaIds = new Set(listAppMetadataIds());
    const adapterIds = new Set(listAdapterIds());
    for (const app of supported) {
      assert.ok(metaIds.has(app.appId), 'missing metadata for ' + app.appId);
      assert.ok(adapterIds.has(app.appId) || app.appId === 'footer', 'missing adapter for ' + app.appId);
      assert.equal(getAppMetadata(app.appId).status, 'supported');
    }
  });

  it('rejects unknown and unsupported app IDs from auto-selection', () => {
    assert.equal(isAppSupported('notARealApp'), false);
    assert.equal(assertSupportedApp('notARealApp').ok, false);
    const adapted = adaptApp('notARealApp', { title: 'x' });
    assert.equal(adapted.ok, false);
  });

  it('rejects unknown hero variants via adapter validation', () => {
    const bad = adaptApp('heroSlider', { slides: [{ heading: 'Only one' }] });
    assert.equal(bad.ok, false);
    assert.ok((bad.errors || []).some((e) => e.code === 'item_count_invalid'));
  });
});

describe('Website Composer — six business fixtures', () => {
  const expectations = [
    {
      brief: briefs.BEAN_CULTURE,
      foundationId: 'hospitality',
      recipeId: 'recipe-coffee-event',
      mustMatch: /Bean Culture/i,
      mustNot: TRADE_LEAK,
      mustIncludeApps: ['services', 'serviceProcess', 'featuredProjects', 'quote']
    },
    {
      brief: briefs.PINK_DIAMOND_VAULT,
      foundationId: 'retail',
      recipeId: 'recipe-luxury-jewellery',
      mustMatch: /Pink Diamond Vault/i,
      mustNot: TRADE_LEAK,
      mustIncludeApps: ['featuredProjects', 'quote']
    },
    {
      brief: briefs.CANBERRA_ELECTRICIAN,
      foundationId: 'trades',
      recipeId: 'recipe-field-trade',
      mustMatch: /Canberra Electrician/i,
      mustNot: JEWELLERY_LEAK,
      mustIncludeApps: ['services', 'quote']
    },
    {
      brief: briefs.COMMERCIAL_LAWYER,
      foundationId: 'professional-services',
      recipeId: 'recipe-commercial-legal',
      mustMatch: /Harbour & Co Legal/i,
      mustNot: TRADE_LEAK
    },
    {
      brief: briefs.HAIR_SALON,
      foundationId: 'beauty',
      recipeId: 'recipe-hair-salon',
      mustMatch: /Northside Hair Atelier/i,
      mustNot: TRADE_LEAK
    },
    {
      brief: briefs.WEDDING_PHOTOGRAPHER,
      foundationId: 'creative',
      recipeId: 'recipe-wedding-photographer',
      mustMatch: /Amberlight Weddings/i,
      mustNot: TRADE_LEAK
    }
  ];

  for (const exp of expectations) {
    it('composes complete draft for ' + exp.brief.fixtureId, async () => {
      const profile = classifyBusiness(exp.brief);
      assert.ok(profile.profileId);

      const result = await composeWebsiteConcepts(exp.brief, {
        count: 3,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded, null, 2));
      assert.equal(result.foundationId, exp.foundationId);
      assert.equal(result.recipeId, exp.recipeId);
      assert.ok(result.concepts.length >= 1);

      const heroSet = new Set();
      const orderSet = new Set();

      for (const item of result.concepts) {
        const draft = item.draftConfig;
        const text = contentText(draft);
        assert.match(text, exp.mustMatch);
        assert.doesNotMatch(text, exp.mustNot);

        assert.equal(draft.__websiteComposer.contentInheritance, 'none');
        assert.equal(draft.__websiteComposer.foundationId, exp.foundationId);
        assert.equal(draft.__websiteComposer.recipeId, exp.recipeId);
        assert.ok(!draft.sourceTemplateId);

        assert.ok(Array.isArray(draft.sectionOrder) && draft.sectionOrder.length >= 4);
        assert.ok(Array.isArray(draft.__websiteComposer.installedApps));
        assert.ok(draft.__websiteComposer.installedApps.length >= 3);

        for (const key of draft.sectionOrder) {
          const sec = draft.sections[key];
          assert.ok(sec, 'missing section ' + key);
          assert.equal(sec.on, true);
          assert.ok(sec.provenance, 'missing provenance on ' + key);
          const hasContent =
            sec.title ||
            sec.heading ||
            sec.sub ||
            sec.subheading ||
            sec.text ||
            sec.intro ||
            sec.blurb ||
            sec.cta ||
            sec.buttonText ||
            (Array.isArray(sec.items) && sec.items.length) ||
            (Array.isArray(sec.slides) && sec.slides.length) ||
            (Array.isArray(sec.steps) && sec.steps.length) ||
            (Array.isArray(sec.projects) && sec.projects.length) ||
            (Array.isArray(sec.badges) && sec.badges.length);
          assert.ok(hasContent, 'thin section ' + key);
        }

        for (const key of KNOWN_SECTION_KEYS) {
          if (draft.sectionOrder.includes(key)) continue;
          assert.equal(draft.sections[key].on, false, key + ' should be disabled');
        }

        if (exp.mustIncludeApps) {
          for (const appId of exp.mustIncludeApps) {
            assert.ok(draft.sectionOrder.includes(appId), exp.brief.fixtureId + ' missing ' + appId);
          }
        }

        assert.ok(draft.__websiteComposer.imageBriefs.heroImage);
        assert.ok(item.concept.imagery.length >= 1);
        const provider = item.concept.imagery[0].provider;
        assert.ok(['mock', 'placeholder', 'pexels', 'cloudinary'].includes(provider), provider);
        assert.ok(item.concept.imagery[0].providerAssetId);
        assert.ok(draft.__websiteComposer.imageDirection);

        const d = item.diagnostics;
        assert.ok(d);
        assert.equal(d.foundation.id, exp.foundationId);
        assert.equal(d.recipe.id, exp.recipeId);
        assert.ok(Array.isArray(d.appsSelected));
        assert.ok(d.layoutSelected);
        assert.ok(Object.keys(d.contentSources).length >= 4);
        assert.ok(Array.isArray(d.sectionsSkipped));
        assert.ok(d.appSelection);
        assert.ok(d.imageDirection);

        heroSet.add(d.appSelection.heroAppId);
        orderSet.add(draft.sectionOrder.join('|'));
      }

      assert.ok(heroSet.size >= 2 || orderSet.size >= 2, 'concepts must differ structurally');
    });
  }

  it('does not leak jewellery content into electrician drafts', async () => {
    const result = await composeWebsiteConcepts(briefs.CANBERRA_ELECTRICIAN, {
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const text = contentText(result.concepts[0].draftConfig);
    assert.doesNotMatch(text, JEWELLERY_LEAK);
    assert.doesNotMatch(text, COFFEE_LEAK);
  });

  it('does not leak trade or jewellery into Bean Culture', async () => {
    const result = await composeWebsiteConcepts(briefs.BEAN_CULTURE, {
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const text = contentText(result.concepts[0].draftConfig);
    assert.doesNotMatch(text, TRADE_LEAK);
    assert.doesNotMatch(text, JEWELLERY_LEAK);
    assert.match(text, /coffee/i);
    assert.match(text, /Coffee cart|Coffee van|Coffee caravan/i);
  });

  it('ignores sourceConfig shallow merge (no inherited plumber hero)', async () => {
    const dirtySource = {
      name: 'Blocked Drain Bros',
      sections: {
        hero: { on: true, title: 'Blocked drain?', sub: 'Emergency plumbing' },
        emerg: { on: true, text: '24/7 emergency call-outs' }
      }
    };
    const result = await composeWebsiteConcepts(briefs.PINK_DIAMOND_VAULT, {
      sourceConfig: dirtySource,
      count: 1,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true);
    const draft = result.concepts[0].draftConfig;
    assert.equal(draft.name, 'Pink Diamond Vault');
    assert.doesNotMatch(JSON.stringify(draft.sections.hero), /blocked\s+drain/i);
    assert.doesNotMatch(contentText(draft), /emergency\s+call[- ]?outs?/i);
    assert.equal(draft.__websiteComposer.contentInheritance, 'none');
  });
});
