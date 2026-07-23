'use strict';

/**
 * Client summary payload builder + persist to si_report_snapshots.
 */

const { loadGscTotals, loadGa4Totals, daysAgo } = require('./sync');
const { loadOrganicLeadSummary } = require('./attribution-organic');
const { loadPagePerformance } = require('./page-performance');
const { listTracked } = require('./tracked-keywords');
const { auditSiteConfig } = require('./audit/config-audit');
const { loadCrmOutcomes, buildCrmOutcomes } = require('./crm-outcomes');

async function loadConnectionsLite(admin, siteId) {
  const out = {};
  if (!admin) return out;
  try {
    const { data } = await admin
      .from('si_connections')
      .select('provider,connection_status,property_id,last_sync_at,last_sync_error')
      .eq('site_id', siteId);
    (data || []).forEach(function (r) {
      if (r && r.provider) out[r.provider] = r;
    });
  } catch (_e) {
    /* ignore */
  }
  return out;
}

/**
 * Build a plain-language summary snapshot for a site.
 */
async function buildClientSummary(admin, site, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const siteId = site && site.id;
  const cfg = (site && site.config) || {};

  const [gsc, ga4, organic, pages, tracked, connections, crm] = await Promise.all([
    loadGscTotals(admin, siteId, { days: days }),
    loadGa4Totals(admin, siteId, { days: days }),
    loadOrganicLeadSummary(admin, siteId, { days: days }),
    loadPagePerformance(admin, siteId, { days: days }),
    listTracked(admin, siteId).catch(function () {
      return { items: [], count: 0, limit: 25 };
    }),
    loadConnectionsLite(admin, siteId),
    loadCrmOutcomes(admin, site, { days: days }).catch(function () {
      return buildCrmOutcomes(site, [], { days: days });
    })
  ]);

  const audit = auditSiteConfig(cfg, {
    siteId: siteId,
    businessName: site && site.business_name
  });

  const openActions = (pages.findings || [])
    .concat(audit.findings || [])
    .concat((crm && crm.findings) || [])
    .slice(0, 8);
  const periodStart = gsc.startDate || daysAgo(days);
  const periodEnd = gsc.endDate || daysAgo(0);

  const bullets = [];
  if (gsc.available && gsc.rows > 0) {
    bullets.push(
      'Organic search: ' + gsc.clicks + ' clicks and ' + gsc.impressions + ' impressions (' + periodStart + ' → ' + periodEnd + ').'
    );
  } else {
    bullets.push('Search Console data not synced yet for this window.');
  }
  if (ga4.available && ga4.rows > 0) {
    bullets.push('GA4 landing pages: ' + ga4.sessions + ' sessions · ' + ga4.conversions + ' conversions.');
  }
  if (organic.available) {
    bullets.push(
      'Organic leads (first-party): ' +
        organic.organicLeads +
        ' (' +
        organic.organicCallClicks +
        ' call-clicks, ' +
        organic.organicForms +
        ' forms).'
    );
  }
  if (crm && crm.available) {
    bullets.push(
      'CRM outcomes: ' +
        crm.won +
        ' won / ' +
        crm.totalLeads +
        ' leads' +
        (crm.winRate != null ? ' (win rate ' + Math.round(crm.winRate * 100) + '%)' : '') +
        ' · booked value ~$' +
        crm.totalValueDollars +
        ' (' +
        crm.labelClass +
        ').'
    );
    const topArea = (crm.byArea || []).find(function (a) {
      return a.area !== '(unmatched)' && a.won > 0;
    });
    if (topArea) {
      bullets.push('Top service area by wins: ' + topArea.area + ' (' + topArea.won + ' won).');
    }
  }
  bullets.push('Tracked keywords: ' + (tracked.count || 0) + ' / ' + (tracked.limit || 25) + '.');
  if (openActions.length) {
    bullets.push(openActions.length + ' open SEO action(s) recommended.');
  } else {
    bullets.push('No open config/GSC recipe actions right now.');
  }

  return {
    ok: true,
    siteId: siteId,
    businessName: (site && site.business_name) || null,
    slug: (site && site.slug) || null,
    reportKind: o.reportKind || 'weekly',
    periodStart: periodStart,
    periodEnd: periodEnd,
    generatedAt: new Date().toISOString(),
    bullets: bullets,
    metrics: {
      gscClicks: gsc.available ? gsc.clicks : null,
      gscImpressions: gsc.available ? gsc.impressions : null,
      ga4Sessions: ga4.available ? ga4.sessions : null,
      ga4Conversions: ga4.available ? ga4.conversions : null,
      organicLeads: organic.available ? organic.organicLeads : null,
      crmWon: crm && crm.available ? crm.won : null,
      crmTotalLeads: crm && crm.available ? crm.totalLeads : null,
      crmWinRate: crm && crm.available ? crm.winRate : null,
      crmValueDollars: crm && crm.available ? crm.totalValueDollars : null,
      crmByArea: crm && crm.available ? (crm.byArea || []).slice(0, 12) : [],
      trackedKeywords: tracked.count || 0,
      trackedLimit: tracked.limit || 25,
      openActions: openActions.length,
      pagesWithGsc: pages.pageCount || 0
    },
    crmOutcomes: crm || null,
    connections: {
      search_console: connections.search_console
        ? {
            status: connections.search_console.connection_status,
            propertyId: connections.search_console.property_id,
            lastSyncAt: connections.search_console.last_sync_at
          }
        : { status: 'not_connected' },
      ga4: connections.ga4
        ? {
            status: connections.ga4.connection_status,
            propertyId: connections.ga4.property_id,
            lastSyncAt: connections.ga4.last_sync_at
          }
        : { status: 'not_connected' }
    },
    topActions: openActions.slice(0, 5).map(function (a) {
      return {
        title: a.title,
        plainLanguage: a.plainLanguage,
        severity: a.severity,
        recipeId: a.recipeId || null,
        code: a.code || null
      };
    }),
    topPages: (pages.pages || []).slice(0, 5).map(function (p) {
      return {
        pageUrl: p.pageUrl,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        avgPosition: p.avgPosition
      };
    })
  };
}

async function saveReportSnapshot(admin, summary) {
  if (!admin || !summary || !summary.siteId) throw new Error('missing_summary');
  const row = {
    site_id: summary.siteId,
    period_start: summary.periodStart,
    period_end: summary.periodEnd,
    report_kind: summary.reportKind || 'weekly',
    payload: summary
  };
  const { data, error } = await admin.from('si_report_snapshots').insert(row).select('id,created_at').single();
  if (error) {
    if (/relation|does not exist/i.test(String(error.message || ''))) {
      const err = new Error('schema_pending');
      err.code = 'schema_pending';
      throw err;
    }
    throw new Error(error.message);
  }
  return { ok: true, id: data.id, createdAt: data.created_at };
}

module.exports = {
  buildClientSummary: buildClientSummary,
  saveReportSnapshot: saveReportSnapshot
};
