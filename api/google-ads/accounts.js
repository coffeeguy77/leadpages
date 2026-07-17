// GET /api/google-ads/accounts?siteId= — list accessible Ads accounts for a connected site
const { createClient } = require('@supabase/supabase-js');
const cfg = require('../../lib/google-ads/config');
const { ensureAccessToken, listAccessibleCustomers, getCustomer } = require('../../lib/google-ads/client');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
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
    const { data: conn } = await admin.from('google_ads_connections').select('*').eq('site_id', siteId).maybeSingle();
    if (!conn) return json(404, { error: 'not_connected' });

    const access = await ensureAccessToken(admin, conn);
    const ids = await listAccessibleCustomers(access);
    const mcc = cfg.loginCustomerId() || conn.login_customer_id || '';
    const accounts = [];
    for (let i = 0; i < Math.min(ids.length, 40); i++) {
      try {
        // Prefer MCC login-customer-id when set (required for many client accounts).
        accounts.push(await getCustomer(access, ids[i], mcc || ids[i]));
      } catch (e) {
        try {
          accounts.push(await getCustomer(access, ids[i], ids[i]));
        } catch (e2) {
          accounts.push({ id: ids[i], name: ids[i] });
        }
      }
    }
    return json(200, {
      ok: true,
      selected: conn.customer_id || null,
      accountName: conn.account_name || null,
      apiVersion: cfg.apiVersion(),
      accounts
    });
  } catch (e) {
    const msg = String((e && e.message) || 'accounts_failed');
    const safe = /<!DOCTYPE|<html/i.test(msg)
      ? 'google_ads_api_error'
      : msg.slice(0, 240);
    return json(500, { error: safe });
  }
};
