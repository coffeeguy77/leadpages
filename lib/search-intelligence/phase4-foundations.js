'use strict';

/**
 * Light Phase 4 foundations — Ads↔SEO keyword universe + AI visibility placeholder.
 * Market data remains DataForSEO-only (no Semrush).
 */

const { getRecipe } = require('./recipes/registry');
const { createGateway } = require('./providers/gateway');
const { analyseAiCitations, PLATFORM_CATALOGUE } = require('./ai-citations');

function normKw(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare tracked organic keywords with Ads campaign keywords (when provided).
 * @param {Array<{ keyword: string }>} tracked
 * @param {Array<{ keyword: string, campaign?: string }>} adsKeywords
 */
function buildAdsKeywordUniverse(tracked, adsKeywords) {
  const organic = (tracked || [])
    .map(function (t) {
      return normKw(t.keyword || t.normalised);
    })
    .filter(Boolean);
  const ads = (adsKeywords || [])
    .map(function (a) {
      return {
        keyword: normKw(a.keyword),
        campaign: a.campaign || null
      };
    })
    .filter(function (a) {
      return a.keyword;
    });

  const organicSet = new Set(organic);
  const adsSet = new Set(
    ads.map(function (a) {
      return a.keyword;
    })
  );

  const shared = organic.filter(function (k) {
    return adsSet.has(k);
  });
  const organicOnly = organic.filter(function (k) {
    return !adsSet.has(k);
  });
  const adsOnly = ads
    .map(function (a) {
      return a.keyword;
    })
    .filter(function (k) {
      return !organicSet.has(k);
    });

  const findings = [];
  if (ads.length && organicOnly.length >= 3 && shared.length === 0) {
    const recipe = getRecipe('seo_ads_mismatch');
    findings.push({
      id: 'ads:seo_mismatch',
      code: 'seo_ads_mismatch',
      recipeId: 'seo_ads_mismatch',
      title: (recipe && recipe.title) || 'Organic and Ads mismatch',
      plainLanguage:
        'Tracked organic keywords and Ads keywords do not overlap. Align landing pages and query coverage.',
      severity: (recipe && recipe.severityDefault) || 'low',
      status: 'open',
      actions: (recipe && recipe.actions) || ['create_task'],
      autoFixAllowed: false,
      evidence: {
        source: 'ads_keyword_universe',
        organicCount: organic.length,
        adsCount: ads.length,
        sharedCount: 0,
        organicOnlySample: organicOnly.slice(0, 5)
      },
      labelClass: 'modelled'
    });
  }

  return {
    ok: true,
    organicCount: organic.length,
    adsCount: ads.length,
    sharedCount: shared.length,
    shared: shared.slice(0, 40),
    organicOnly: organicOnly.slice(0, 40),
    adsOnly: adsOnly.slice(0, 40),
    findings: findings,
    available: ads.length > 0 || organic.length > 0,
    labelClass: 'modelled',
    note:
      ads.length === 0
        ? 'Pass Ads keywords from the Advertising connection for a full SEO↔PPC matrix (Phase 4).'
        : null
  };
}

/**
 * AI visibility — Google AI Overview citation ownership (+ platform catalogue).
 */
async function probeAiVisibility(site, opts) {
  const o = opts || {};
  const name = String(
    (site && site.business_name) || (site && site.config && site.config.name) || ''
  ).trim();
  if (!name) {
    return {
      ok: true,
      available: false,
      score: null,
      state: 'needs_business_name',
      platforms: PLATFORM_CATALOGUE,
      labelClass: 'modelled',
      findings: [],
      note: 'AI visibility probes need a business name.'
    };
  }

  const gw = createGateway({ provider: o.provider || undefined });
  const keyword = o.keyword || name;
  const res = await gw.serp({
    keyword: keyword,
    location: o.location || (site.config && site.config.region) || 'Australia',
    device: 'mobile',
    forceAi: o.forceAi
  });

  if (!res || !res.ok) {
    return {
      ok: true,
      available: false,
      score: null,
      state: 'provider_unavailable',
      provider: res && res.provider,
      platforms: PLATFORM_CATALOGUE,
      labelClass: 'modelled',
      findings: [],
      note: (res && res.message) || 'SERP probe unavailable — AI visibility stays placeholder.'
    };
  }

  const analysis = analyseAiCitations(site, res.snapshot, { keyword: keyword });
  const findings = [];
  if (analysis.hasAiOverview && analysis.citedOwnedCount === 0) {
    const recipe = getRecipe('ai_overview_absent');
    findings.push({
      id: 'ai:overview_absent',
      code: 'ai_overview_absent',
      recipeId: 'ai_overview_absent',
      title: (recipe && recipe.title) || 'Absent from AI overview citations',
      plainLanguage:
        analysis.citations.length > 0
          ? 'AI Overview cites ' +
            analysis.citedCompetitorCount +
            ' other source(s) for “' +
            keyword +
            '” — none are your domain. Add proof-rich pages and entity clarity.'
          : (recipe && recipe.plainLanguage) ||
            'AI answers may cite competitors for questions you can answer with proof.',
      severity: 'low',
      status: 'open',
      actions: (recipe && recipe.actions) || ['create_task', 'page_optimiser'],
      autoFixAllowed: false,
      evidence: {
        source: 'serp_ai_overview',
        keyword: keyword,
        features: (res.snapshot && res.snapshot.features) || [],
        citations: analysis.citations.slice(0, 8),
        platforms: analysis.platforms
      },
      labelClass: analysis.labelClass
    });
  }

  return {
    ok: true,
    available: true,
    score: analysis.score,
    state: analysis.state,
    keyword: keyword,
    features: (res.snapshot && res.snapshot.features) || [],
    citations: analysis.citations,
    citedOwnedCount: analysis.citedOwnedCount,
    citedCompetitorCount: analysis.citedCompetitorCount,
    platforms: analysis.platforms,
    findings: findings,
    provider: res.provider,
    labelClass: analysis.labelClass,
    note:
      'Google AI Overviews citation ownership via DataForSEO SERP. ChatGPT Answers / Perplexity stay unavailable until a licensed endpoint is configured — never Semrush.'
  };
}

/**
 * Brand SERP ownership probe (recipe brand_serp_unowned).
 */
async function probeBrandSerp(site, opts) {
  const o = opts || {};
  const name = String(
    (site && site.business_name) || (site && site.config && site.config.name) || ''
  ).trim();
  if (!name) {
    return { ok: true, available: false, findings: [], note: 'Business name required.' };
  }
  const gw = createGateway({ provider: o.provider || undefined });
  const res = await gw.serp({
    keyword: name,
    location: o.location || (site.config && site.config.region) || 'Australia'
  });
  if (!res || !res.ok) {
    return { ok: true, available: false, findings: [], provider: res && res.provider };
  }
  const organic = ((res.snapshot && res.snapshot.results) || []).filter(function (r) {
    return r.type === 'organic';
  });
  const hosts = [];
  if (site.custom_domain) hosts.push(String(site.custom_domain).replace(/^www\./, '').toLowerCase());
  if (site.slug) hosts.push(String(site.slug).toLowerCase() + '.leadpages.com.au');
  const top = organic[0];
  const owned =
    top &&
    hosts.some(function (h) {
      const d = String(top.domain || '').replace(/^www\./, '').toLowerCase();
      return h && (d === h || d.indexOf(h) >= 0);
    });
  const findings = [];
  if (top && !owned) {
    const recipe = getRecipe('brand_serp_unowned');
    findings.push({
      id: 'brand:serp_unowned',
      code: 'brand_serp_unowned',
      recipeId: 'brand_serp_unowned',
      title: (recipe && recipe.title) || 'Brand SERP not fully owned',
      plainLanguage:
        '“' +
        name +
        '” search shows ' +
        (top.domain || 'another site') +
        ' first. Claim your brand SERP with a strong homepage and listings.',
      severity: (recipe && recipe.severityDefault) || 'low',
      status: 'open',
      actions: (recipe && recipe.actions) || ['create_task', 'create_landing_draft'],
      autoFixAllowed: false,
      evidence: {
        source: 'brand_serp',
        keyword: name,
        topDomain: top.domain,
        topUrl: top.url
      },
      labelClass: (res.snapshot && res.snapshot.labelClass) || 'estimated'
    });
  }
  return {
    ok: true,
    available: true,
    owned: !!owned,
    topDomain: top && top.domain,
    findings: findings,
    provider: res.provider,
    labelClass: (res.snapshot && res.snapshot.labelClass) || 'estimated'
  };
}

module.exports = {
  buildAdsKeywordUniverse: buildAdsKeywordUniverse,
  probeAiVisibility: probeAiVisibility,
  probeBrandSerp: probeBrandSerp,
  PLATFORM_CATALOGUE: PLATFORM_CATALOGUE
};
