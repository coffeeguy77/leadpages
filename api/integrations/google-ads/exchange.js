// POST /api/integrations/google-ads/exchange
const { createClient } = require('@supabase/supabase-js');
const { parseState, exchangeCode } = require('../../../lib/google-ads/oauth');
const { listAccessibleCustomers, getCustomer, ensureAccessToken } = require('../../../lib/google-ads/client');
const { encryptSecret } = require('../../../lib/google-ads/token-crypto');
const { safeReturnPath } = require('../../../lib/app-url');
const cfg = require('../../../lib/google-ads/config');

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

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return json(405, { error: 'method' });

  try {
    const body = await readBody(req);
    const state = parseState(body.state);
    if (!state) return json(400, { error: 'invalid_or_expired_state' });
    if (!body.code) return json(400, { error: 'missing_code' });
    if (!state.userId) return json(400, { error: 'missing_user_in_state' });

    let siteId = state.siteId || null;
    let slug = state.slug || null;
    if (siteId) {
      const { data } = await admin.from('sites').select('id,slug').eq('id', siteId).maybeSingle();
      if (!data) return json(404, { error: 'site_not_found' });
      slug = data.slug;
    } else if (slug) {
      const { data } = await admin.from('sites').select('id,slug').eq('slug', slug).maybeSingle();
      if (!data) return json(404, { error: 'site_not_found' });
      siteId = data.id;
    } else {
      return json(400, { error: 'missing_site' });
    }

    // Token exchange MUST use the identical redirect_uri as authorize.
    const tok = await exchangeCode(body.code);
    if (!tok.refresh_token) {
      return json(400, { error: 'no_refresh_token', hint: 'Re-connect and approve offline access.' });
    }

    const exp = new Date(Date.now() + ((tok.expires_in || 3600) * 1000)).toISOString();
    const row = {
      site_id: siteId,
      slug,
      refresh_token: encryptSecret(tok.refresh_token),
      access_token: tok.access_token ? encryptSecret(tok.access_token) : null,
      token_expires_at: exp,
      enabled: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: prev } = await admin
      .from('google_ads_connections')
      .select('customer_id,account_name,event_roles,conversion_actions')
      .eq('site_id', siteId)
      .maybeSingle();
    if (prev) {
      row.customer_id = prev.customer_id;
      row.account_name = prev.account_name;
      if (prev.event_roles) row.event_roles = prev.event_roles;
      if (prev.conversion_actions) row.conversion_actions = prev.conversion_actions;
    }

    const { error } = await admin.from('google_ads_connections').upsert(row, { onConflict: 'site_id' });
    if (error) return json(500, { error: error.message });

    let accounts = [];
    try {
      const conn = Object.assign({}, row, {
        refresh_token: tok.refresh_token,
        access_token: tok.access_token || null
      });
      const access = await ensureAccessToken(admin, conn);
      const ids = await listAccessibleCustomers(access);
      for (let i = 0; i < Math.min(ids.length, 25); i++) {
        try {
          accounts.push(await getCustomer(access, ids[i], ids[i]));
        } catch (e) {
          accounts.push({ id: ids[i], name: ids[i] });
        }
      }
    } catch (e) {
      /* settings page can list accounts later */
    }

    return json(200, {
      ok: true,
      siteId,
      slug,
      userId: state.userId,
      returnPath: safeReturnPath(state.returnPath),
      redirectUriUsed: cfg.oauthRedirectUri(),
      accounts
    });
  } catch (e) {
    console.error('google-ads exchange:', e && e.message);
    return json(500, { error: (e && e.message) || 'exchange_failed' });
  }
};
