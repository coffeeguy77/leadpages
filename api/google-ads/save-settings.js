// POST /api/google-ads/save-settings — select account + event roles; provision conversion actions
const { createClient } = require('@supabase/supabase-js');
const { getCustomer, ensureAccessToken, digits } = require('../../lib/google-ads/client');
const { ensureConversionActions } = require('../../lib/google-ads/conversions');

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

    if (body.customerId) {
      const cid = digits(body.customerId);
      patch.customer_id = cid;
      try {
        const access = await ensureAccessToken(admin, conn);
        const info = await getCustomer(access, cid, body.loginCustomerId || cid);
        patch.account_name = info.name || cid;
        if (info.manager) patch.login_customer_id = cid;
        else if (body.loginCustomerId) patch.login_customer_id = digits(body.loginCustomerId);
      } catch (e) {
        patch.account_name = cid;
      }
    }

    if (body.eventRoles && typeof body.eventRoles === 'object') {
      const roles = Object.assign({}, conn.event_roles || {});
      ROLE_KEYS.forEach((k) => {
        const v = String(body.eventRoles[k] || '').toLowerCase();
        if (VALID_ROLES[v]) roles[k] = v;
      });
      patch.event_roles = roles;
    }

    if (body.tagId != null) patch.tag_id = String(body.tagId || '').trim() || null;

    const { error } = await admin.from('google_ads_connections').update(patch).eq('site_id', siteId);
    if (error) return json(500, { error: error.message });

    const { data: updated } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();

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
    eventRoles: c.event_roles,
    conversionActions: c.conversion_actions,
    tagId: c.tag_id,
    enabled: c.enabled,
    lastSyncAt: c.last_sync_at,
    lastSyncError: c.last_sync_error,
    formTestAt: c.form_test_at,
    callTestAt: c.call_test_at,
    connectedAt: c.connected_at
  };
}
