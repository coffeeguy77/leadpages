const cfg = require('./config');
const { refreshAccessToken } = require('./oauth');
const { encryptSecret, prepareConnectionTokens } = require('./token-crypto');

function digits(id) {
  return String(id || '').replace(/\D+/g, '');
}

/**
 * Resolve login-customer-id for Ads API calls.
 * Prefer connection MCC, then platform env GOOGLE_ADS_LOGIN_CUSTOMER_ID,
 * then the operating customer id (direct accounts).
 * Never invent — empty string means omit header (adsFetch handles that).
 */
function resolveLoginCustomerId(conn, override) {
  const fromOverride = digits(override);
  if (fromOverride) return fromOverride;
  const fromConn = digits(conn && conn.login_customer_id);
  if (fromConn) return fromConn;
  const fromEnv = digits(cfg.loginCustomerId());
  if (fromEnv) return fromEnv;
  return digits(conn && conn.customer_id);
}

/**
 * Ensure connection row has a fresh access_token. Mutates/updates via admin client when provided.
 */
async function ensureAccessToken(admin, conn) {
  if (!conn) throw new Error('missing_connection');
  // Decrypt at-rest tokens when encryption key is configured.
  const live = prepareConnectionTokens(conn);
  if (!live.refresh_token) throw new Error('missing_refresh_token');
  const expires = live.token_expires_at ? new Date(live.token_expires_at).getTime() : 0;
  if (live.access_token && expires > Date.now() + 60_000) {
    conn.access_token = live.access_token;
    conn.refresh_token = live.refresh_token;
    return live.access_token;
  }

  const tok = await refreshAccessToken(live.refresh_token);
  const access = tok.access_token;
  const exp = new Date(Date.now() + ((tok.expires_in || 3600) * 1000)).toISOString();
  if (admin && conn.site_id) {
    await admin.from('google_ads_connections').update({
      access_token: encryptSecret(access),
      token_expires_at: exp,
      updated_at: new Date().toISOString()
    }).eq('site_id', conn.site_id);
  }
  conn.access_token = access;
  conn.refresh_token = live.refresh_token;
  conn.token_expires_at = exp;
  return access;
}

async function adsFetch(path, { method, accessToken, loginCustomerId, body } = {}) {
  const ver = cfg.apiVersion();
  const url = path.startsWith('http')
    ? path
    : `https://googleads.googleapis.com/${ver}/${path.replace(/^\//, '')}`;
  const headers = {
    Authorization: 'Bearer ' + accessToken,
    'developer-token': cfg.developerToken(),
    'Content-Type': 'application/json'
  };
  const login = digits(loginCustomerId); // caller should pass resolveLoginCustomerId(); empty omits header
  if (login) headers['login-customer-id'] = login;

  const r = await fetch(url, {
    method: method || (body ? 'POST' : 'GET'),
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text }; }
  if (!r.ok) {
    // Prefer Google Ads Failure details when present (e.g. DEVELOPER_TOKEN_NOT_APPROVED).
    let msg = '';
    const top = json && json.error;
    if (top) {
      const details = Array.isArray(top.details) ? top.details : [];
      for (let i = 0; i < details.length && !msg; i++) {
        const errs = details[i] && details[i].errors;
        if (Array.isArray(errs) && errs[0]) {
          const e0 = errs[0];
          const codeObj = e0.errorCode || e0.error_code || {};
          const codeKey = Object.keys(codeObj)[0];
          const codeVal = codeKey ? codeObj[codeKey] : '';
          msg = [codeVal, e0.message].filter(Boolean).join(': ');
        }
      }
      if (!msg) msg = top.message || top.status || '';
    }
    if (!msg || /<!DOCTYPE|<html/i.test(msg) || /<!DOCTYPE|<html/i.test(text || '')) {
      if (r.status === 403) {
        msg =
          'google_ads_api_http_403 — check developer token is Basic Access on the Leadpages MCC, ' +
          'GOOGLE_ADS_LOGIN_CUSTOMER_ID is that MCC (digits only), the Ads account is linked under the MCC, ' +
          'and Vercel was redeployed after env changes';
      } else if (r.status === 404) {
        msg = 'google_ads_api_http_404 (API version may be sunset — set GOOGLE_ADS_API_VERSION, default v22)';
      } else {
        msg = 'google_ads_api_http_' + r.status;
      }
    }
    // Surface common auth codes clearly (Basic Access ≠ MCC linkage).
    if (/DEVELOPER_TOKEN_NOT_APPROVED/i.test(msg)) {
      msg =
        'DEVELOPER_TOKEN_NOT_APPROVED — developer token is still Test Access. Approve Basic Access on the MCC that owns the token, then redeploy.';
    } else if (/CUSTOMER_NOT_ENABLED|USER_PERMISSION_DENIED|AUTHORIZATION_ERROR/i.test(msg) && r.status === 403) {
      msg =
        String(msg).slice(0, 180) +
        ' — usually missing login-customer-id (set GOOGLE_ADS_LOGIN_CUSTOMER_ID to your MCC) or the OAuth user cannot access this Ads account.';
    }
    const err = new Error(String(msg).slice(0, 280));
    err.status = r.status;
    err.details = (json && json.error) ? { error: json.error } : { status: r.status };
    throw err;
  }
  return json;
}

async function searchStream(accessToken, customerId, query, loginCustomerId) {
  const cid = digits(customerId);
  const json = await adsFetch(`customers/${cid}/googleAds:searchStream`, {
    method: 'POST',
    accessToken,
    loginCustomerId,
    body: { query }
  });
  // searchStream returns an array of result batches
  const rows = [];
  const batches = Array.isArray(json) ? json : [json];
  batches.forEach((batch) => {
    (batch.results || []).forEach((row) => rows.push(row));
  });
  return rows;
}

async function listAccessibleCustomers(accessToken) {
  const json = await adsFetch('customers:listAccessibleCustomers', {
    method: 'GET',
    accessToken
  });
  return (json.resourceNames || []).map((rn) => digits(rn.replace('customers/', '')));
}

async function getCustomer(accessToken, customerId, loginCustomerId) {
  const cid = digits(customerId);
  const rows = await searchStream(
    accessToken,
    cid,
    'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1',
    loginCustomerId || cid
  );
  const c = rows[0] && rows[0].customer;
  if (!c) return { id: cid, name: cid };
  return {
    id: digits(c.id),
    name: c.descriptiveName || c.descriptive_name || cid,
    currency: c.currencyCode || c.currency_code || null,
    manager: !!(c.manager)
  };
}

module.exports = {
  digits,
  resolveLoginCustomerId,
  ensureAccessToken,
  adsFetch,
  searchStream,
  listAccessibleCustomers,
  getCustomer
};
