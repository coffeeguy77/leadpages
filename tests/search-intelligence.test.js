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

  it('semrush adapter stays not_configured until live wiring', async () => {
    const gw = createGateway({ provider: 'semrush' });
    assert.ok(gw.adapters.includes('semrush'));
    const res = await gw.keywordIdeas({ keyword: 'plumber' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'not_configured');
    assert.equal(res.provider, 'semrush');
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
    assert.equal(ov.cards.find((c) => c.id === 'technical_health').value, ov.audit.issueCount);
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
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/providers/semrush.js')));
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
});
