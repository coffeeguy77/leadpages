'use strict';

/**
 * Build SEO Command Centre overview + NBA list (Phase 1 scaffold).
 * Connections and warehouse are stubs until GSC/GA4 + si_* are live.
 */

const { listRecipes, getRecipe } = require('./recipes/registry');
const { createGateway } = require('./providers/gateway');

function connectionStub(provider) {
  return {
    provider: provider,
    status: 'not_connected',
    propertyId: null,
    lastSyncAt: null,
    connectPath:
      provider === 'search_console'
        ? '/settings/integrations/search-console'
        : provider === 'ga4'
          ? '/settings/integrations/google-analytics'
          : null
  };
}

/**
 * @param {{ siteId: string, includeDemoRecipes?: boolean, demoKeyword?: string }} opts
 */
async function buildOverview(opts) {
  const o = opts || {};
  const siteId = String(o.siteId || '').trim();
  const recipes = listRecipes(1);

  let keywordPreview = null;
  if (o.demoKeyword) {
    const gw = createGateway({ provider: 'mock' });
    const ideas = await gw.keywordIdeas({
      keyword: o.demoKeyword,
      location: o.location || 'Australia'
    });
    if (ideas && ideas.ok) keywordPreview = ideas.ideas.slice(0, 5);
  }

  const cards = [
    {
      id: 'search_visibility',
      label: 'Search Visibility',
      value: null,
      state: 'awaiting_gsc',
      labelClass: 'modelled',
      hint: 'Connect Google Search Console to score visibility.'
    },
    {
      id: 'organic_clicks',
      label: 'Organic clicks',
      value: null,
      state: 'awaiting_gsc',
      labelClass: 'measured',
      hint: 'GSC clicks will appear here after the first sync.'
    },
    {
      id: 'organic_impressions',
      label: 'Organic impressions',
      value: null,
      state: 'awaiting_gsc',
      labelClass: 'measured',
      hint: 'GSC impressions after sync.'
    },
    {
      id: 'search_leads',
      label: 'Search leads',
      value: null,
      state: 'awaiting_attribution',
      labelClass: 'modelled',
      hint: 'Forms and call-clicks with modelled organic attribution.'
    },
    {
      id: 'tracked_keywords',
      label: 'Tracked keywords',
      value: 0,
      state: 'empty',
      labelClass: 'measured',
      hint: 'Add keywords after Phase 1 rank tracking ships.'
    },
    {
      id: 'technical_health',
      label: 'Open issues',
      value: 0,
      state: 'empty',
      labelClass: 'measured',
      hint: 'First-party crawl issues will list here.'
    }
  ];

  const nextBestActions = (o.includeDemoRecipes === false ? [] : recipes).map(function (r) {
    return {
      id: 'recipe:' + r.id,
      recipeId: r.id,
      title: r.title,
      plainLanguage: r.plainLanguage,
      severity: r.severityDefault,
      status: 'preview',
      actions: r.actions,
      autoFixAllowed: !!r.autoFixAllowed,
      evidence: { source: 'recipe_registry', note: 'Scaffold preview — not site-specific until connectors sync.' },
      labelClass: 'modelled'
    };
  });

  return {
    ok: true,
    siteId: siteId,
    phase: 1,
    scaffold: true,
    message:
      'SEO Command Centre Phase 1 scaffold. Connect GSC/GA4 and apply si_* schema to replace preview data.',
    connections: {
      search_console: connectionStub('search_console'),
      ga4: connectionStub('ga4'),
      google_ads: { provider: 'google_ads', status: 'see_advertising_tab', connectPath: '/settings/integrations/google-ads' }
    },
    cards: cards,
    nextBestActions: nextBestActions,
    keywordPreview: keywordPreview,
    docs: {
      vision: '/docs/search-intelligence/00-VISION.md',
      recipes: '/docs/search-intelligence/06-RECOMMENDATION-RECIPES.md',
      roadmap: '/docs/search-intelligence/08-ROADMAP.md'
    }
  };
}

function listRecommendationPreviews() {
  return listRecipes(1).map(function (r) {
    return {
      recipeId: r.id,
      title: r.title,
      plainLanguage: r.plainLanguage,
      severity: r.severityDefault,
      actions: r.actions,
      status: 'preview'
    };
  });
}

module.exports = {
  connectionStub: connectionStub,
  buildOverview: buildOverview,
  listRecommendationPreviews: listRecommendationPreviews,
  getRecipe: getRecipe
};
