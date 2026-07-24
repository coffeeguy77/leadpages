'use strict';

/**
 * Campaign planner — generates editable Search campaign drafts from site/page config.
 * Never creates live Ads resources; never fabricates volume/CPC.
 */

const { normalizeRsaCopy } = require('../brain/ads-compose');
const { hostNorm, assertSingleFinalUrlDomain } = require('./safety');

function clip(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n);
}

function publishedPages(site) {
  const cfg = (site && site.config) || {};
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  return pages.filter((p) => p && (p.status === 'published' || p.published === true || !p.status));
}

function servicesFromConfig(site) {
  const cfg = (site && site.config) || {};
  const sections = cfg.sections || {};
  const svc = sections.services && Array.isArray(sections.services.items) ? sections.services.items : [];
  return svc
    .filter((s) => s && s.on !== false)
    .map((s) => ({
      title: clip(s.title || s.name, 80),
      body: clip(s.body || s.blurb || '', 200)
    }))
    .filter((s) => s.title);
}

function geoFromConfig(site) {
  const cfg = (site && site.config) || {};
  const tokens = cfg.seoTokens || cfg.localSeo || {};
  const area =
    clip(cfg.serviceArea || cfg.city || tokens.suburb || tokens.city || cfg.region, 80) ||
    'Local service area';
  return area;
}

function primaryDomainOf(site) {
  return hostNorm(site && (site.custom_domain || (site.config && site.config.domain)));
}

