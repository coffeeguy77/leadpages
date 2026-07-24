// POST /api/google-ads/sync — manually sync Google Ads metrics for one site.
// Auth required. Used by Advertising "Sync now" (cron also runs every 2h).

const { createClient } = require('@supabase/supabase-js');
const { syncSiteMetrics, daysAgo } = require('../../lib/google-ads/sync');
const { syncCampaignMaps } = require('../../lib/google-ads/campaign-sync');
const { campaignBuilderEnabled } = require('../../lib/google-ads/flags');
const cfg = require('../../lib/google-ads/config');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function safeError(msg) {
  const s = String(msg || 'sync_failed');
  if (/<!DOCTYPE|<html/i.test(s)) {
    return 'Google Ads API error (check developer token access level / API version)';
  }
  // Common test-token failure against production accounts
  if (/test.?account|developer.?token|PERMISSION_DENIED|AUTHORIZATION_ERROR/i.test(s)) {
    return s.slice(0, 220);
  }
  return s.slice(0, 240);
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };

  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });
  if (!cfg.configured()) return json(503, { error: 'not_configured' });
  if (!cfg.encryptionConfigured()) return json(503, { error: 'encryption_key_required' });

  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(400, { error: 'missing_siteId' });

    const days = Math.max(1, Math.min(90, parseInt(body.days, 10) || 30));

    const { data: conn } = await admin
      .from('google_ads_connections')
      .select('*')
      .eq('site_id', siteId)
      .maybeSingle();

    if (!conn || !conn.refresh_token) return json(404, { error: 'not_connected' });
    if (conn.enabled === false) return json(400, { error: 'connection_disabled' });
    if (conn.connection_status && conn.connection_status !== 'connected') {
      return json(400, { error: 'connection_not_active', status: conn.connection_status });
    }
    if (!conn.customer_id) {
      return json(400, {
        error: 'no_customer_selected',
        hint: 'Select a Google Ads account first, then sync.'
      });
    }

    const { data: site } = await admin
      .from('sites')
      .select('id, slug, business_name, config')
      .eq('id', siteId)
      .maybeSingle();
    if (!site) return json(404, { error: 'site_not_found' });

    let result;
    try {
      result = await syncSiteMetrics(admin, site, conn, {
        fromDay: daysAgo(days),
        toDay: daysAgo(0)
      });
    } catch (e) {
      const err = safeError(e && e.message);
      await admin.from('google_ads_connections').update({
        last_sync_error: err,
        updated_at: new Date().toISOString()
      }).eq('site_id', siteId);
      return json(502, {
        error: 'sync_failed',
        message: err,
        hint: /403|Test Access|Basic Access|DEVELOPER_TOKEN|production account|login-customer|AUTHORIZATION/i.test(err)
          ? 'OAuth is fine. Confirm Basic Access on the Leadpages MCC, set GOOGLE_ADS_LOGIN_CUSTOMER_ID to that MCC (digits only, e.g. 3862420047), link this Ads account under the MCC, redeploy Vercel, then Sync now.'
          : undefined
      });
    }

    let campaignMaps = null;
    if (campaignBuilderEnabled()) {
      try {
        campaignMaps = await syncCampaignMaps(admin, conn);
      } catch (e) {
        campaignMaps = { ok: false, error: (e && e.message) || 'campaign_map_sync_failed' };
      }
    }

    return json(200, {
      ok: true,
      siteId,
      customerId: conn.customer_id,
      days,
      from: result.from,
      to: result.to,
      rows: result.rows,
      unmatched: result.unmatched,
      apiVersion: cfg.apiVersion(),
      campaignMaps
    });
  } catch (e) {
    console.error('google-ads sync:', e && e.message);
    return json(500, { error: 'sync_failed' });
  }
};
