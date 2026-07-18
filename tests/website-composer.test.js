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
  RENDERER_SHELL_LANDING_V1
} = require('../lib/website-composer');

const briefs = require('../fixtures/website-composer/briefs');

const TRADE_LEAK = /\b(drains?|plumb(ing|er)?|hedge\s*trimm|hi[- ]?vis|blocked\s+drain|emergency\s+call[- ]?outs?)\b/i;
const JEWELLERY_LEAK = /\b(pink\s+diamonds?|engagement\s+rings?|carat)\b/i;
const COFFEE_LEAK = /\b(coffee\s+cart|barista|latte)\b/i;

/** Content-only scan — excludes theme token keys like `hivis`. */
function contentText(draft) {
  return JSON.stringify({
    name: draft.name,
    sections: draft.sections,
    services: draft.services,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    imageBriefs: draft.__websiteComposer && draft.__websiteComposer.imageBriefs
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
      // Foundations must not embed business copy blobs
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
    assert.equal(ranked[0].recipeId, 'recipe-coffee-event');
  });
});

describe('Website Composer — six business fixtures', () => {
  const expectations = [
    {
      brief: briefs.BEAN_CULTURE,
      foundationId: 'hospitality',
      recipeId: 'recipe-coffee-event',
      mustMatch: /Bean Culture/i,
      mustNot: TRADE_LEAK
    },
    {
      brief: briefs.PINK_DIAMOND_VAULT,
      foundationId: 'retail',
      recipeId: 'recipe-luxury-jewellery',
      mustMatch: /Pink Diamond Vault/i,
      mustNot: TRADE_LEAK
    },
    {
      brief: briefs.CANBERRA_ELECTRICIAN,
      foundationId: 'trades',
      recipeId: 'recipe-field-trade',
      mustMatch: /Canberra Electrician/i,
      mustNot: JEWELLERY_LEAK
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
    it('composes complete draft for ' + exp.brief.fixtureId, () => {
      const profile = classifyBusiness(exp.brief);
      assert.ok(profile.profileId);

      const result = composeWebsiteConcepts(exp.brief, { count: 3 });
      assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded, null, 2));
      assert.equal(result.foundationId, exp.foundationId);
      assert.equal(result.recipeId, exp.recipeId);
      assert.ok(result.concepts.length >= 1);

      for (const item of result.concepts) {
        const draft = item.draftConfig;
        const text = contentText(draft);
        assert.match(text, exp.mustMatch);
        assert.doesNotMatch(text, exp.mustNot);

        // No trade content inheritance
        assert.equal(draft.__websiteComposer.contentInheritance, 'none');
        assert.equal(draft.__websiteComposer.foundationId, exp.foundationId);
        assert.equal(draft.__websiteComposer.recipeId, exp.recipeId);
        assert.ok(!draft.sourceTemplateId);

        // Every active section fully populated and on
        assert.ok(Array.isArray(draft.sectionOrder) && draft.sectionOrder.length >= 4);
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
            (Array.isArray(sec.items) && sec.items.length);
          assert.ok(hasContent, 'thin section ' + key);
        }

        // Inactive known sections explicitly disabled (no plumber default bleed)
        for (const key of KNOWN_SECTION_KEYS) {
          if (draft.sectionOrder.includes(key)) continue;
          assert.equal(draft.sections[key].on, false, key + ' should be disabled');
        }

        // Image briefs are placeholders only
        assert.ok(draft.__websiteComposer.imageBriefs.heroImage);
        assert.ok(item.concept.imagery.length >= 1);
        assert.equal(item.concept.imagery[0].provider, 'placeholder');

        // Diagnostics present
        const d = item.diagnostics;
        assert.ok(d);
        assert.equal(d.foundation.id, exp.foundationId);
        assert.equal(d.recipe.id, exp.recipeId);
        assert.ok(Array.isArray(d.appsSelected));
        assert.ok(d.layoutSelected);
        assert.ok(Object.keys(d.contentSources).length >= 4);
        assert.ok(Array.isArray(d.sectionsSkipped));
      }
    });
  }

  it('does not leak jewellery content into electrician drafts', () => {
    const result = composeWebsiteConcepts(briefs.CANBERRA_ELECTRICIAN);
    const text = contentText(result.concepts[0].draftConfig);
    assert.doesNotMatch(text, JEWELLERY_LEAK);
    assert.doesNotMatch(text, COFFEE_LEAK);
  });

  it('does not leak trade or jewellery into Bean Culture', () => {
    const result = composeWebsiteConcepts(briefs.BEAN_CULTURE);
    const text = contentText(result.concepts[0].draftConfig);
    assert.doesNotMatch(text, TRADE_LEAK);
    assert.doesNotMatch(text, JEWELLERY_LEAK);
    assert.match(text, /coffee/i);
  });

  it('ignores sourceConfig shallow merge (no inherited plumber hero)', () => {
    const dirtySource = {
      name: 'Blocked Drain Bros',
      sections: {
        hero: { on: true, title: 'Blocked drain?', sub: 'Emergency plumbing' },
        emerg: { on: true, text: '24/7 emergency call-outs' }
      }
    };
    const result = composeWebsiteConcepts(briefs.PINK_DIAMOND_VAULT, {
      sourceConfig: dirtySource,
      count: 1
    });
    assert.equal(result.ok, true);
    const draft = result.concepts[0].draftConfig;
    assert.equal(draft.name, 'Pink Diamond Vault');
    assert.doesNotMatch(JSON.stringify(draft.sections.hero), /blocked\s+drain/i);
    assert.doesNotMatch(JSON.stringify(draft), /emergency\s+call[- ]?outs?/i);
    assert.equal(draft.__websiteComposer.contentInheritance, 'none');
  });
});
