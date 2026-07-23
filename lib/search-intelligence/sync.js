'use strict';

/**
 * Search Intelligence sync — GSC query×page + GA4 landing pages.
 */

const { ensureAccessToken } = require('./google-oauth/tokens');
const { fetchSearchAnalytics } = require('./connectors/gsc-client');
const { fetchLandingPageReport } = require('./connectors/ga4-data');

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoDay(d) {
  return String(d || '').slice(0, 10);
}

async function markSync(admin, siteId, provider, lastSyncAt, lastError) {
  if (!admin || !siteId) return;
  const patch = {
    updated_at: new Date().toISOString(),
    last_sync_error: lastError || null
  };
  if (lastSyncAt) patch.last_sync_at = lastSyncAt;
  try {
    await admin.from('si_connections').update(patch).eq('site_id', siteId).eq('provider', provider);
  } catch (_e) {
    /* ignore */
  }
  if (lastError) {
    try {
      const { recordAnnotation } = require('./annotations');
      await recordAnnotation(admin, siteId, {
        annotationType: 'connector_sync_error',
        title: 'Sync failed — ' + provider,
        detail: { provider: provider, error: String(lastError).slice(0, 500) }
      });
    } catch (_e2) {
      /* ignore */
    }
  }
}

async function syncGscSite(admin, conn, opts) {
  const o = opts || {};
  const siteId = conn && conn.site_id;
  if (!siteId) return { ok: false, siteId: null, error: 'missing_site' };
  if (!conn.property_id) {
    return { ok: false, siteId: siteId, skipped: 'no_property', error: 'Select a Search Console property first.' };
  }
  if (conn.enabled === false) {
    return { ok: false, siteId: siteId, skipped: 'disabled' };
  }

  const days = Math.max(1, Math.min(90, o.days || 28));
  const endDate = o.endDate || daysAgo(0);
  const startDate = o.startDate || daysAgo(days);
  const rowLimit = o.rowLimit || 2500;

  try {
    const access = await ensureAccessToken(admin, conn, 'search_console');
    const rows = await fetchSearchAnalytics(access, conn.property_id, {
      startDate: startDate,
      endDate: endDate,
      rowLimit: rowLimit
    });

    const { error: delErr } = await admin
      .from('si_query_page_stats')
      .delete()
      .eq('site_id', siteId)
      .eq('period_start', startDate)
      .eq('period_end', endDate);
    if (delErr && /relation|does not exist|si_query_page_stats/i.test(String(delErr.message || ''))) {
      await markSync(admin, siteId, 'search_console', null, 'schema_pending: apply search_intelligence_schema.sql');
      return { ok: false, siteId: siteId, error: 'schema_pending', message: delErr.message };
    }
    if (delErr) throw new Error(delErr.message);

    if (rows.length) {
      const now = new Date().toISOString();
      const batch = rows.map(function (r) {
        return {
          site_id: siteId,
          query: r.query || '(not provided)',
          page_url: r.pageUrl || '',
          period_start: startDate,
          period_end: endDate,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          label_class: 'measured',
          fetched_at: now
        };
      });
      const chunk = 500;
      for (let i = 0; i < batch.length; i += chunk) {
        const { error: insErr } = await admin.from('si_query_page_stats').insert(batch.slice(i, i + chunk));
        if (insErr) throw new Error(insErr.message);
      }
    }

    await markSync(admin, siteId, 'search_console', new Date().toISOString(), null);
    return {
      ok: true,
      siteId: siteId,
      provider: 'search_console',
      propertyId: conn.property_id,
      rows: rows.length,
      startDate: startDate,
      endDate: endDate
    };
  } catch (e) {
    const msg = String((e && e.message) || e);
    await markSync(admin, siteId, 'search_console', null, msg.slice(0, 500));
    return { ok: false, siteId: siteId, error: 'sync_failed', message: msg };
  }
}

