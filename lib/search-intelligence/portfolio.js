'use strict';

/**
 * Partner portfolio rollup — sites for a partner with Search Intelligence health,
 * open actions, organic-lead snapshot metrics, and rank-drop risk flags.
 */

function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

/**
 * Pure risk classifier for portfolio rows (unit-tested).
 * @param {{ health?: string, openActions?: number, criticalActions?: number, rankDrops?: number, gsc?: { lastError?: string|null } }} row
 */
function classifyPortfolioRisk(row) {
  const r = row || {};
  const reasons = [];
  if (r.health === 'needs_setup') reasons.push('needs_setup');
  if ((r.openActions || 0) >= 3) reasons.push('open_actions');
  if ((r.criticalActions || 0) >= 1) reasons.push('critical');
  if ((r.rankDrops || 0) >= 1) reasons.push('rank_drop');
  if (r.gsc && r.gsc.lastError) reasons.push('sync_error');
  return { atRisk: reasons.length > 0, riskReasons: reasons };
}

/**
 * Count tracked keywords whose latest position is worse (higher) than an earlier
 * observation in the window. Position null skips.
 */
function countRankDrops(observations) {
  const byKey = new Map();
  (observations || []).forEach(function (o) {
    if (o.position == null) return;
    const key = String(o.tracked_keyword_id || o.keyword_id || '');
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(o);
  });
  let drops = 0;
  byKey.forEach(function (list) {
    if (list.length < 2) return;
    const first = list[0];
    const last = list[list.length - 1];
    const a = Number(first.position);
    const b = Number(last.position);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    // Higher position number = worse ranking
    if (b >= a + 3) drops += 1;
  });
  return drops;
}

async function loadOpenRecommendationCounts(admin, siteIds) {
  const openBySite = {};
  const criticalBySite = {};
  if (!admin || !siteIds.length) return { openBySite: openBySite, criticalBySite: criticalBySite };
  try {
    const { data } = await admin
      .from('si_recommendations')
      .select('site_id,severity,status')
      .in('site_id', siteIds)
      .eq('status', 'open');
    (data || []).forEach(function (r) {
      openBySite[r.site_id] = (openBySite[r.site_id] || 0) + 1;
      const sev = String(r.severity || '').toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        criticalBySite[r.site_id] = (criticalBySite[r.site_id] || 0) + 1;
      }
    });
  } catch (_e) {
    /* schema may be missing */
  }
  return { openBySite: openBySite, criticalBySite: criticalBySite };
}

async function loadLatestSnapshots(admin, siteIds) {
  const latest = {};
  if (!admin || !siteIds.length) return latest;
  try {
    const { data } = await admin
      .from('si_report_snapshots')
      .select('site_id,period_end,created_at,report_kind,payload')
      .in('site_id', siteIds)
      .order('period_end', { ascending: false })
      .limit(Math.min(600, Math.max(50, siteIds.length * 3)));
    (data || []).forEach(function (row) {
      if (!latest[row.site_id]) latest[row.site_id] = row;
    });
  } catch (_e) {
    /* ignore */
  }
  return latest;
}

async function loadRankDropCounts(admin, siteIds) {
  const dropsBySite = {};
  if (!admin || !siteIds.length) return dropsBySite;
  try {
    const since = daysAgoIso(21);
    const { data } = await admin
      .from('si_rank_observations')
      .select('site_id,tracked_keyword_id,keyword_id,position,fetched_at')
      .in('site_id', siteIds)
      .gte('fetched_at', since)
      .order('fetched_at', { ascending: true })
      .limit(8000);
    const bySite = {};
    (data || []).forEach(function (o) {
      if (!bySite[o.site_id]) bySite[o.site_id] = [];
      bySite[o.site_id].push(o);
    });
    Object.keys(bySite).forEach(function (sid) {
      dropsBySite[sid] = countRankDrops(bySite[sid]);
    });
  } catch (_e) {
    /* ignore */
  }
  return dropsBySite;
}

