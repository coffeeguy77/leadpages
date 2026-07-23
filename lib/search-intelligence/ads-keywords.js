'use strict';

/**
 * Load Ads / paid keyword signals for SEO↔PPC universe (Phase 4).
 * Prefers synced keyword_view rows; falls back to ad-group names + utm_term.
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function pushUnique(map, keyword, meta) {
  const k = norm(keyword);
  if (!k || k.length < 2 || k.length > 120) return;
  // Skip pure IDs / URLs
  if (/^https?:\/\//.test(k) || /^\d+$/.test(k)) return;
  if (!map[k]) {
    map[k] = {
      keyword: k,
      campaign: (meta && meta.campaign) || null,
      adGroup: (meta && meta.adGroup) || null,
      source: (meta && meta.source) || 'derived',
      clicks: 0,
      impressions: 0
    };
  }
  const row = map[k];
  if (meta && meta.campaign && !row.campaign) row.campaign = meta.campaign;
  if (meta && meta.adGroup && !row.adGroup) row.adGroup = meta.adGroup;
  if (meta && meta.source) row.source = meta.source;
  row.clicks += Number((meta && meta.clicks) || 0);
  row.impressions += Number((meta && meta.impressions) || 0);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient|null} admin
 * @param {string} siteId
 * @param {{ days?: number }} [opts]
 */
async function loadAdsKeywords(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const empty = {
    ok: true,
    available: false,
    items: [],
    count: 0,
    sources: [],
    connectionStatus: 'unknown',
    note: 'Connect Google Ads and sync to populate paid keywords.'
  };
  if (!admin || !siteId) return empty;

  let connectionStatus = 'not_connected';
  try {
    const { data: conn } = await admin
      .from('google_ads_connections')
      .select('connection_status,enabled,customer_id,last_sync_at')
      .eq('site_id', siteId)
      .maybeSingle();
    if (conn && conn.enabled !== false && conn.connection_status === 'connected') {
      connectionStatus = 'connected';
    } else if (conn) {
      connectionStatus = conn.connection_status || 'disconnected';
    }
  } catch (_e) {
    connectionStatus = 'schema_pending';
  }

  const map = {};
  const sources = [];
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceDay = since.toISOString().slice(0, 10);

  // 1) Synced keyword_view rows (full import)
  try {
    const { data, error } = await admin
      .from('ads_keyword_daily')
      .select('keyword_text,match_type,campaign_name,ad_group_name,impressions,clicks,day')
      .eq('site_id', siteId)
      .gte('day', sinceDay)
      .limit(5000);
    if (!error && data && data.length) {
      sources.push('ads_keyword_daily');
      data.forEach(function (r) {
        pushUnique(map, r.keyword_text, {
          campaign: r.campaign_name,
          adGroup: r.ad_group_name,
          source: 'keyword_view',
          clicks: r.clicks,
          impressions: r.impressions
        });
      });
    }
  } catch (_e) {
    /* table may not exist yet */
  }

  // 2) Fallback: ad group / campaign names from metrics
  if (Object.keys(map).length < 5) {
    try {
      const { data, error } = await admin
        .from('ads_metrics_daily')
        .select('campaign_name,ad_group_name,impressions,clicks,day')
        .eq('site_id', siteId)
        .gte('day', sinceDay)
        .limit(3000);
      if (!error && data && data.length) {
        sources.push('ads_metrics_daily');
        data.forEach(function (r) {
          if (r.ad_group_name) {
            pushUnique(map, r.ad_group_name, {
              campaign: r.campaign_name,
              adGroup: r.ad_group_name,
              source: 'ad_group_name',
              clicks: r.clicks,
              impressions: r.impressions
            });
          }
        });
      }
    } catch (_e) {
      /* ignore */
    }
  }

  // 3) Paid click utm_term from sessions / leads
  try {
    const { data, error } = await admin
      .from('visitor_sessions')
      .select('utm_term,utm_campaign,gclid,traffic_source')
      .eq('site_id', siteId)
      .not('utm_term', 'is', null)
      .gte('last_activity_at', since.toISOString())
      .limit(500);
    if (!error && data && data.length) {
      sources.push('visitor_sessions.utm_term');
      data.forEach(function (r) {
        const paid =
          r.gclid ||
          r.traffic_source === 'google_ads' ||
          r.traffic_source === 'paid';
        if (!paid && !r.utm_term) return;
        pushUnique(map, r.utm_term, {
          campaign: r.utm_campaign,
          source: 'utm_term',
          clicks: 1
        });
      });
    }
  } catch (_e) {
    /* ignore */
  }

  try {
    const { data, error } = await admin
      .from('leads')
      .select('utm_term,utm_campaign,gclid,traffic_source')
      .eq('site_id', siteId)
      .not('utm_term', 'is', null)
      .gte('created_at', since.toISOString())
      .limit(500);
    if (!error && data && data.length) {
      sources.push('leads.utm_term');
      data.forEach(function (r) {
        pushUnique(map, r.utm_term, {
          campaign: r.utm_campaign,
          source: 'utm_term',
          clicks: 1
        });
      });
    }
  } catch (_e) {
    /* ignore */
  }

  const items = Object.keys(map)
    .map(function (k) {
      return map[k];
    })
    .sort(function (a, b) {
      return b.clicks + b.impressions / 100 - (a.clicks + a.impressions / 100);
    })
    .slice(0, 200);

  return {
    ok: true,
    available: items.length > 0,
    items: items,
    count: items.length,
    sources: Array.from(new Set(sources)),
    connectionStatus: connectionStatus,
    days: days,
    labelClass: sources.indexOf('ads_keyword_daily') >= 0 ? 'measured' : 'modelled',
    note:
      items.length === 0
        ? connectionStatus === 'connected'
          ? 'Ads connected but no keyword rows yet — re-sync Advertising or wait for keyword_view import.'
          : 'Connect Google Ads (Advertising tab) and sync to populate the SEO↔PPC matrix.'
        : sources.indexOf('ads_keyword_daily') >= 0
          ? 'Paid keywords from Google Ads keyword_view sync.'
          : 'Derived from ad-group names and/or utm_term until keyword_view sync lands.'
  };
}

module.exports = {
  loadAdsKeywords: loadAdsKeywords,
  norm: norm
};
