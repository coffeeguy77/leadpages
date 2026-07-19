'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const { buildServices, servicesFromBrief } = require('../lib/website-composer/content');
const { classifyBusiness } = require('../lib/website-composer/classify');
const { getRecipe } = require('../lib/website-composer/recipes');

const SPARSE_RC_BRIEF = {
  businessName: 'RC Car Shop',
  industry: 'RC',
  businessType: 'Retail',
  specialisation: 'RC Car sales and service',
  location: 'Canberra',
  mainServices: 'RC Car sales and servcie',
  conversionGoal: 'Plan your visit',
  desiredStyle: 'Industrial, Premium, Dynamic multi terrain',
  preferredColours: ['#3a1f2b', '#f4efe8', '#c4a484'],
  notes: 'Hobby RC cars for multi-terrain fun.'
};

describe('Website Composer — sparse services briefs', () => {
  it('splits a single “and” services line into multiple cards', () => {
    const profile = classifyBusiness(SPARSE_RC_BRIEF);
    const fromBrief = servicesFromBrief(SPARSE_RC_BRIEF, profile);
    assert.ok(fromBrief);
    assert.ok(fromBrief.length >= 2, 'expected split on “and”, got ' + fromBrief.length);
  });

  it('pads sparse mainServices to at least 3 cards', () => {
    const profile = classifyBusiness(SPARSE_RC_BRIEF);
    const recipe = getRecipe(profile.preferredRecipeId) || getRecipe('recipe-general-services');
    const services = buildServices(SPARSE_RC_BRIEF, profile, recipe);
    assert.ok(services.length >= 3, 'expected ≥3 services, got ' + services.length);
    assert.match(services[0].title, /RC Car sales/i);
  });

  it('composes three concepts without item_count_invalid', async () => {
    const result = await composeWebsiteConcepts(SPARSE_RC_BRIEF, {
      count: 3,
      allowMockImages: true,
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) })
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors || result, null, 2));
    assert.equal(result.concepts.length, 3);
    const services = result.concepts[0].draftConfig.sections.services;
    assert.ok(services && Array.isArray(services.items));
    assert.ok(services.items.length >= 3);
  });
});
