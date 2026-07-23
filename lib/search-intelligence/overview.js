'use strict';

/**
 * Build SEO Command Centre overview — config audit + optional HTML crawl + connections.
 */

const { listRecipes, getRecipe } = require('./recipes/registry');
const { createGateway } = require('./providers/gateway');
const { auditSiteConfig } = require('./audit/config-audit');
const { crawlSiteHome } = require('./audit/html-crawl');
const oauthCfg = require('./google-oauth/config');

function connectionFromOAuth(providerId, row) {
  return oauthCfg.connectionStatus(providerId, row || null);
}

/**
 * @param {object} opts
 * @param {string} opts.siteId
 * @param {object} [opts.config]
 * @param {string} [opts.businessName]
 * @param {object} [opts.site] site row (slug, custom_domain, status)
 * @param {boolean} [opts.includeRecipeCatalog]
 * @param {boolean} [opts.crawl] when true, fetch public homepage HTML (SSRF-safe)
 * @param {string} [opts.demoKeyword]
 * @param {object} [opts.connectionRows] map provider -> si_connections row
 */
async function buildOverview(opts) {
  const o = opts || {};
  const siteId = String(o.siteId || '').trim();
  const cfg = o.config || {};
  const rows = o.connectionRows || {};
  const site = o.site || { id: siteId, slug: o.siteSlug || null, custom_domain: o.customDomain || null, status: o.siteStatus || null };

  const audit = auditSiteConfig(cfg, {
    siteId: siteId,
    businessName: o.businessName || null
  });

  let crawl = null;
  if (o.crawl) {
    try {
      crawl = await crawlSiteHome(site, cfg, {
        appOrigin: o.appOrigin || null,
        timeoutMs: o.crawlTimeoutMs || 8000
      });
    } catch (e) {
      crawl = {
        ok: false,
        error: String((e && e.message) || e),
        findings: [],
        issueCount: 0
      };
    }
  }

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
  const gscTotals = o.gscTotals || null;
  const organic = o.organicSummary || null;

  const crawlIssues = crawl && crawl.findings ? crawl.findings.length : 0;
  const openIssues = audit.issueCount + crawlIssues;

  const hasGscData = !!(gscTotals && gscTotals.available && gscTotals.rows > 0);
  const hasOrganic = !!(organic && organic.available);

  const cards = [
    {
      id: 'search_visibility',
      label: 'Search Visibility',
      value: null,
      state: gsc.status !== 'connected' ? 'awaiting_gsc' : !gsc.propertyId ? 'select_property' : hasGscData ? 'pending_score' : 'pending_sync',
      labelClass: 'modelled',
      hint: gsc.status !== 'connected'
        ? 'Connect Google Search Console to score visibility.'
        : !gsc.propertyId
          ? 'Select a Search Console property, then sync.'
          : 'Visibility score lands after enough synced query data.'
    },
    {
      id: 'organic_clicks',
      label: 'Organic clicks',
      value: hasGscData ? gscTotals.clicks : null,
      state: hasGscData ? 'ok' : gsc.status === 'connected' ? 'pending_sync' : 'awaiting_gsc',
      labelClass: 'measured',
      hint: hasGscData
        ? 'GSC clicks for ' + gscTotals.startDate + ' → ' + gscTotals.endDate + '.'
        : 'GSC clicks appear after property sync.'
    },
    {
      id: 'organic_impressions',
      label: 'Organic impressions',
      value: hasGscData ? gscTotals.impressions : null,
      state: hasGscData ? 'ok' : gsc.status === 'connected' ? 'pending_sync' : 'awaiting_gsc',
      labelClass: 'measured',
      hint: hasGscData
        ? 'GSC impressions for the synced window.'
        : 'GSC impressions after sync.'
    },
    {
      id: 'search_leads',
      label: 'Search leads',
      value: hasOrganic ? organic.organicLeads : null,
      state: hasOrganic ? 'ok' : 'awaiting_attribution',
      labelClass: (organic && organic.labelClass) || 'modelled',
      hint: hasOrganic
        ? organic.organicCallClicks + ' call-clicks · ' + organic.organicForms + ' forms (organic, ' + organic.days + 'd).'
        : 'Forms and call-clicks with modelled organic attribution.'
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
      value: openIssues,
      state: openIssues ? 'attention' : 'ok',
      labelClass: 'measured',
      hint: openIssues
        ? 'From config audit' + (crawlIssues ? ' and live HTML crawl' : '') + '.'
        : 'No config' + (crawl ? ' or crawl' : '') + ' issues detected.'
    }
  ];

  const nextBestActions = audit.findings.slice();
  if (crawl && Array.isArray(crawl.findings)) {
    crawl.findings.forEach(function (f) {
      nextBestActions.push(f);
    });
  }
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

  const hasOpen = openIssues > 0;
  return {
    ok: true,
    siteId: siteId,
    phase: 1,
    scaffold: true,
    message: hasOpen
      ? 'Found ' + openIssues + ' issue(s) from config' + (crawlIssues ? '/crawl' : '') + '. Connect GSC/GA4 for search performance.'
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
    crawl: crawl
      ? {
          ok: crawl.ok,
          skipped: !!crawl.skipped,
          reason: crawl.reason || null,
          homeUrl: crawl.homeUrl || null,
          issueCount: crawl.issueCount || 0,
          crawledAt: crawl.crawledAt || null,
          head: crawl.head || null
        }
      : null,
    gscTotals: gscTotals,
    organicAttribution: organic,
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