function pageUrl(site, page) {
  const domain = primaryDomainOf(site);
  const slug = clip(page && page.slug, 120);
  if (!domain) return slug ? '/' + slug : '/';
  if (!slug || slug === 'home' || slug === 'index') return 'https://' + domain + '/';
  return 'https://' + domain + '/' + slug.replace(/^\//, '');
}

function keywordIdeas(service, geo, brand) {
  const s = clip(service, 60).toLowerCase();
  const g = clip(geo, 40).toLowerCase();
  const b = clip(brand, 40);
  const out = [];
  function add(kw, intent, matchType, why) {
    out.push({
      keyword: kw,
      intent: intent,
      matchType: matchType,
      approved: matchType !== 'BROAD',
      why: why
    });
  }
  if (s) {
    add(s + ' ' + g, 'commercial', 'PHRASE', 'Service + location from site config');
    add(s + ' near me', 'commercial', 'PHRASE', 'Near-me commercial intent');
    add('best ' + s + ' ' + g, 'research', 'PHRASE', 'Research intent — review before enabling');
    add(s, 'commercial', 'EXACT', 'Core exact service term');
  }
  if (b) add(b.toLowerCase(), 'brand', 'EXACT', 'Brand term from business name');
  return out;
}

function starterNegatives(service) {
  const s = clip(service, 40).toLowerCase();
  const cats = [
    { category: 'jobs', terms: ['job', 'jobs', 'career', 'salary', 'hiring'], note: 'Employment seekers' },
    { category: 'diy', terms: ['diy', 'how to', 'tutorial', 'course'], note: 'Info / DIY' },
    { category: 'free', terms: ['free', 'cheap'], note: 'Price shoppers — review carefully' }
  ];
  if (/hire|rental|cart/.test(s)) {
    cats.push({ category: 'unrelated', terms: ['truck hire', 'car hire'], note: 'Unrelated hire verticals' });
  }
  return cats;
}

function buildRsa(site, service, geo, finalUrl) {
  const brand = clip((site && site.business_name) || 'Local business', 30);
  const svc = clip(service, 30);
  const g = clip(geo, 20);
  const raw = {
    headlines: [
      (svc + ' ' + g).slice(0, 30),
      (brand + ' | ' + svc).slice(0, 30),
      ('Book ' + svc).slice(0, 30),
      (svc + ' Near You').slice(0, 30),
      ('Trusted ' + svc).slice(0, 30),
      (g + ' ' + svc).slice(0, 30),
      'Get a Fast Quote',
      'Call Today'
    ],
    descriptions: [
      ('Need ' + svc + ' in ' + g + '? ' + brand + ' makes booking simple. Request a quote today.').slice(0, 90),
      ('Local ' + svc + ' with clear pricing and reliable service. Talk to ' + brand + '.').slice(0, 90)
    ],
    path1: 'quote',
    path2: clip(g.replace(/\s+/g, ''), 15) || 'local',
    finalUrlHint: finalUrl
  };
  const rsa = normalizeRsaCopy(raw);
  return Object.assign({}, rsa, {
    finalUrl: finalUrl,
    provenance: { source: 'site_config', edited: false }
  });
}

/**
 * Mode A — one landing page.
 */
function planForPage(site, page, opts) {
  const o = opts || {};
  const brand = clip(site && site.business_name, 80);
  const geo = o.geo || geoFromConfig(site);
  const service =
    o.service ||
    clip(page && (page.title || page.h1 || page.primaryKeyword), 80) ||
    'Local services';
  const finalUrl = o.finalUrl || pageUrl(site, page);
  const domainCheck = assertSingleFinalUrlDomain([finalUrl]);
  const domain = domainCheck.ok ? domainCheck.domain : primaryDomainOf(site);
  const kws = keywordIdeas(service, geo, brand);
  const rsa = buildRsa(site, service, geo, finalUrl);
  return {
    mode: 'page',
    campaignName: clip(
      o.campaignName || brand + ' | Search | ' + service + ' | ' + geo,
      90
    ),
    campaignType: 'SEARCH',
    statusOnCreate: 'PAUSED',
    primaryDomain: domain,
    geoFocus: geo,
    language: 'en',
    biddingStrategy: 'MAXIMIZE_CLICKS',
    budgetDaily: o.budgetDaily != null ? Number(o.budgetDaily) : null,
    budgetNote: o.budgetDaily != null ? null : 'Enter a daily budget before create — no invented figure.',
    conversionGoals: {
      primary: ['form_submit', 'qualified_call'],
      secondary: ['phone_click', 'form_start', 'quote_start']
    },
    adGroups: [
      {
        name: clip(service + ' — ' + geo, 60),
        theme: service,
        finalUrl: finalUrl,
        finalUrlDomain: domain,
        keywords: kws,
        ads: [rsa],
        assets: {
          sitelinks: [],
          callouts: ['Local team', 'Fast quotes', 'Reliable service'],
          structuredSnippets: { header: 'Services', values: [service] }
        }
      }
    ],
    negatives: starterNegatives(service),
    networkSettings: { googleSearch: true, searchPartners: false, display: false },
    locationTargeting: { presence: true, areas: [geo] },
    provenance: {
      pageId: page && (page.id || page.slug),
      sources: ['site_config', 'page_content']
    },
    warnings: domainCheck.ok ? [] : [domainCheck.message || domainCheck.error],
    metricsNote: 'Search volume / CPC not shown — connect Keyword Planner data when available; never invented.'
  };
}

/**
 * Mode B — whole site scan (recommendations, not auto-spend).
 */
function planForSite(site, opts) {
  const pages = publishedPages(site);
  const services = servicesFromConfig(site);
  const geo = geoFromConfig(site);
  const brand = clip(site && site.business_name, 80);
  const domain = primaryDomainOf(site);
  const suggestions = [];
  const used = new Set();
  services.slice(0, 8).forEach((svc) => {
    const match =
      pages.find((p) => {
        const hay = ((p.title || '') + ' ' + (p.slug || '') + ' ' + (p.h1 || '')).toLowerCase();
        return hay.indexOf(String(svc.title).toLowerCase().split(' ')[0]) >= 0;
      }) || null;
    const key = svc.title.toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    suggestions.push({
      service: svc.title,
      landingPage: match
        ? { id: match.id, slug: match.slug, title: match.title, url: pageUrl(site, match) }
        : null,
      missingLandingPage: !match,
      recommendOwnCampaign: true,
      reason: match
        ? 'Dedicated service with a matching published page.'
        : 'Service exists in config but no clear published landing page — create one before advertising.'
    });
  });
  if (!suggestions.length && pages[0]) {
    suggestions.push({
      service: pages[0].title || 'Homepage',
      landingPage: {
        id: pages[0].id,
        slug: pages[0].slug,
        title: pages[0].title,
        url: pageUrl(site, pages[0])
      },
      missingLandingPage: false,
      recommendOwnCampaign: true,
      reason: 'No services list found — start from the strongest published page.'
    });
  }
  const first = suggestions.find((s) => s.landingPage) || suggestions[0];
  const seedPage = first && first.landingPage
    ? pages.find((p) => p.id === first.landingPage.id || p.slug === first.landingPage.slug)
    : pages[0];
  const base = planForPage(site, seedPage || { title: brand, slug: '' }, {
    service: first && first.service,
    geo: geo,
    campaignName: brand + ' | Search | Site launch | ' + geo
  });
  return Object.assign({}, base, {
    mode: 'site',
    siteScan: {
      publishedPageCount: pages.length,
      serviceCount: services.length,
      primaryDomain: domain,
      suggestions: suggestions
    },
    warnings: (base.warnings || []).concat(
      suggestions.filter((s) => s.missingLandingPage).map((s) => 'Missing landing page for: ' + s.service)
    )
  });
}

/**
 * Mode C — AI-style recommendation wrapper (deterministic from config; editable).
 */
function recommendLaunch(site, opts) {
  const sitePlan = planForSite(site, opts);
  const best =
    (sitePlan.siteScan &&
      sitePlan.siteScan.suggestions &&
      sitePlan.siteScan.suggestions.find((s) => s.landingPage && !s.missingLandingPage)) ||
    (sitePlan.siteScan && sitePlan.siteScan.suggestions && sitePlan.siteScan.suggestions[0]) ||
    null;
  return {
    mode: 'ai',
    recommendation: {
      bestInitialService: best ? best.service : null,
      searchIntent: 'Commercial — hire / book local service',
      recommendedLandingPage: best ? best.landingPage : null,
      estimatedBudgetRange: null,
      budgetRangeNote: 'Ask the account owner for a daily budget; LeadPages does not invent spend.',
      limitations: [
        'Requires Google Ads account with mutation permission.',
        'Tracking readiness must pass before publish.',
        'Campaign is always created PAUSED.'
      ],
      reasons: best ? [best.reason] : ['Insufficient site structure — add services and a published page.']
    },
    draftPlan: sitePlan
  };
}

/** Coffee Events pilot defaults (values not invented beyond naming). */
function coffeeEventsPilotDefaults(site, page, userBudgetDaily) {
  const plan = planForPage(site, page, {
    service: 'Coffee Cart Hire',
    geo: 'Canberra',
    campaignName: 'Coffee Events | Search | Coffee Cart Hire | Canberra',
    budgetDaily: userBudgetDaily != null ? Number(userBudgetDaily) : null,
    finalUrl: page ? pageUrl(site, page) : null
  });
  return Object.assign({}, plan, {
    pilot: {
      siteHint: 'coffeeevents.com.au',
      protectExternalDomains: ['beanculture.com.au'],
      requireLandingPageSelection: true,
      primaryConversions: ['form_submit', 'qualified_call'],
      secondaryEvents: ['phone_click', 'form_start', 'quote_start']
    }
  });
}

module.exports = {
  publishedPages,
  servicesFromConfig,
  geoFromConfig,
  primaryDomainOf,
  pageUrl,
  planForPage,
  planForSite,
  recommendLaunch,
  coffeeEventsPilotDefaults,
  keywordIdeas,
  starterNegatives,
  buildRsa
};
