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

  it('dataforseo.configured reflects env credentials', () => {
    const dfs = require('../lib/search-intelligence/providers/dataforseo');
    const prevLogin = process.env.DATAFORSEO_LOGIN;
    const prevPass = process.env.DATAFORSEO_PASSWORD;
    const prevEmail = process.env.DATAFORSEO_EMAIL;
    const prevApiPass = process.env.DATAFORSEO_API_PASSWORD;
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.DATAFORSEO_EMAIL;
    delete process.env.DATAFORSEO_API_PASSWORD;
    assert.equal(dfs.configured(), false);
    process.env.DATAFORSEO_LOGIN = 'demo@example.com';
    process.env.DATAFORSEO_PASSWORD = 'secret';
    assert.equal(dfs.configured(), true);
    if (prevLogin == null) delete process.env.DATAFORSEO_LOGIN;
    else process.env.DATAFORSEO_LOGIN = prevLogin;
    if (prevPass == null) delete process.env.DATAFORSEO_PASSWORD;
    else process.env.DATAFORSEO_PASSWORD = prevPass;
    if (prevEmail == null) delete process.env.DATAFORSEO_EMAIL;
    else process.env.DATAFORSEO_EMAIL = prevEmail;
    if (prevApiPass == null) delete process.env.DATAFORSEO_API_PASSWORD;
    else process.env.DATAFORSEO_API_PASSWORD = prevApiPass;
  });

  it('gateway auto-prefers dataforseo when credentials set and SI_PROVIDER unset', () => {
    const prevProv = process.env.SI_PROVIDER;
    const prevKw = process.env.SI_KEYWORD_PROVIDER;
    const prevLogin = process.env.DATAFORSEO_LOGIN;
    const prevPass = process.env.DATAFORSEO_PASSWORD;
    delete process.env.SI_PROVIDER;
    delete process.env.SI_KEYWORD_PROVIDER;
    process.env.DATAFORSEO_LOGIN = 'demo@example.com';
    process.env.DATAFORSEO_PASSWORD = 'secret';
    const gw = createGateway({});
    assert.equal(gw.preferred, 'dataforseo');
    const forced = createGateway({ provider: 'mock' });
    assert.equal(forced.preferred, 'mock');
    if (prevProv == null) delete process.env.SI_PROVIDER;
    else process.env.SI_PROVIDER = prevProv;
    if (prevKw == null) delete process.env.SI_KEYWORD_PROVIDER;
    else process.env.SI_KEYWORD_PROVIDER = prevKw;
    if (prevLogin == null) delete process.env.DATAFORSEO_LOGIN;
    else process.env.DATAFORSEO_LOGIN = prevLogin;
    if (prevPass == null) delete process.env.DATAFORSEO_PASSWORD;
    else process.env.DATAFORSEO_PASSWORD = prevPass;
  });

  it('summary email HTML renders bullets and actions', () => {
    const { renderSummaryHtml } = require('../lib/search-intelligence/summary-email');
    const html = renderSummaryHtml({
      businessName: 'Demo Plumbing',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-28',
      bullets: ['Organic search: 12 clicks.'],
      topActions: [{ title: 'Fix title', plainLanguage: 'Add a clearer SEO title.' }]
    });
    assert.match(html, /Demo Plumbing/);
    assert.match(html, /Organic search: 12 clicks/);
    assert.match(html, /Fix title/);
    assert.match(html, /Open SEO Command Centre/);
  });

  it('classifies portfolio risk and rank drops', () => {
    const {
      classifyPortfolioRisk,
      countRankDrops
    } = require('../lib/search-intelligence/portfolio');
    const risk = classifyPortfolioRisk({
      health: 'partial',
      openActions: 4,
      criticalActions: 0,
      rankDrops: 0
    });
    assert.equal(risk.atRisk, true);
    assert.ok(risk.riskReasons.includes('open_actions'));
    const ok = classifyPortfolioRisk({ health: 'good', openActions: 1 });
    assert.equal(ok.atRisk, false);
    const drops = countRankDrops([
      { tracked_keyword_id: 'k1', position: 5, fetched_at: '2026-07-01' },
      { tracked_keyword_id: 'k1', position: 12, fetched_at: '2026-07-10' },
      { tracked_keyword_id: 'k2', position: 8, fetched_at: '2026-07-01' },
      { tracked_keyword_id: 'k2', position: 9, fetched_at: '2026-07-10' }
    ]);
    assert.equal(drops, 1);
  });

  it('semrush preference remaps away — Semrush permanently out of scope', async () => {
    const gw = createGateway({ provider: 'semrush' });
    assert.equal(gw.adapters.includes('semrush'), false);
    assert.ok(gw.adapters.includes('dataforseo'));
    assert.ok(gw.adapters.includes('mock'));
  });

  it('clusters tracked keywords by service head without locations', () => {
    const { buildClustersFromKeywords } = require('../lib/search-intelligence/clusters');
    const clusters = buildClustersFromKeywords([
      { keyword: 'plumber canberra', keywordId: '1', trackedId: 't1' },
      { keyword: 'emergency plumber canberra', keywordId: '2', trackedId: 't2' },
      { keyword: 'hot water canberra', keywordId: '3', trackedId: 't3' },
      { keyword: 'blocked drain sydney', keywordId: '4', trackedId: 't4' }
    ]);
    assert.ok(clusters.length >= 2);
    const plumber = clusters.find(function (c) { return c.head === 'plumber' || c.key === 'plumber'; });
    assert.ok(plumber);
    assert.ok(plumber.memberCount >= 2);
    assert.equal(plumber.labelClass, 'modelled');
  });

  it('page optimiser brief never allows silent publish', () => {
    const { buildPageBrief } = require('../lib/search-intelligence/page-optimiser');
    const brief = buildPageBrief(
      {
        id: 's1',
        business_name: 'Demo Plumbing',
        config: {
          region: 'Canberra',
          phone: '0400000000',
          pages: [{ slug: 'emergency-plumber', title: 'Emergency plumber' }],
          services: [{ title: 'Blocked drains' }]
        }
      },
      {
        id: 'c1',
        name: 'Plumber · Canberra',
        primaryKeyword: 'plumber canberra',
        secondaryKeywords: ['emergency plumber canberra'],
        location: 'canberra',
        head: 'plumber'
      }
    );
    assert.equal(brief.ok, true);
    assert.equal(brief.safeguards.publishAllowed, false);
    assert.equal(brief.safeguards.requiresHumanApproval, true);
    assert.match(brief.suggestedTitle, /Demo Plumbing/);
    assert.ok(brief.outline.length >= 4);
    assert.ok(brief.landingDraftHandoff.primaryKeyword);
    assert.ok(brief.landingDraftHandoff.extraInfo);
    assert.ok(Array.isArray(brief.internalLinks) && brief.internalLinks.length >= 1);
    assert.equal(brief.labelClass, 'modelled');
  });

  it('suggests internal links from site config only', () => {
    const { suggestInternalLinks } = require('../lib/search-intelligence/internal-links');
    const links = suggestInternalLinks(
      {
        business_name: 'Demo',
        config: {
          pages: [{ slug: 'hot-water', title: 'Hot water' }],
          services: [{ title: 'Plumbing' }]
        }
      },
      { primaryKeyword: 'hot water canberra', secondaryKeywords: [] }
    );
    assert.ok(links.some(function (l) { return l.url === '/'; }));
    assert.ok(links.some(function (l) { return l.url === '/hot-water'; }));
    assert.equal(links[0].labelClass, 'modelled');
  });

  it('builds schema patch without invented ratings and merges into config', () => {
    const {
      buildSchemaPatch,
      applySchemaPatchToConfig,
      tradeType
    } = require('../lib/search-intelligence/schema-patch');
    assert.equal(tradeType({ trade: 'Plumber' }), 'Plumber');
    const patch = buildSchemaPatch({
      id: 's1',
      business_name: 'Demo Plumbing',
      config: {
        trade: 'Plumber',
        region: 'Canberra',
        phone: '0400000000',
        sections: {
          faq: {
            items: [{ q: 'Same day?', a: 'Yes for emergencies.' }]
          }
        }
      }
    });
    assert.equal(patch.ok, true);
    assert.equal(patch.safeguards.publishAllowed, false);
    assert.ok(patch.blocks.some(function (b) { return b.id === 'local_business'; }));
    assert.ok(patch.blocks.some(function (b) { return b.id === 'faq_page'; }));
    const blob = JSON.stringify(patch);
    assert.equal(/AggregateRating|reviewCount|4\.9/.test(blob), false);
    const cfg = applySchemaPatchToConfig({}, patch, {});
    assert.ok(Array.isArray(cfg.seoJsonLd) && cfg.seoJsonLd.length >= 1);
  });

  it('ships annotations and schema-patch APIs', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/annotations.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/schema-patch.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/local.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/usage.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/annotations.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/schema-patch.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/local-listings.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/local-opportunity.js')));
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /_siAnnotate/);
    assert.match(manage, /landing_publish/);
    assert.match(manage, /si-schema-preview/);
    assert.match(manage, /schema-patch/);
    assert.match(manage, /_siLoadLocal/);
    const render = fs.readFileSync(path.join(__dirname, '..', 'api/render.js'), 'utf8');
    assert.match(render, /injectSeoJsonLd/);
    assert.match(render, /seoJsonLd/);
  });

  it('audits listings NAP and builds local opportunity gaps', () => {
    const { auditListings } = require('../lib/search-intelligence/local-listings');
    const { buildLocalOpportunityMap } = require('../lib/search-intelligence/local-opportunity');
    const bad = auditListings({ business_name: '', config: {} });
    assert.ok(bad.findings.length >= 1);
    const good = auditListings({
      business_name: 'Demo Plumbing',
      config: { phone: '0400111222', phoneText: '0400 111 222', region: 'Canberra' }
    });
    assert.ok(good.listingsScore > 0.5);
    const map = buildLocalOpportunityMap(
      {
        id: 's1',
        config: {
          sections: { serviceAreas: { areas: ['Canberra', 'Queanbeyan'] } }
        }
      },
      [{ keyword: 'plumber canberra', keywordId: '1' }]
    );
    assert.equal(map.ok, true);
    assert.ok(map.gapCount >= 1);
    assert.equal(map.labelClass, 'modelled');
  });

  it('ships clusters and page-optimiser APIs', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/clusters.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/page-optimiser.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/clusters.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/page-optimiser.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/usage.js')));
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /clusters/);
    assert.match(manage, /_siLoadClusters/);
    assert.match(manage, /page-optimiser/);
    assert.match(manage, /si-brief-brain/);
    assert.match(manage, /si_landing_handoff/);
    assert.match(manage, /lpConsumeSiHandoff/);
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db/search_intelligence_schema.sql'), 'utf8');
    assert.match(sql, /si_keyword_clusters/);
    assert.match(sql, /si_annotations/);
    assert.match(sql, /si_provider_usage/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/internal-links.js')));
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

  it('registers twenty recommendation recipes', () => {
    assert.equal(RECIPES.length, 20);
    assert.ok(getRecipe('high_impr_low_ctr'));
    assert.ok(getRecipe('keyword_no_page'));
    assert.ok(getRecipe('listings_nap_gap'));
    assert.ok(getRecipe('schema_missing_local'));
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
    assert.match(sql, /si_ga4_landing_stats/);
    assert.match(sql, /DO NOT apply wholesale/);
  });

  it('builds Command Centre overview from config audit', async () => {
    const { buildOverview } = require('../lib/search-intelligence/overview');
    const ov = await buildOverview({
      siteId: 'site-x',
      config: { seoTitle: '', seoDescription: '', phone: '', sections: { quote: { on: false } } },
      includeRecipeCatalog: false
    });
    assert.equal(ov.ok, true);
    assert.ok(ov.audit.issueCount >= 2);
    assert.ok(ov.cards.find((c) => c.id === 'technical_health').value >= ov.audit.issueCount);
    assert.ok(ov.cards.find((c) => c.id === 'maps_visibility'));
    assert.ok(ov.nextBestActions.some((a) => a.status === 'open' && a.code === 'missing_site_title'));
    assert.equal(ov.connections.search_console.platformConfigured, false);
  });

  it('audits duplicate titles and empty premium gallery', () => {
    const { auditSiteConfig } = require('../lib/search-intelligence/audit/config-audit');
    const audit = auditSiteConfig({
      seoTitle: 'Same',
      seoDescription: 'Desc',
      phone: '0400000000',
      pages: [
        { status: 'published', title: 'Same', slug: 'a', meta: 'm1' },
        { status: 'published', title: 'Same', slug: 'b', meta: 'm2' }
      ],
      sections: {
        quote: { on: true },
        premiumGallery: { on: true, images: [] }
      }
    });
    assert.ok(audit.findings.some((f) => f.code === 'duplicate_titles'));
    assert.ok(audit.findings.some((f) => f.code === 'premium_gallery_empty'));
  });

  it('reports GSC connector not_configured without env', () => {
    const oauth = require('../lib/search-intelligence/google-oauth/config');
    assert.equal(oauth.configured('search_console'), false);
    assert.equal(oauth.oauthReady('search_console'), false);
    assert.equal(oauth.connectionStatus('search_console').status, 'not_configured');
  });

  it('parses HTML head and builds crawl findings without network', () => {
    const { parseHead } = require('../lib/search-intelligence/audit/html-crawl');
    const head = parseHead(
      '<html><head><title>Plumber Canberra</title>' +
        '<meta name="description" content="Local plumber">' +
        '<link rel="canonical" href="https://example.com.au/">' +
        '</head><body><h1>Hello</h1></body></html>'
    );
    assert.equal(head.title, 'Plumber Canberra');
    assert.equal(head.description, 'Local plumber');
    assert.ok(head.canonical.indexOf('example.com.au') >= 0);
  });

  it('merges crawl findings into overview when crawl result is supplied', async () => {
    const { buildOverview } = require('../lib/search-intelligence/overview');
    const origFetch = global.fetch;
    global.fetch = async function () {
      return {
        ok: true,
        status: 200,
        url: 'https://demo.example.com.au/',
        text: async function () {
          return '<html><head></head><body></body></html>';
        }
      };
    };
    try {
      const ov = await buildOverview({
        siteId: 'site-crawl',
        config: { seoTitle: 'Expected Title', seoDescription: 'Desc', phone: '0400000000', sections: { quote: { on: true } } },
        site: { id: 'site-crawl', custom_domain: 'demo.example.com.au', status: 'live' },
        crawl: true,
        includeRecipeCatalog: false
      });
      assert.equal(ov.ok, true);
      assert.ok(ov.crawl && ov.crawl.homeUrl);
      assert.ok(ov.nextBestActions.some((a) => a.code === 'crawl_empty_title'));
      assert.ok(ov.cards.find((c) => c.id === 'technical_health').value >= 1);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('ships OAuth exchange and callback routes', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/exchange.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/callback.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/exchange.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/callback.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/google-oauth/oauth.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/google-oauth/crypto.js')));
  });

  it('ships property select, sync, and organic attribution modules', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/properties.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/save-property.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/sync.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/properties.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/save-property.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/cron/sync-search-intelligence.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/sync.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/attribution-organic.js')));
    const vercel = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert.match(vercel, /sync-search-intelligence/);
  });

  it('classifies organic props and surfaces overview cards from totals', async () => {
    const { isOrganicProps } = require('../lib/search-intelligence/attribution-organic');
    assert.equal(isOrganicProps({ traffic_source: 'organic' }), true);
    assert.equal(isOrganicProps({ gclid: 'x', traffic_source: 'organic' }), false);
    assert.equal(isOrganicProps({ utm_medium: 'organic' }), true);

    const { buildOverview } = require('../lib/search-intelligence/overview');
    const ov = await buildOverview({
      siteId: 'site-attr',
      config: { seoTitle: 'T', seoDescription: 'D', phone: '0400000000', sections: { quote: { on: true } } },
      connectionRows: {
        search_console: {
          connection_status: 'connected',
          enabled: true,
          property_id: 'https://example.com.au/',
          last_sync_at: '2026-07-01T00:00:00.000Z'
        }
      },
      gscTotals: {
        available: true,
        rows: 3,
        clicks: 42,
        impressions: 900,
        startDate: '2026-06-01',
        endDate: '2026-06-28'
      },
      organicSummary: {
        available: true,
        organicLeads: 5,
        organicCallClicks: 2,
        organicForms: 3,
        days: 28,
        labelClass: 'measured'
      },
      includeRecipeCatalog: false
    });
    assert.equal(ov.cards.find((c) => c.id === 'organic_clicks').value, 42);
    assert.equal(ov.cards.find((c) => c.id === 'search_leads').value, 5);
    assert.equal(ov.connections.search_console.propertyId, 'https://example.com.au/');
  });

  it('aggregates GSC page performance and emits low-CTR findings', () => {
    const { aggregateByPage, buildPageFindings } = require('../lib/search-intelligence/page-performance');
    const pages = aggregateByPage([
      { query: 'plumber canberra', page_url: 'https://a.example/plumber', clicks: 2, impressions: 400, ctr: 0.005, position: 8 },
      { query: 'plumber near me', page_url: 'https://a.example/plumber', clicks: 1, impressions: 200, ctr: 0.005, position: 9 },
      { query: 'plumber canberra', page_url: 'https://a.example/services', clicks: 5, impressions: 120, ctr: 0.04, position: 5 }
    ]);
    assert.ok(pages.length >= 2);
    assert.equal(pages[0].pageUrl, 'https://a.example/plumber');
    assert.equal(pages[0].impressions, 600);
    const findings = buildPageFindings(pages, { minImpressions: 100, maxCtr: 0.02 });
    assert.ok(findings.some((f) => f.code === 'high_impr_low_ctr'));
    assert.ok(findings.some((f) => f.code === 'cannibalisation'));
  });

  it('ships page performance, GA4 sync, and keywords API', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/page-performance.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/connectors/ga4-data.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/sync.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/keywords.js')));
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /_siPagesHTML/);
    assert.match(manage, /_siKeywordsHTML/);
    assert.match(manage, /\/api\/search-intelligence\/keywords/);
  });

  it('normalises keywords and enforces plan limit helper', () => {
    const tk = require('../lib/search-intelligence/tracked-keywords');
    assert.equal(tk.normalizeKeyword('  Plumber   Canberra '), 'plumber canberra');
    assert.ok(tk.planLimit() >= 1 && tk.planLimit() <= 100);
  });

  it('builds client summary shape without database', async () => {
    const { buildClientSummary } = require('../lib/search-intelligence/client-summary');
    const fakeAdmin = {
      from: function () {
        return {
          select: function () { return this; },
          eq: function () { return this; },
          in: function () { return this; },
          is: function () { return this; },
          order: function () { return this; },
          gte: function () { return this; },
          maybeSingle: async function () { return { data: null, error: null }; },
          then: undefined
        };
      }
    };
    // Override chain to resolve as empty arrays for list queries
    fakeAdmin.from = function () {
      const chain = {
        select: function () { return chain; },
        eq: function () { return chain; },
        in: function () { return chain; },
        is: function () { return chain; },
        order: function () { return chain; },
        gte: function () { return chain; },
        maybeSingle: async function () { return { data: null, error: null }; }
      };
      // Make awaitable for .select().eq()... without maybeSingle (supabase returns promise-like)
      chain.then = function (resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      };
      return chain;
    };
    const summary = await buildClientSummary(fakeAdmin, {
      id: 'site-sum',
      business_name: 'Demo Plumbing',
      slug: 'demo',
      config: { seoTitle: 'Demo', seoDescription: 'x', phone: '0400000000', sections: { quote: { on: true } } }
    }, { days: 28 });
    assert.equal(summary.ok, true);
    assert.ok(Array.isArray(summary.bullets) && summary.bullets.length >= 2);
    assert.equal(summary.businessName, 'Demo Plumbing');
  });

  it('ships tracked keywords, summary, portfolio APIs', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/tracked-keywords.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/summary.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/portfolio.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/cron/search-intelligence-summaries.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/tracked-keywords.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/client-summary.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/portfolio.js')));
    const vercel = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert.match(vercel, /search-intelligence-summaries/);
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /_siLoadSummary/);
    assert.match(manage, /_siLoadPortfolio/);
    assert.match(manage, /tracked-keywords/);
    assert.match(manage, /si-summary-email/);
    assert.match(manage, /SI_SUMMARY_EMAIL/);
    assert.match(manage, /data-si-pf/);
    assert.match(manage, /si-pf-email/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/summary-email.js')));
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/providers/semrush.js')), false);
  });

  it('cadence due windows and mock rank positions are deterministic', async () => {
    const { cadenceDueSince } = require('../lib/search-intelligence/rank-jobs');
    assert.ok(cadenceDueSince('daily'));
    assert.ok(cadenceDueSince('weekly'));
    assert.equal(cadenceDueSince('event'), null);
    const mock = require('../lib/search-intelligence/providers/mock');
    const a = await mock.rankCheck({ keyword: 'plumber canberra' });
    const b = await mock.rankCheck({ keyword: 'plumber canberra' });
    assert.equal(a.ok, true);
    assert.equal(a.observation.position, b.observation.position);
    assert.ok(a.observation.position >= 4 && a.observation.position <= 18);
  });

  it('ships rank-check API and cron', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/rank-jobs.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/rank-check.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/cron/search-intelligence-ranks.js')));
    const vercel = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert.match(vercel, /search-intelligence-ranks/);
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /Check ranks now/);
    assert.match(manage, /\/api\/search-intelligence\/rank-check/);
  });

  it('wires SEO Command Centre manage tab + APIs', () => {
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /id="nav-seo"/);
    assert.match(manage, /id="av-seo"/);
    assert.match(manage, /function renderSeoCommandCentre/);
    assert.match(manage, /\/api\/search-intelligence\/overview/);
    assert.match(manage, /crawl=1/);
    assert.match(manage, /'trade':\[[^\]]*seo/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/overview.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/recommendations.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/search-console/connect.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-analytics/status.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'settings/integrations/search-console.html')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'settings/integrations/google-analytics.html')));
  });

  it('maps-grid mock samples and detects pack absence', async () => {
    const { sampleMapsGrid, buildGridPoints, centreForSite } = require('../lib/search-intelligence/maps-grid');
    const pts = buildGridPoints({ lat: -35.28, lng: 149.13 }, 3, 0.04);
    assert.equal(pts.length, 9);
    const centre = centreForSite({ config: { region: 'Canberra' } });
    assert.ok(centre.lat < 0);
    const sample = await sampleMapsGrid(
      {
        id: 'site-maps',
        business_name: 'Other Biz',
        slug: 'other-biz',
        custom_domain: 'other-biz.example',
        config: { region: 'Canberra', trade: 'plumber' }
      },
      { provider: 'mock', gridSize: 3, keyword: 'plumber canberra' }
    );
    assert.equal(sample.ok, true);
    assert.equal(sample.pointCount, 9);
    assert.ok(Array.isArray(sample.cells) && sample.cells.length === 9);
    assert.equal(sample.provider, 'mock');
  });

  it('evidence gates block doorway suburb pages and allow clean gaps', () => {
    const {
      evaluateSuburbPageGate,
      buildGatedSuburbBrief,
      detectLocalPageIssues
    } = require('../lib/search-intelligence/local-page-gates');
    const site = {
      id: 'site-local',
      business_name: 'Demo Plumbing',
      config: {
        phone: '0400111222',
        region: 'Canberra',
        sections: {
          serviceAreas: { on: true, areas: ['Belconnen', 'Gungahlin'] },
          faq: { items: [{ q: 'How fast?', a: 'Same day' }] }
        },
        pages: [
          {
            status: 'published',
            slug: 'plumber-belconnen',
            title: 'Plumber Belconnen',
            seoTitle: 'Pl',
            seoDescription: 'x',
            body: 'short'
          }
        ]
      }
    };
    const blocked = evaluateSuburbPageGate(site, {
      area: 'Sydney',
      primaryKeyword: 'plumber sydney'
    });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.reasons.indexOf('suburb_not_in_service_areas') >= 0);

    const dup = evaluateSuburbPageGate(site, {
      area: 'Belconnen',
      primaryKeyword: 'plumber belconnen'
    });
    assert.equal(dup.allowed, false);
    assert.ok(dup.reasons.indexOf('duplicate_local_intent') >= 0);

    const ok = evaluateSuburbPageGate(site, {
      area: 'Gungahlin',
      primaryKeyword: 'hot water gungahlin'
    });
    assert.equal(ok.allowed, true);
    const brief = buildGatedSuburbBrief(site, {
      area: 'Gungahlin',
      primaryKeyword: 'hot water gungahlin'
    });
    assert.equal(brief.ok, true);
    assert.equal(brief.safeguards.publishAllowed, false);
    assert.equal(brief.pageKind, 'suburb');

    const issues = detectLocalPageIssues(site);
    assert.ok(issues.findings.some((f) => f.recipeId === 'service_area_page_thin'));
    assert.ok(issues.findings.some((f) => f.recipeId === 'schema_missing_local'));
  });

  it('ships GBP OAuth scaffold, maps-grid and local-pages APIs', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-business/connect.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-business/status.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-business/callback.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/integrations/google-business/exchange.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'settings/integrations/google-business.html')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/maps-grid.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/local-pages.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/maps-grid.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/local-page-gates.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/phase4-foundations.js')));
    const oauth = require('../lib/search-intelligence/google-oauth/config');
    assert.ok(oauth.getProvider('gbp'));
    assert.equal(oauth.connectionStatus('gbp').status, 'not_configured');
    const vercel = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert.match(vercel, /google-business/);
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /Sample Maps grid/);
    assert.match(manage, /si-suburb-brief/);
    assert.match(manage, /\/api\/search-intelligence\/maps-grid/);
    assert.match(manage, /\/api\/search-intelligence\/local-pages/);
  });

  it('gateway mapsGrid and backlinkSummary mock ops work', async () => {
    const gw = createGateway({ provider: 'mock' });
    assert.ok(gw.ops.indexOf('mapsGrid') >= 0);
    assert.ok(gw.ops.indexOf('backlinkSummary') >= 0);
    const maps = await gw.mapsGrid({ keyword: 'plumber', lat: -35.28, lng: 149.13 });
    assert.equal(maps.ok, true);
    assert.ok(maps.snapshot.results.length >= 1);
    const bl = await gw.backlinkSummary({ domain: 'example-plumber.com.au' });
    assert.equal(bl.ok, true);
    assert.equal(bl.summary.referringDomains, 42);
  });

  it('ads keyword universe detects mismatch and overview exposes phase 5', async () => {
    const { buildAdsKeywordUniverse } = require('../lib/search-intelligence/phase4-foundations');
    const uni = buildAdsKeywordUniverse(
      [{ keyword: 'plumber canberra' }, { keyword: 'hot water canberra' }, { keyword: 'blocked drain canberra' }],
      [{ keyword: 'ppc only one' }, { keyword: 'ppc only two' }]
    );
    assert.ok(uni.findings.some((f) => f.recipeId === 'seo_ads_mismatch'));
    const { buildOverview } = require('../lib/search-intelligence/overview');
    const ov = await buildOverview({
      siteId: 'site-p3',
      config: {
        seoTitle: 'Demo Plumbing Canberra',
        seoDescription: 'Local plumbers',
        phone: '0400111222',
        region: 'Canberra',
        sections: { quote: { on: true }, serviceAreas: { on: true, areas: ['Belconnen'] } }
      },
      includeRecipeCatalog: false
    });
    assert.equal(ov.phase, 5);
    assert.equal(ov.scaffold, false);
    assert.ok(ov.cards.find((c) => c.id === 'ai_visibility'));
    assert.ok(ov.safeAutoFix && ov.safeAutoFix.confirmRequired);
    assert.ok(ov.connections.gbp);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/providers/semrush.js')), false);
  });

  it('loads ads keyword hints and detects universe mismatch', () => {
    const { buildAdsKeywordUniverse } = require('../lib/search-intelligence/phase4-foundations');
    const uni = buildAdsKeywordUniverse(
      [{ keyword: 'a one' }, { keyword: 'a two' }, { keyword: 'a three' }],
      [{ keyword: 'paid x' }, { keyword: 'paid y' }]
    );
    assert.ok(uni.findings.some((f) => f.recipeId === 'seo_ads_mismatch'));
  });

  it('backlink gap flags stronger competitors', async () => {
    const { analyseBacklinkGap } = require('../lib/search-intelligence/backlink-gap');
    const res = await analyseBacklinkGap(
      {
        id: 'site-bl',
        slug: 'demo-plumber',
        custom_domain: 'example-plumber.com.au',
        config: { competitors: ['rival.example'] }
      },
      { provider: 'mock' }
    );
    assert.equal(res.ok, true);
    assert.equal(res.domain, 'example-plumber.com.au');
    assert.ok(Array.isArray(res.competitors));
  });

  it('ships Authority API and Manage tab', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/authority.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/ads-keywords.js')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/backlink-gap.js')));
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db/google_ads_schema.sql'), 'utf8');
    assert.match(sql, /ads_keyword_daily/);
    const sync = fs.readFileSync(path.join(__dirname, '..', 'lib/google-ads/sync.js'), 'utf8');
    assert.match(sync, /keyword_view/);
    assert.match(sync, /syncKeywordMetrics/);
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /\['authority','Authority'\]/);
    assert.match(manage, /_siLoadAuthority/);
    assert.match(manage, /\/api\/search-intelligence\/authority/);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/providers/semrush.js')), false);
  });

  it('safe auto-fix requires confirm and only allow-lists fixes', async () => {
    const { listSafeFixes, runSafeFix, suggestSafeFixes } = require('../lib/search-intelligence/auto-fix');
    assert.ok(listSafeFixes().some((f) => f.id === 'refresh_sitemap'));
    assert.ok(listSafeFixes().some((f) => f.id === 'apply_schema_local'));
    const denied = await runSafeFix({}, { id: 'x', config: {} }, 'refresh_sitemap', { confirm: false });
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'confirm_required');
    const bad = await runSafeFix({}, { id: 'x', config: {} }, 'publish_ai_page', { confirm: true });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'fix_not_allowlisted');
    const fixes = suggestSafeFixes({ recipeId: 'schema_missing_local' });
    assert.ok(fixes.some((f) => f.id === 'apply_schema_local'));
  });

  it('detects keyword_no_page and models visibility score', () => {
    const {
      detectKeywordNoPage,
      computeSearchVisibilityScore
    } = require('../lib/search-intelligence/keyword-coverage');
    const cov = detectKeywordNoPage(
      {
        id: 's1',
        config: {
          seoTitle: 'Home',
          seoDescription: 'Plumbing',
          pages: [{ status: 'published', title: 'About', slug: 'about', seoTitle: 'About us' }]
        }
      },
      [{ keyword: 'emergency blocked drain gungahlin', trackedId: 't1' }]
    );
    assert.ok(cov.findings.some((f) => f.recipeId === 'keyword_no_page'));
    const vis = computeSearchVisibilityScore({
      gscTotals: { available: true, clicks: 40, impressions: 800 },
      ranks: { items: [{ position: 3 }, { position: 12 }] }
    });
    assert.ok(vis.score != null && vis.score >= 5 && vis.score <= 95);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'api/search-intelligence/auto-fix.js')));
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /auto_fix_safe/);
    assert.match(manage, /\/api\/search-intelligence\/auto-fix/);
  });
});