async function syncGa4Site(admin, conn, opts) {
  const o = opts || {};
  const siteId = conn && conn.site_id;
  if (!siteId) return { ok: false, siteId: null, error: 'missing_site' };
  if (!conn.property_id) {
    return { ok: false, siteId: siteId, skipped: 'no_property', error: 'Select a GA4 property first.' };
  }
  if (conn.enabled === false) {
    return { ok: false, siteId: siteId, skipped: 'disabled' };
  }

  const days = Math.max(1, Math.min(90, o.days || 28));
  const endDate = o.endDate || daysAgo(0);
  const startDate = o.startDate || daysAgo(days);

  try {
    const access = await ensureAccessToken(admin, conn, 'ga4');
    const rows = await fetchLandingPageReport(access, conn.property_id, {
      startDate: startDate,
      endDate: endDate,
      rowLimit: o.rowLimit || 1000
    });

    const { error: delErr } = await admin
      .from('si_ga4_landing_stats')
      .delete()
      .eq('site_id', siteId)
      .eq('period_start', startDate)
      .eq('period_end', endDate);
    if (delErr && /relation|does not exist|si_ga4_landing_stats/i.test(String(delErr.message || ''))) {
      await markSync(admin, siteId, 'ga4', null, 'schema_pending: apply search_intelligence_schema.sql (si_ga4_landing_stats)');
      return { ok: false, siteId: siteId, error: 'schema_pending', message: delErr.message };
    }
    if (delErr) throw new Error(delErr.message);

    if (rows.length) {
      const now = new Date().toISOString();
      const batch = rows.map(function (r) {
        return {
          site_id: siteId,
          landing_page: r.landingPage || '(not set)',
          period_start: startDate,
          period_end: endDate,
          sessions: r.sessions,
          engaged_sessions: r.engagedSessions,
          conversions: r.conversions,
          bounce_rate: r.bounceRate,
          label_class: 'measured',
          fetched_at: now
        };
      });
      const chunk = 500;
      for (let i = 0; i < batch.length; i += chunk) {
        const { error: insErr } = await admin.from('si_ga4_landing_stats').insert(batch.slice(i, i + chunk));
        if (insErr) throw new Error(insErr.message);
      }
    }

    await markSync(admin, siteId, 'ga4', new Date().toISOString(), null);
    return {
      ok: true,
      siteId: siteId,
      provider: 'ga4',
      propertyId: conn.property_id,
      rows: rows.length,
      startDate: startDate,
      endDate: endDate
    };
  } catch (e) {
    const msg = String((e && e.message) || e);
    await markSync(admin, siteId, 'ga4', null, msg.slice(0, 500));
    return { ok: false, siteId: siteId, error: 'sync_failed', message: msg };
  }
}

async function loadGscTotals(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const endDate = o.endDate || daysAgo(0);
  const startDate = o.startDate || daysAgo(days);
  if (!admin || !siteId) {
    return { clicks: 0, impressions: 0, rows: 0, startDate: startDate, endDate: endDate, available: false };
  }
  try {
    const { data, error } = await admin
      .from('si_query_page_stats')
      .select('clicks,impressions')
      .eq('site_id', siteId)
      .eq('period_start', startDate)
      .eq('period_end', endDate);
    if (error) {
      return { clicks: 0, impressions: 0, rows: 0, startDate: startDate, endDate: endDate, available: false };
    }
    let clicks = 0;
    let impressions = 0;
    (data || []).forEach(function (r) {
      clicks += Number(r.clicks || 0);
      impressions += Number(r.impressions || 0);
    });
    return {
      clicks: clicks,
      impressions: impressions,
      rows: (data || []).length,
      startDate: startDate,
      endDate: endDate,
      available: true,
      labelClass: 'measured'
    };
  } catch (_e) {
    return { clicks: 0, impressions: 0, rows: 0, startDate: startDate, endDate: endDate, available: false };
  }
}

async function loadGa4Totals(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const endDate = o.endDate || daysAgo(0);
  const startDate = o.startDate || daysAgo(days);
  const empty = {
    sessions: 0,
    engagedSessions: 0,
    conversions: 0,
    rows: 0,
    startDate: startDate,
    endDate: endDate,
    available: false
  };
  if (!admin || !siteId) return empty;
  try {
    const { data, error } = await admin
      .from('si_ga4_landing_stats')
      .select('sessions,engaged_sessions,conversions')
      .eq('site_id', siteId)
      .eq('period_start', startDate)
      .eq('period_end', endDate);
    if (error) return empty;
    let sessions = 0;
    let engagedSessions = 0;
    let conversions = 0;
    (data || []).forEach(function (r) {
      sessions += Number(r.sessions || 0);
      engagedSessions += Number(r.engaged_sessions || 0);
      conversions += Number(r.conversions || 0);
    });
    return {
      sessions: sessions,
      engagedSessions: engagedSessions,
      conversions: conversions,
      rows: (data || []).length,
      startDate: startDate,
      endDate: endDate,
      available: true,
      labelClass: 'measured'
    };
  } catch (_e) {
    return empty;
  }
}

async function syncAllConnected(admin, opts) {
  const o = opts || {};
  const results = [];

  const { data: gscRows, error: gscErr } = await admin
    .from('si_connections')
    .select('*')
    .eq('provider', 'search_console')
    .eq('connection_status', 'connected')
    .eq('enabled', true)
    .not('property_id', 'is', null);
  if (gscErr) throw new Error(gscErr.message);
  for (const conn of gscRows || []) {
    results.push(await syncGscSite(admin, conn, o));
  }

  const { data: ga4Rows, error: ga4Err } = await admin
    .from('si_connections')
    .select('*')
    .eq('provider', 'ga4')
    .eq('connection_status', 'connected')
    .eq('enabled', true)
    .not('property_id', 'is', null);
  if (ga4Err) throw new Error(ga4Err.message);
  for (const conn of ga4Rows || []) {
    results.push(await syncGa4Site(admin, conn, o));
  }

  return results;
}

module.exports = {
  daysAgo: daysAgo,
  isoDay: isoDay,
  syncGscSite: syncGscSite,
  syncGa4Site: syncGa4Site,
  syncAllConnected: syncAllConnected,
  loadGscTotals: loadGscTotals,
  loadGa4Totals: loadGa4Totals,
  markSync: markSync
};
