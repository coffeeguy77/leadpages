const cfg = require('./config');
const { refreshAccessToken } = require('./oauth');

function digits(id) {
  return String(id || '').replace(/\D+/g, '');
}

/**
 * Ensure connection row has a fresh access_token. Mutates/updates via admin client when provided.
 */
async function ensureAccessToken(admin, conn) {
  if (!conn || !conn.refresh_token) throw new Error('missing_refresh_token');
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token && expires > Date.now() + 60_000) return conn.access_token;

  const tok = await refreshAccessToken(conn.refresh_token);
  const access = tok.access_token;
  const exp = new Date(Date.now() + ((tok.expires_in || 3600) * 1000)).toISOString();
  if (admin && conn.site_id) {
    await admin.from('google_ads_connections').update({
      access_token: access,
      token_expires_at: exp,
      updated_at: new Date().toISOString()
    }).eq('site_id', conn.site_id);
  }
  conn.access_token = access;
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
  const login = digits(loginCustomerId || cfg.loginCustomerId());
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
    const msg = (json.error && (json.error.message || json.error.status)) || text.slice(0, 300) || ('http_' + r.status);
    const err = new Error(msg);
    err.status = r.status;
    err.details = json;
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
  ensureAccessToken,
  adsFetch,
  searchStream,
  listAccessibleCustomers,
  getCustomer
};