async function loadPartnerPortfolio(admin, partnerId) {
  if (!admin || !partnerId) {
    return {
      ok: true,
      partnerId: partnerId || null,
      summary: { total: 0, good: 0, partial: 0, needsSetup: 0, atRisk: 0 },
      sites: []
    };
  }

  const { data: sites, error } = await admin
    .from('sites')
    .select('id,slug,business_name,status,custom_domain,servicing_partner_id,referring_partner_id,owner_email')
    .or('servicing_partner_id.eq.' + partnerId + ',referring_partner_id.eq.' + partnerId)
    .order('business_name', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const siteIds = (sites || []).map(function (s) { return s.id; });
  const connBySite = {};
  if (siteIds.length) {
    try {
      const { data: conns } = await admin
        .from('si_connections')
        .select('site_id,provider,connection_status,property_id,last_sync_at,last_sync_error')
        .in('site_id', siteIds);
      (conns || []).forEach(function (c) {
        if (!connBySite[c.site_id]) connBySite[c.site_id] = {};
        connBySite[c.site_id][c.provider] = c;
      });
    } catch (_e) {
      /* schema may be missing */
    }
  }

  const trackedCounts = {};
  if (siteIds.length) {
    try {
      const { data: tracked } = await admin
        .from('si_tracked_keywords')
        .select('site_id')
        .in('site_id', siteIds)
        .eq('active', true);
      (tracked || []).forEach(function (t) {
        trackedCounts[t.site_id] = (trackedCounts[t.site_id] || 0) + 1;
      });
    } catch (_e) {
      /* ignore */
    }
  }

  const [recCounts, snapshots, rankDrops] = await Promise.all([
    loadOpenRecommendationCounts(admin, siteIds),
    loadLatestSnapshots(admin, siteIds),
    loadRankDropCounts(admin, siteIds)
  ]);

  const rows = (sites || []).map(function (s) {
    const c = connBySite[s.id] || {};
    const gsc = c.search_console;
    const ga4 = c.ga4;
    const snap = snapshots[s.id] || null;
    const payload = snap && snap.payload ? snap.payload : null;
    const metrics = (payload && payload.metrics) || {};
    const openFromSnap = metrics.openActions != null ? Number(metrics.openActions) : null;
    const openFromRecs = recCounts.openBySite[s.id] || 0;
    const openActions = Math.max(openFromRecs, openFromSnap != null ? openFromSnap : 0);
    const criticalActions = recCounts.criticalBySite[s.id] || 0;
    const health =
      gsc && gsc.connection_status === 'connected' && gsc.property_id
        ? ga4 && ga4.connection_status === 'connected'
          ? 'good'
          : 'partial'
        : 'needs_setup';

    const base = {
      siteId: s.id,
      slug: s.slug,
      businessName: s.business_name,
      status: s.status,
      customDomain: s.custom_domain,
      ownerEmail: s.owner_email || null,
      relationship:
        s.servicing_partner_id === partnerId
          ? 'servicing'
          : s.referring_partner_id === partnerId
            ? 'referring'
            : 'related',
      gsc: gsc
        ? {
            status: gsc.connection_status,
            hasProperty: !!gsc.property_id,
            lastSyncAt: gsc.last_sync_at,
            lastError: gsc.last_sync_error
          }
        : { status: 'not_connected', hasProperty: false, lastError: null },
      ga4: ga4
        ? {
            status: ga4.connection_status,
            hasProperty: !!ga4.property_id,
            lastSyncAt: ga4.last_sync_at
          }
        : { status: 'not_connected', hasProperty: false },
      trackedKeywords: trackedCounts[s.id] || 0,
      health: health,
      openActions: openActions,
      criticalActions: criticalActions,
      rankDrops: rankDrops[s.id] || 0,
      organicLeads: metrics.organicLeads != null ? Number(metrics.organicLeads) : null,
      lastSummaryAt: snap ? snap.created_at || snap.period_end : null,
      lastSummaryKind: snap ? snap.report_kind : null
    };
    const risk = classifyPortfolioRisk(base);
    return Object.assign(base, risk);
  });

  // At-risk first, then needs_setup, then name
  rows.sort(function (a, b) {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    if (a.health !== b.health) {
      const order = { needs_setup: 0, partial: 1, good: 2 };
      return (order[a.health] || 9) - (order[b.health] || 9);
    }
    return String(a.businessName || '').localeCompare(String(b.businessName || ''));
  });

  const summary = {
    total: rows.length,
    good: rows.filter(function (r) { return r.health === 'good'; }).length,
    partial: rows.filter(function (r) { return r.health === 'partial'; }).length,
    needsSetup: rows.filter(function (r) { return r.health === 'needs_setup'; }).length,
    atRisk: rows.filter(function (r) { return r.atRisk; }).length
  };

  return { ok: true, partnerId: partnerId, summary: summary, sites: rows };
}

module.exports = {
  loadPartnerPortfolio: loadPartnerPortfolio,
  classifyPortfolioRisk: classifyPortfolioRisk,
  countRankDrops: countRankDrops
};
