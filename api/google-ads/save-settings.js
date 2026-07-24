// POST /api/google-ads/save-settings — select account + event roles; provision conversion actions
const { createClient } = require('@supabase/supabase-js');
const { getCustomer, ensureAccessToken, digits } = require('../../lib/google-ads/client');
const { ensureConversionActions } = require('../../lib/google-ads/conversions');
const { normalizeAdsTagId, ensureConnectionTagId } = require('../../lib/google-ads/tag-id');
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

const ROLE_KEYS = ['form_submission', 'call_click', 'email_click', 'directions_click', 'quote_click', 'cta_click'];
const VALID_ROLES = { primary: 1, secondary: 1, off: 1 };

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(400, { error: 'missing_siteId' });

    const { data: conn } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
    if (!conn) return json(404, { error: 'not_connected' });

    const patch = { updated_at: new Date().toISOString(), enabled: true };
    let previousCustomerToClear = null;

    if (body.customerId) {
      const cid = digits(body.customerId);
      const prevCustomer = digits(conn.customer_id);
      patch.customer_id = cid;
      // MCC login-customer-id: body override → env platform MCC → existing connection.
      const mccLogin = digits(body.loginCustomerId || cfg.loginCustomerId() || conn.login_customer_id || '');
      try {
        const access = await ensureAccessToken(admin, conn);
        const info = await getCustomer(access, cid, mccLogin || cid);
        patch.account_name = info.name || cid;
        if (info.manager) {
          patch.login_customer_id = cid;
        } else if (mccLogin && mccLogin !== cid) {
          patch.login_customer_id = mccLogin;
        } else if (body.loginCustomerId) {
          patch.login_customer_id = digits(body.loginCustomerId);
        }
      } catch (e) {
        patch.account_name = cid;
        if (mccLogin && mccLogin !== cid) patch.login_customer_id = mccLogin;
      }
      // Stale unmatched URLs / metrics from a previous Ads customer must not linger.
      if (prevCustomer && prevCustomer !== cid) previousCustomerToClear = prevCustomer;
    }

    if (body.eventRoles && typeof body.eventRoles === 'object') {
      const roles = Object.assign({}, conn.event_roles || {});
      ROLE_KEYS.forEach((k) => {
        const v = String(body.eventRoles[k] || '').toLowerCase();
        if (VALID_ROLES[v]) roles[k] = v;
      });
      patch.event_roles = roles;
    }

    if (body.tagId != null) {
      patch.tag_id = normalizeAdsTagId(body.tagId) || null;
    }

    if (body.confirmAdsGa4Link === true) {
      patch.ads_ga4_link_confirmed_at = new Date().toISOString();
      // confirmed_by is best-effort; auth user id available via JWT decode is not here — leave null or set if header user known
    }
    if (body.clearAdsGa4LinkConfirm === true) {
      patch.ads_ga4_link_confirmed_at = null;
      patch.ads_ga4_link_confirmed_by = null;
    }
    // Switching Ads customer invalidates the previous GA4 link acknowledgement.
    if (previousCustomerToClear) {
      patch.ads_ga4_link_confirmed_at = null;
      patch.ads_ga4_link_confirmed_by = null;
    }

    const { error } = await admin.from('google_ads_connections').update(patch).eq('site_id', siteId);
    if (error) {
      // Column may not exist until db/google_ads_ga4_link_confirm.sql is applied.
      if (/ads_ga4_link_confirmed/i.test(String(error.message || '')) && (body.confirmAdsGa4Link || body.clearAdsGa4LinkConfirm)) {
        return json(500, {
          error: 'schema_pending',
          message: 'Run db/google_ads_ga4_link_confirm.sql in Supabase, then try again.'
        });
      }
      return json(500, { error: error.message });
    }

    if (previousCustomerToClear || body.clearUnmatched === true) {
      try {
        await admin.from('ads_unmatched_urls').delete().eq('site_id', siteId);
      } catch (_e) {
        /* table may not exist */
      }
    }
    if (previousCustomerToClear) {
      try {
        await admin.from('ads_metrics_daily').delete().eq('site_id', siteId).eq('customer_id', previousCustomerToClear);
      } catch (_e) {}
      try {
        await admin.from('ads_campaign_maps').delete().eq('site_id', siteId).eq('customer_id', previousCustomerToClear);
      } catch (_e) {}
      try {
        await admin.from('ads_keyword_daily').delete().eq('site_id', siteId).eq('customer_id', previousCustomerToClear);
      } catch (_e) {}
    }

    let { data: updated } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();

    if (body.detectTag === true && updated && updated.customer_id) {
      try {
        const access = await ensureAccessToken(admin, updated);
        await ensureConnectionTagId(admin, updated, access, { force: !!body.forceTagDetect });
        const again = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
        updated = again.data || updated;
      } catch (_e) {
        /* non-fatal */
      }
    }

    // After selecting a customer, try once to fill AW- tag if still empty.
    if (body.customerId && updated && updated.customer_id && !updated.tag_id) {
      try {
        const access = await ensureAccessToken(admin, updated);
        await ensureConnectionTagId(admin, updated, access);
        const again = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
        updated = again.data || updated;
      } catch (_e) {
        /* non-fatal */
      }
    }

    let conversion_actions = updated.conversion_actions || {};
    if (updated.customer_id) {
      try {
        conversion_actions = await ensureConversionActions(admin, updated);
      } catch (e) {
        return json(200, {
          ok: true,
          warning: 'account_saved_but_conversion_setup_failed',
          detail: e && e.message,
          connection: publicConn(updated)
        });
      }
    }

    return json(200, {
      ok: true,
      connection: publicConn(Object.assign({}, updated, { conversion_actions }))
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || 'save_failed' });
  }
};

function publicConn(c) {
  if (!c) return null;
  return {
    siteId: c.site_id,
    slug: c.slug,
    customerId: c.customer_id,
    accountName: c.account_name,
    managerCustomerId: c.login_customer_id || null,
    eventRoles: c.event_roles,
    conversionActions: c.conversion_actions,
    tagId: c.tag_id,
    tagActive: !!c.tag_id,
    adsGa4LinkConfirmed: !!c.ads_ga4_link_confirmed_at,
    adsGa4LinkConfirmedAt: c.ads_ga4_link_confirmed_at || null,
    enabled: c.enabled,
    lastSyncAt: c.last_sync_at,
    lastSyncError: c.last_sync_error,
    formTestAt: c.form_test_at,
    callTestAt: c.call_test_at,
    connectedAt: c.connected_at
  };
}
