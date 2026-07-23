'use strict';

/**
 * Competitor backlink / authority gap (Phase 4) — DataForSEO only.
 */

const { createGateway } = require('./providers/gateway');
const { getRecipe } = require('./recipes/registry');
const { meterUsage } = require('./usage');

function hostFromSite(site) {
  if (site && site.custom_domain) {
    return String(site.custom_domain)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
  if (site && site.slug) return String(site.slug).toLowerCase() + '.leadpages.com.au';
  const cfg = (site && site.config) || {};
  if (cfg.domain) {
    return String(cfg.domain)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
  return null;
}

function competitorDomainsFromSite(site, extra) {
  const out = [];
  const cfg = (site && site.config) || {};
  const list =
    (Array.isArray(cfg.competitors) && cfg.competitors) ||
    (cfg.seo && Array.isArray(cfg.seo.competitors) && cfg.seo.competitors) ||
    [];
  list.forEach(function (c) {
    const d = typeof c === 'string' ? c : (c && (c.domain || c.host || c.url)) || '';
    const host = String(d)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
    if (host) out.push(host);
  });
  (extra || []).forEach(function (d) {
    const host = String(d || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
    if (host) out.push(host);
  });
  return Array.from(new Set(out)).slice(0, 8);
}

/**
 * Compare site referring domains vs competitors.
 */
async function analyseBacklinkGap(site, opts) {
  const o = opts || {};
  const gw = createGateway({ provider: o.provider || undefined });
  const own = o.domain || hostFromSite(site);
  const competitors = competitorDomainsFromSite(site, o.competitors);
  if (!own) {
    return {
      ok: false,
      error: 'domain_required',
      message: 'Site needs a custom domain or slug for backlink comparison.'
    };
  }

  const ownRes = await gw.backlinkSummary({ domain: own });
  const competitorRows = [];
  for (let i = 0; i < competitors.length; i++) {
    const d = competitors[i];
    const res = await gw.backlinkSummary({ domain: d });
    competitorRows.push({
      domain: d,
      ok: !!(res && res.ok),
      referringDomains: res && res.summary ? res.summary.referringDomains : null,
      backlinks: res && res.summary ? res.summary.backlinks : null,
      provider: res && res.provider,
      error: res && !res.ok ? res.error || res.message : null
    });
  }

  // If no configured competitors, use domainOverview mock-style empty + optional SERP rivals later
  const ownRd =
    ownRes && ownRes.ok && ownRes.summary ? Number(ownRes.summary.referringDomains) || 0 : null;
  const findings = [];
  const stronger = competitorRows.filter(function (c) {
    return c.ok && c.referringDomains != null && ownRd != null && c.referringDomains > ownRd * 1.25;
  });

  if (stronger.length) {
    const recipe = getRecipe('backlink_gap_local');
    findings.push({
      id: 'auth:backlink_gap',
      code: 'backlink_gap_local',
      recipeId: 'backlink_gap_local',
      title: (recipe && recipe.title) || 'Local authority / backlink gap',
      plainLanguage:
        stronger[0].domain +
        ' has ' +
        stronger[0].referringDomains +
        ' referring domains vs your ' +
        ownRd +
        '. Earn local citations and partnerships — do not buy spam links.',
      severity: (recipe && recipe.severityDefault) || 'medium',
      status: 'open',
      actions: (recipe && recipe.actions) || ['create_task'],
      autoFixAllowed: false,
      evidence: {
        source: 'backlink_gap',
        ownDomain: own,
        ownReferringDomains: ownRd,
        competitors: stronger.slice(0, 5)
      },
      labelClass: (ownRes && ownRes.summary && ownRes.summary.labelClass) || 'estimated'
    });
  }

  return {
    ok: true,
    siteId: site && site.id,
    domain: own,
    own: ownRes && ownRes.ok ? ownRes.summary : null,
    ownError: ownRes && !ownRes.ok ? ownRes.error || ownRes.message : null,
    competitors: competitorRows,
    findings: findings,
    provider: (ownRes && ownRes.provider) || gw.preferred,
    labelClass: 'estimated',
    note:
      competitors.length === 0
        ? 'Add competitors in site config (config.competitors) or pass domains to compare.'
        : null,
    analysedAt: new Date().toISOString()
  };
}

async function persistCompetitors(admin, siteId, domains) {
  if (!admin || !siteId || !domains || !domains.length) return { ok: false, skipped: true };
  let upserted = 0;
  for (let i = 0; i < domains.length; i++) {
    try {
      const { error } = await admin.from('si_competitors').upsert(
        {
          site_id: siteId,
          domain: domains[i],
          competitor_type: 'business',
          meta: { source: 'backlink_gap' }
        },
        { onConflict: 'site_id,domain' }
      );
      if (!error) upserted += 1;
    } catch (_e) {
      /* schema pending */
    }
  }
  return { ok: true, upserted: upserted };
}

async function runBacklinkGap(admin, site, opts) {
  const result = await analyseBacklinkGap(site, opts);
  if (admin && site && site.id && result.ok) {
    await meterUsage(admin, site.id, 'backlink_summary', 1 + (result.competitors || []).length, {
      provider: result.provider,
      domain: result.domain
    });
    const domains = (result.competitors || [])
      .map(function (c) {
        return c.domain;
      })
      .filter(Boolean);
    result.persist = await persistCompetitors(admin, site.id, domains);
  }
  return result;
}

module.exports = {
  hostFromSite: hostFromSite,
  competitorDomainsFromSite: competitorDomainsFromSite,
  analyseBacklinkGap: analyseBacklinkGap,
  persistCompetitors: persistCompetitors,
  runBacklinkGap: runBacklinkGap
};
