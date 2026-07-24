// GET /api/google-ads/status?siteId=&days=30 — connection health + overview metrics
const { createClient } = require('@supabase/supabase-js');
const cfg = require('../../lib/google-ads/config');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'GET') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const siteId = String((req.query && (req.query.siteId || req.query.site_id)) || '').trim();
    if (!siteId) return json(400, { error: 'missing_siteId' });
    const days = Math.max(1, Math.min(90, parseInt((req.query && req.query.days) || '30', 10) || 30));
    const since = daysAgo(days);
    const sinceDay = since.slice(0, 10);

    const { data: conn } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();

    // Ads metrics
    let spendMicros = 0, adClicks = 0, impressions = 0, googleConversions = 0;
    const { data: metrics } = await admin
      .from('ads_metrics_daily')
      .select('impressions,clicks,cost_micros,conversions,campaign_id,campaign_name,final_url,page_id,day')
      .eq('site_id', siteId)
      .gte('day', sinceDay);

    (metrics || []).forEach((m) => {
      spendMicros += Number(m.cost_micros || 0);
      adClicks += Number(m.clicks || 0);
      impressions += Number(m.impressions || 0);
      googleConversions += Number(m.conversions || 0);
    });

    // Internal events with ads attribution
    const { data: events } = await admin
      .from('events')
      .select('event,props,created_at')
      .eq('site_id', siteId)
      .gte('created_at', since)
      .in('event', ['page_view', 'call_click', 'lead_submit']);

    let visitors = 0, callClicks = 0, forms = 0;
    const convertingSessions = new Set();
    let adsVisitors = 0;
    const adsVisitorSessions = new Set();

    (events || []).forEach((ev) => {
      const p = ev.props || {};
      const isAds = !!(p.gclid || p.gbraid || p.wbraid || p.traffic_source === 'google_ads');
      if (ev.event === 'page_view') {
        visitors++;
        if (isAds) {
          adsVisitors++;
          if (p.session_id) adsVisitorSessions.add(p.session_id);
        }
      }
      if (ev.event === 'call_click') {
        callClicks++;
        if (p.session_id) convertingSessions.add(p.session_id);
      }
      if (ev.event === 'lead_submit') {
        forms++;
        if (p.session_id) convertingSessions.add(p.session_id);
      }
    });

    const uniqueConversions = convertingSessions.size;
    const spend = spendMicros / 1e6;
    const costPerConversion = uniqueConversions ? spend / uniqueConversions : null;
    const conversionRate = adsVisitorSessions.size
      ? uniqueConversions / adsVisitorSessions.size
      : (visitors ? uniqueConversions / visitors : null);

    // Click id capture health
    const { count: gclidCount } = await admin
      .from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('gclid', 'is', null)
      .gte('last_activity_at', since);

    const { data: unmatched } = await admin
      .from('ads_unmatched_urls')
      .select('final_url,clicks,last_seen_at')
      .eq('site_id', siteId)
      .order('last_seen_at', { ascending: false })
      .limit(20);

    const { count: matchedPages } = await admin
      .from('ads_metrics_daily')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .gte('day', sinceDay)
      .not('page_id', 'is', null);

    return json(200, {
      ok: true,
      platformConfigured: cfg.configured(),
      connected: !!(conn && conn.enabled && conn.refresh_token && (conn.connection_status == null || conn.connection_status === 'connected')),
      encryptionConfigured: cfg.encryptionConfigured(),
      connection: conn ? {
        siteId: conn.site_id,
        slug: conn.slug,
        leadpagesUserId: conn.leadpages_user_id || null,
        googleAccountEmail: conn.google_account_email || null,
        customerId: conn.customer_id,
        accountName: conn.account_name,
        managerCustomerId: conn.login_customer_id || null,
        grantedScopes: conn.granted_scopes || null,
        connectionStatus: conn.connection_status || 'connected',
        eventRoles: conn.event_roles,
        conversionActions: conn.conversion_actions,
        tagId: conn.tag_id,
        tagActive: !!conn.tag_id,
        adsGa4LinkConfirmed: !!conn.ads_ga4_link_confirmed_at,
        adsGa4LinkConfirmedAt: conn.ads_ga4_link_confirmed_at || null,
        lastSyncAt: conn.last_sync_at,
        lastSyncError: conn.last_sync_error,
        formTestAt: conn.form_test_at,
        callTestAt: conn.call_test_at,
        connectedAt: conn.connected_at
      } : null,
      overview: {
        days,
        spend,
        adClicks,
        impressions,
        googleConversions,
        visitors,
        adsVisitors: adsVisitorSessions.size || adsVisitors,
        callClicks,
        formSubmissions: forms,
        uniqueConversions,
        costPerConversion,
        conversionRate,
        totalActions: callClicks + forms
      },
      health: {
        clickIdsCaptured: gclidCount || 0,
        matchedMetricRows: matchedPages || 0,
        unmatchedUrls: unmatched || []
      }
    });
  } catch (e) {
    console.error('google-ads status:', e && e.message);
    return json(500, { error: (e && e.message) || 'status_failed' });
  }
};
