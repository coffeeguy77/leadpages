'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createGateway } = require('../lib/search-intelligence/providers/gateway');
const { computeOpportunityValue } = require('../lib/search-intelligence/scoring/opportunity-value');
const { RECIPES, getRecipe, listRecipes } = require('../lib/search-intelligence/recipes/registry');

describe('Search Intelligence stubs', () => {
  it('gateway mock path returns keyword ideas', async () => {
    const gw = createGateway({ provider: 'mock' });
    const res = await gw.keywordIdeas({ keyword: 'plumber', location: 'Canberra,AU' });
    assert.equal(res.ok, true);
    assert.equal(res.provider, 'mock');
    assert.ok(Array.isArray(res.ideas) && res.ideas.length >= 1);
    assert.equal(res.ideas[0].labelClass, 'estimated');
  });

  it('gateway reports budget_exceeded', async () => {
    const gw = createGateway({ provider: 'mock', budgetRemaining: 0 });
    const res = await gw.serp({ keyword: 'plumber canberra' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'budget_exceeded');
  });

  it('dataforseo adapter is not_configured', async () => {
    const gw = createGateway({ provider: 'dataforseo' });
    const res = await gw.rankCheck({ keyword: 'plumber canberra' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'not_configured');
    assert.equal(res.provider, 'dataforseo');
  });

  it('opportunity value is modelled 0..1 with factor breakdown', () => {
    const out = computeOpportunityValue({
      volume: 720,
      cpc: 18,
      competition: 0.6,
      difficulty: 30,
      avgJobValue: 2500,
      offersService: true,
      hasRecipe: true
    });
    assert.equal(out.labelClass, 'modelled');
    assert.ok(out.score > 0 && out.score <= 1);
    assert.ok(out.factors.demand > 0);
    assert.ok(out.explanation);
  });

  it('registers the first ten recommendation recipes', () => {
    assert.equal(RECIPES.length, 10);
    assert.ok(getRecipe('high_impr_low_ctr'));
    assert.ok(getRecipe('keyword_no_page'));
    assert.equal(listRecipes(1).length, 10);
  });

  it('ships docs tree and draft SQL', () => {
    const root = path.join(__dirname, '..');
    const docs = [
      'docs/search-intelligence/00-VISION.md',
      'docs/search-intelligence/01-ARCHITECTURE.md',
      'docs/search-intelligence/02-DATA-MODEL.md',
      'docs/search-intelligence/03-CONNECTORS.md',
      'docs/search-intelligence/04-PROVIDER-GATEWAY.md',
      'docs/search-intelligence/05-COMMAND-CENTRE.md',
      'docs/search-intelligence/06-RECOMMENDATION-RECIPES.md',
      'docs/search-intelligence/07-SCORING.md',
      'docs/search-intelligence/08-ROADMAP.md',
      'docs/search-intelligence/09-SEARCH-DIGITAL-TWIN.md',
      'docs/search-intelligence/PHASE-0-BAKEOFF.md',
      'db/search_intelligence_schema.sql'
    ];
    docs.forEach(function (rel) {
      assert.ok(fs.existsSync(path.join(root, rel)), 'missing ' + rel);
    });
    const sql = fs.readFileSync(path.join(root, 'db/search_intelligence_schema.sql'), 'utf8');
    assert.match(sql, /si_connections/);
    assert.match(sql, /si_recommendations/);
    assert.match(sql, /DO NOT apply wholesale/);
  });

  it('builds Command Centre overview scaffold', async () => {
    const { buildOverview } = require('../lib/search-intelligence/overview');
    const ov = await buildOverview({ siteId: 'site-x', includeDemoRecipes: true });
    assert.equal(ov.ok, true);
    assert.equal(ov.scaffold, true);
    assert.equal(ov.connections.search_console.status, 'not_connected');
    assert.ok(ov.cards.length >= 4);
    assert.equal(ov.nextBestActions.length, 10);
  });

  it('wires SEO Command Centre manage tab + APIs', () => {
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /id="nav-seo"/);
    assert.match(manage, /id="av-seo"/);
    assert.match(manage, /function renderSeoCommandCentre/);
    assert.match(manage, /\/api\/search-intelligence\/overview/);
    assert.match(manage, /'trade':\[[^\]]*seo/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/overview.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/recommendations.js')));
  });
});
