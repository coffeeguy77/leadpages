'use strict';

/**
 * Build SEO Command Centre overview — config audit + connection stubs + optional recipe previews.
 */

const { listRecipes, getRecipe } = require('./recipes/registry');
const { createGateway } = require('./providers/gateway');
const { auditSiteConfig } = require('./audit/config-audit');
const oauthCfg = require('./google-oauth/config');

function connectionFromOAuth(providerId, row) {
  return oauthCfg.connectionStatus(providerId, row || null);
}

/**
 * @param {object} opts
 * @param {string} opts.siteId
 * @param {object} [opts.config]
 * @param {string} [opts.businessName]
 * @param {boolean} [opts.includeRecipeCatalog]
 * @param {string} [opts.demoKeyword]
 * @param {object} [opts.connectionRows] map provider -> si_connections row
 */
async function buildOverview(opts) {
  const o = opts || {};
  const siteId = String(o.siteId || '').trim();
  const cfg = o.config || {};
  const rows = o.connectionRows || {};

  const audit = auditSiteConfig(cfg, {
    siteId: siteId,
    businessName: o.businessName || null
  });

  let keywordPreview = null;
  if (o.demoKeyword) {
    const gw = createGateway({ provider: 'mock' });
    const ideas = await gw.keywordIdeas({
      keyword: o.demoKeyword,
      location: o.location || 'Australia'
    });
    if (ideas && ideas.ok) keywordPreview = ideas.ideas.slice(0, 5);
  }

  const gsc = connectionFromOAuth('search_console', rows.search_console);
  const ga4 = connectionFromOAuth('ga4', rows.ga4);

  const cards = [
    {
      id: 'search_visibility',
      label: 'Search Visibility',
      value: null,
      state: gsc.status === 'connected' ? 'pending_sync' : 'awaiting_gsc',
      labelClass: 'modelled',
      hint: 'Connect Google Search Console to score visibility.'
    },
    {
      id: 'organic_clicks',
      label: 'Organic clicks',
      value: null,
      state: gsc.status === 'connected' ? 'pending_sync' : 'awaiting_gsc',
      labelClass: 'measured',
      hint: 'GSC clicks will appear here after the first sync.'
    },
    {
      id: 'organic_impressions',
      label: 'Organic impressions',
      value: null,
      state: gsc.status === 'connected' ? 'pending_sync' : 'awaiting_gsc',
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
      value: audit.issueCount,
      state: audit.issueCount ? 'attention' : 'ok',
      labelClass: 'measured',
      hint: audit.issueCount
        ? 'From first-party config audit (sites.config).'
        : 'No config issues detected.'
    }
  ];

  const nextBestActions = audit.findings.slice();
  if (o.includeRecipeCatalog) {
    listRecipes(1).forEach(function (r) {
      if (nextBestActions.some(function (a) { return a.recipeId === r.id && a.status === 'open'; })) return;
      nextBestActions.push({
        id: 'recipe:' + r.id,
        recipeId: r.id,
        title: r.title,
        plainLanguage: r.plainLanguage,
        severity: 'low',
        status: 'catalog',
        actions: r.actions,
        autoFixAllowed: false,
        evidence: { source: 'recipe_registry', note: 'Catalog recipe — not detected on this site.' },
        labelClass: 'modelled'
      });
    });
  }

  const hasOpen = audit.issueCount > 0;
  return {
    ok: true,
    siteId: siteId,
    phase: 1,
    scaffold: true,
    message: hasOpen
      ? 'Found ' + audit.issueCount + ' issue(s) in site configuration. Connect GSC/GA4 for search performance.'
      : 'No config issues detected. Connect Search Console and GA4 for rankings, clicks and attribution.',
    connections: {
      search_console: gsc,
      ga4: ga4,
      google_ads: {
        provider: 'google_ads',
        status: 'see_advertising_tab',
        connectPath: '/settings/integrations/google-ads'
      }
    },
    cards: cards,
    audit: {
      issueCount: audit.issueCount,
      auditedAt: audit.auditedAt,
      source: audit.source
    },
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
      status: 'catalog'
    };
  });
}

module.exports = {
  connectionFromOAuth: connectionFromOAuth,
  buildOverview: buildOverview,
  listRecommendationPreviews: listRecommendationPreviews,
  getRecipe: getRecipe,
  auditSiteConfig: auditSiteConfig
};
