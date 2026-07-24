'use strict';

/**
 * Multi-platform AI citation model for Search Intelligence.
 * Live: Google AI Overviews (+ ChatGPT SERP blocks aliased).
 * Licensed answer probes: ChatGPT (OpenAI) + Perplexity when API keys are set.
 */

const {
  openaiConfigured,
  perplexityConfigured
} = require('./ai-answer-probes');

function baseCatalogue() {
  return [
    {
      id: 'google_ai_overview',
      label: 'Google AI Overviews',
      source: 'serp_feature',
      status: 'live'
    },
    {
      id: 'google_serp_chatgpt_block',
      label: 'ChatGPT block in Google SERP',
      source: 'serp_feature_alias',
      status: 'live_aliased'
    },
    {
      id: 'chatgpt_answers',
      label: 'ChatGPT answers',
      source: 'openai_api',
      status: openaiConfigured() ? 'live' : 'unavailable',
      note: openaiConfigured()
        ? 'Uses OPENAI_API_KEY (or OPEN_AI_KEY) for answer probes.'
        : 'Set OPENAI_API_KEY or OPEN_AI_KEY to enable ChatGPT answer probes.'
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      source: 'perplexity_api',
      status: perplexityConfigured() ? 'live' : 'unavailable',
      note: perplexityConfigured()
        ? 'Uses PERPLEXITY_API_KEY for answer probes.'
        : 'Set PERPLEXITY_API_KEY to enable Perplexity answer probes.'
    }
  ];
}

/** Static snapshot for imports that expect a frozen list (tests may stub env). */
const PLATFORM_CATALOGUE = Object.freeze(baseCatalogue());

function platformCatalogue() {
  return baseCatalogue();
}

function hostNorm(h) {
  return String(h || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function siteHosts(site) {
  const hosts = [];
  if (site && site.custom_domain) hosts.push(hostNorm(site.custom_domain));
  if (site && site.slug) hosts.push(String(site.slug).toLowerCase() + '.leadpages.com.au');
  const cfg = (site && site.config) || {};
  if (cfg.domain) hosts.push(hostNorm(cfg.domain));
  return Array.from(new Set(hosts.filter(Boolean)));
}

function domainOwned(domain, hosts) {
  const d = hostNorm(domain);
  if (!d) return false;
  return hosts.some(function (h) {
    return h && (d === h || d.indexOf(h) >= 0 || h.indexOf(d) >= 0);
  });
}

/**
 * Analyse AI overview citation ownership from a SERP snapshot.
 */
function analyseAiCitations(site, snapshot, opts) {
  const o = opts || {};
  const hosts = siteHosts(site);
  const features = (snapshot && snapshot.features) || [];
  const results = (snapshot && snapshot.results) || [];
  const hasAi = features.indexOf('ai_overview') >= 0 || features.indexOf('chatgpt') >= 0;

  const citations = results.filter(function (r) {
    return r.type === 'ai_overview' || r.type === 'chatgpt';
  });
  const organic = results.filter(function (r) {
    return r.type === 'organic';
  });

  const citedOwned = citations.filter(function (c) {
    return domainOwned(c.domain || c.url, hosts);
  });
  const citedCompetitors = citations.filter(function (c) {
    return !domainOwned(c.domain || c.url, hosts);
  });
  const organicOwned = organic.some(function (r) {
    return domainOwned(r.domain || r.url, hosts);
  });

  let state = 'no_ai_overview';
  let score = 0.45;
  if (hasAi) {
    if (citations.length && citedOwned.length) {
      state = 'cited';
      score = 0.85;
    } else if (citations.length && !citedOwned.length) {
      state = 'ai_overview_competitor_risk';
      score = 0.3;
    } else if (organicOwned) {
      state = 'ai_overview_present_organic_owned';
      score = 0.65;
    } else {
      state = 'ai_overview_competitor_risk';
      score = 0.35;
    }
  }

  const answerProbes = o.answerProbes || {};
  const platforms = platformCatalogue().map(function (p) {
    if (p.id === 'google_ai_overview') {
      return Object.assign({}, p, {
        probed: true,
        present: hasAi,
        cited: citedOwned.length > 0,
        citationCount: citations.length
      });
    }
    if (p.id === 'google_serp_chatgpt_block') {
      return Object.assign({}, p, {
        probed: true,
        present: features.indexOf('chatgpt') >= 0 || hasAi
      });
    }
    if (p.id === 'chatgpt_answers') {
      const probe = answerProbes.chatgpt || null;
      return Object.assign({}, p, {
        probed: !!(probe && probe.available),
        present: !!(probe && (probe.cited || probe.brandMentioned)),
        cited: !!(probe && probe.cited),
        brandMentioned: !!(probe && probe.brandMentioned),
        status: probe && probe.status ? probe.status : p.status,
        note: (probe && (probe.note || probe.message)) || p.note
      });
    }
    if (p.id === 'perplexity') {
      const probe = answerProbes.perplexity || null;
      return Object.assign({}, p, {
        probed: !!(probe && probe.available),
        present: !!(probe && (probe.cited || probe.brandMentioned)),
        cited: !!(probe && probe.cited),
        brandMentioned: !!(probe && probe.brandMentioned),
        status: probe && probe.status ? probe.status : p.status,
        note: (probe && (probe.note || probe.message)) || p.note
      });
    }
    return Object.assign({}, p, { probed: false });
  });

  return {
    hasAiOverview: hasAi,
    state: state,
    score: score,
    citations: citations.slice(0, 20).map(function (c) {
      return {
        rank: c.rank,
        title: c.title,
        domain: c.domain,
        url: c.url,
        owned: domainOwned(c.domain || c.url, hosts)
      };
    }),
    citedOwnedCount: citedOwned.length,
    citedCompetitorCount: citedCompetitors.length,
    organicOwned: organicOwned,
    platforms: platforms,
    keyword: o.keyword || (snapshot && snapshot.keyword) || null,
    labelClass: (snapshot && snapshot.labelClass) || 'estimated',
    answerProbes: answerProbes
  };
}

module.exports = {
  PLATFORM_CATALOGUE: PLATFORM_CATALOGUE,
  platformCatalogue: platformCatalogue,
  siteHosts: siteHosts,
  domainOwned: domainOwned,
  analyseAiCitations: analyseAiCitations
};
