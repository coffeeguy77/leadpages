'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const { buildServices, whyItems, servicesFromBrief } = require('../lib/website-composer/content');
const { classifyBusiness } = require('../lib/website-composer/classify');
const { scoreAppForContext } = require('../lib/website-composer/marketplace/app-metadata');
const { selectAppsForConcept } = require('../lib/website-composer/install-apps');
const { getFoundation } = require('../lib/website-composer/foundations');
const { getRecipe } = require('../lib/website-composer/recipes');

const LANDSCAPE_BRIEF = {
  businessName: 'Yass Valley Landscaping',
  industry: 'Landscaping',
  businessType: 'Garden design and construction',
  specialisation: 'Design, construction and outdoor living across Yass Valley',
  location: 'Yass NSW',
  serviceAreas: 'Yass, Canberra, Southern NSW',
  audience: 'Homeowners wanting premium outdoor living',
  desiredStyle: 'Premium outdoor editorial',
  conversionGoal: 'Request a landscaping quote',
  mainServices: [
    'Garden Design & Construction',
    'Retaining Walls & Hardscaping',
    'Outdoor Living & Entertaining',
    'Turf, Irrigation & Maintenance'
  ],
  differentiators: [
    'Design-led builds',
    'Local craftsmanship',
    'Clear project stages',
    'Lifestyle finish'
  ],
  notes:
    'Yass Valley Landscaping by One Eco builds outdoor spaces for life — design, construction, hardscaping and maintenance with a premium finish.'
};

describe('Website Studio — visual homepage composition', () => {
  it('classifies landscaping onto the visual showcase recipe', () => {
    const profile = classifyBusiness(LANDSCAPE_BRIEF);
    assert.equal(profile.profileId, 'landscaping');
    assert.equal(profile.preferredRecipeId, 'recipe-landscaping-showcase');
    assert.ok(getRecipe('recipe-landscaping-showcase'));
  });

  it('uses mainServices and differentiators from the brief', () => {
    const profile = classifyBusiness(LANDSCAPE_BRIEF);
    const recipe = getRecipe('recipe-landscaping-showcase');
    const services = buildServices(LANDSCAPE_BRIEF, profile, recipe);
    assert.equal(services[0].title, 'Garden Design & Construction');
    assert.equal(services.length, 4);
    assert.ok(servicesFromBrief(LANDSCAPE_BRIEF, profile));

    const why = whyItems(LANDSCAPE_BRIEF, profile);
    assert.equal(why[0].title, 'Design-led builds');
    assert.match(why[0].text, /Yass Valley Landscaping|outdoor spaces for life/i);
  });

  it('allows heroSlider on construction foundations', () => {
    const scored = scoreAppForContext('heroSlider', {
      industry: 'landscaping',
      foundationCategory: 'construction',
      conversionGoal: 'quote'
    });
    assert.ok(scored.score >= 0, JSON.stringify(scored));
  });

  it('selects heroSlider + image trust bar for landscaping concepts', () => {
    const profile = classifyBusiness(LANDSCAPE_BRIEF);
    const foundation = getFoundation('construction');
    const recipe = getRecipe('recipe-landscaping-showcase');
    const selected = selectAppsForConcept({
      foundation,
      recipe,
      profile,
      brief: LANDSCAPE_BRIEF,
      slot: 0
    });
    assert.equal(selected.heroAppId, 'heroSlider');
    assert.ok(selected.sectionOrder.includes('trustBar'));
    assert.ok(selected.sectionOrder.includes('featuredProjects'));
    assert.equal(selected.layoutHints.preferredLayoutId, 'hero-image-slider');
  });

  it('composes image-led landscaping drafts from the full brief', async () => {
    const result = await composeWebsiteConcepts(LANDSCAPE_BRIEF, {
      count: 3,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded || []).slice(0, 500));
    assert.equal(result.recipeId, 'recipe-landscaping-showcase');
    assert.ok(result.concepts.length >= 1);

    const first = result.concepts[0];
    const cfg = first.draftConfig;
    assert.equal(cfg.layout, 'hero-image-slider');
    assert.ok(cfg.sectionOrder.includes('heroSlider'), cfg.sectionOrder.join(','));
    assert.ok(cfg.sectionOrder.includes('trustBar'));

    const slider = cfg.sections.heroSlider;
    assert.ok(slider && slider.on !== false);
    assert.ok(Array.isArray(slider.slides) && slider.slides.length >= 2);
    assert.ok(
      slider.slides.some((s) => s.imageUrl || s.image),
      'hero slider slides should receive images'
    );

    const trust = cfg.sections.trustBar;
    assert.ok(trust && trust.on !== false);
    assert.equal(trust.mode, 'images');
    assert.ok(Array.isArray(trust.badges) && trust.badges.length >= 3);
    assert.ok(
      trust.badges.some((b) => b.image || b.imageUrl),
      'image trust bar badges should receive images'
    );
    assert.ok(
      trust.badges.some((b) => /Garden Design|Retaining|Outdoor|Turf/i.test(b.label || '')),
      'trust tiles should use service labels from the brief'
    );

    const services = cfg.services || (cfg.sections.services && cfg.sections.services.items) || [];
    assert.ok(services.length >= 3);
    assert.ok(services.some((s) => /Garden Design/i.test(s.title || s.name || '')));

    const story = cfg.sections.brandStory || cfg.sections.why;
    assert.ok(story);
    const storyBlob = JSON.stringify(story);
    assert.match(storyBlob, /outdoor spaces for life|Design-led builds|Yass Valley/i);

    // Concepts should not collapse to empty marketplace mounts
    const activeApps = cfg.sectionOrder.filter((k) => k !== 'footer' && cfg.sections[k] && cfg.sections[k].on !== false);
    assert.ok(activeApps.length >= 6, 'expected a populated marketplace homepage, got ' + activeApps.join(','));
  });
});
