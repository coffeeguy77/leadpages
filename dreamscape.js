// dreamscape.js — server-side client for the Dreamscape Reseller REST API.
// Runs ONLY inside Vercel functions. The API key lives in an env var, never in the browser.
//
// Auth = REQUEST SIGNING (per the official docs):
//   request_id = md5(unique)              -> header  Api-Request-Id
//   signature  = md5(request_id + apiKey) -> header  Api-Signature
// A fresh request_id + signature is generated for every request.

const crypto = require('crypto');

const BASE = (process.env.DREAMSCAPE_API_BASE_URL || 'https://reseller-api.ds.network').replace(/\/+$/, '');
const RAW_KEY = (process.env.DREAMSCAPE_API_TOKEN || process.env.DREAMSCAPE_API_KEY || '').trim();
const RESELLER_ID = process.env.DREAMSCAPE_RESELLER_ID || '';

const MIN_RESERVE = Number(process.env.DREAMSCAPE_MINIMUM_RESERVE_BALANCE || 150);
const LOW_WARNING = Number(process.env.DREAMSCAPE_LOW_BALANCE_WARNING || 250);

const PRIORITY_TLDS = ['com.au', 'au', 'com', 'net.au', 'net', 'co'];
// Retail (SELL) prices in AUD/yr. These mirror YOUR Dreamscape reseller retail
// pricing (Finances → Pricing → Domains) — the availability API only returns your
// wholesale COST, so retail has to live here (or in the editable pricing table).
// Confirmed from your console: all .au = $70 (cost ~$12.09); .sydney/.melbourne
// = $385; .nz = $35.09; most .nz = $31.99; .kiwi = $42.89.
const PRICE_TABLE = {
  'com.au': 70, 'au': 70, 'net.au': 70, 'org.au': 70, 'id.au': 70, 'asn.au': 70,
  'sydney': 385, 'melbourne': 385,
  'nz': 35.09, 'co.nz': 31.99, 'net.nz': 31.99, 'org.nz': 31.99, 'ac.nz': 31.99,
  'gen.nz': 31.99, 'geek.nz': 31.99, 'maori.nz': 31.99, 'school.nz': 31.99,
  'kiwi': 42.89, 'kiwi.nz': 31.99,
  // Not on the AU/NZ pricing screen you sent — sensible retail, confirm/adjust:
  'com': 34.95, 'net': 39.95, 'org': 34.95, 'co': 49.95, 'io': 89.95, 'app': 34.95
};
const PRIVACY_PRICE = 9.95;

const md5 = s => crypto.createHash('md5').update(String(s)).digest('hex');

function signedHeaders(hasBody) {
  const requestId = md5(Date.now() + '-' + crypto.randomBytes(12).toString('hex'));
  const signature = md5(requestId + RAW_KEY);
  const h = { 'accept': 'application/json', 'api-request-id': requestId, 'api-signature': signature };
  if (hasBody) h['content-type'] = 'application/json';
  return h;
}

// Build a query string. Array values repeat the key (e.g. domain_names[]=a&domain_names[]=b),
// keeping the [] bracket key literal as Dreamscape's examples show.
function buildQuery(query) {
  const parts = [];
  for (const [k, v] of Object.entries(query || {})) {
    if (Array.isArray(v)) { for (const item of v) if (item != null && item !== '') parts.push(k + '=' + encodeURIComponent(item)); }
    else if (v != null && v !== '') parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function call(method, path, { query, body, timeoutMs = 15000 } = {}) {
  const url = BASE + path + buildQuery(query);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetch(url, { method, headers: signedHeaders(!!body), body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    text = await res.text();
  } catch (e) { clearTimeout(t); return { ok: false, status: 0, error: String(e && e.message || e), data: null }; }
  clearTimeout(t);
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { _raw: text }; }
  const error = res.ok ? null : (data && (data.error_message || data.message)) || ('HTTP ' + res.status);
  return { ok: res.ok, status: res.status, data, error };
}

// ---- read-only ----
const ping        = () => call('GET', '/ping');
const getReseller = () => call('GET', '/reseller');
const getBalance  = () => call('GET', '/finances/balance');
const getInvoices = (query) => call('GET', '/finances/invoices', { query });
const getCurrencies = () => call('GET', '/finances/currencies');
const listTlds    = (query) => call('GET', '/domains/tlds', { query });
const checkAvailability = (domains) =>
  call('GET', '/domains/availability', { query: { 'domain_names[]': Array.isArray(domains) ? domains : [domains] } });
const listDomainPrivacyProducts = () => call('GET', '/products/domain-privacies');
// ---- write (Phase 2) ----
const createCustomer    = (b) => call('POST',  '/customers', { body: b });
const getCustomer       = (id) => call('GET',  `/customers/${id}`);
const listCustomers     = (query) => call('GET', '/customers', { query });
const createRegistrant  = (b) => call('POST',  '/domains/registrants', { body: b });
const updateRegistrant  = (id, b) => call('PATCH', `/domains/registrants/${id}`, { body: b });
const registerDomain    = (b) => call('POST',  '/domains', { body: b });
const getDomain         = (id) => call('GET',  `/domains/${id}`);
const listDomains       = (query) => call('GET', '/domains', { query });
const renewDomain       = (id, b) => call('POST', `/domains/${id}/renewal`, { body: b });
const patchDomain       = (id, b) => call('PATCH', `/domains/${id}`, { body: b }); // name_servers, is_locked, privacy, contacts
const deleteDomain      = (id) => call('DELETE', `/domains/${id}`);
const registerDomainPrivacy = (b) => call('POST', '/products/domain-privacies', { body: b });

// ---- Domain-level DNS (the basic DNS that comes with the domain) ----
// Records live at /domains/{domain_id}/dns and support A, AAAA, TXT, CNAME, MX,
// CAA, SRV, WEBFWD (URL forwarding) and MAILFWD (email forwarding to an external
// address). This is the primary DNS surface for a registered domain on Dreamscape
// nameservers. (Premium "DNS Hosting" below is a paid upsell with the same record API.)
const listDomainDns      = (id, type) => call('GET', `/domains/${id}/dns`, { query: type ? { type } : undefined });
const getDomainDns       = (id, rid) => call('GET', `/domains/${id}/dns/${rid}`);
const addDomainDns       = (id, b) => call('POST', `/domains/${id}/dns`, { body: b });
const updateDomainDns    = (id, rid, b) => call('PATCH', `/domains/${id}/dns/${rid}`, { body: b });
const deleteDomainDns    = (id, rid) => call('DELETE', `/domains/${id}/dns/${rid}`);

// ---- Domain hosts / glue records (only needed for custom child nameservers) ----
const listHosts          = (id) => call('GET', `/domains/${id}/hosts`);
const addHost            = (id, b) => call('POST', `/domains/${id}/hosts`, { body: b });
const getHost            = (id, host) => call('GET', `/domains/${id}/hosts/${encodeURIComponent(host)}`);
const updateHost         = (id, host, b) => call('PATCH', `/domains/${id}/hosts/${encodeURIComponent(host)}`, { body: b });
const deleteHost         = (id, host) => call('DELETE', `/domains/${id}/hosts/${encodeURIComponent(host)}`);

// ---- Product catalogue: types, plans, plan features (for discovering plan_ids + cost) ----
// /products/plans returns periods[].price.{wholesale (reseller COST), register, renew}.
const listProductTypes   = (query) => call('GET', '/products/types', { query });
const listPlans          = (query) => call('GET', '/products/plans', { query }); // filter by type_id
const getPlan            = (id) => call('GET', `/products/plans/${id}`);
const getPlanFeatures    = (id, types) => call('GET', `/products/plans/${id}/features`, { query: types ? { 'types[]': types } : undefined });

// ---- DNS Hosting product (paid "Premium DNS" upsell; same record API as domain DNS) ----
const registerDnsHosting = (b) => call('POST', '/products/dns-hostings', { body: b });           // {customer_id,domain_name,plan_id,period}
const listDnsHostings    = (query) => call('GET', '/products/dns-hostings', { query });           // filter by domain_name / customer_id
const getDnsHosting      = (pid) => call('GET', `/products/dns-hostings/${pid}`);
const getDnsConfig       = (pid) => call('GET', `/products/dns-hostings/${pid}/configuration`);    // available_record_types, name_servers, mx_priorities...
const renewDnsHosting    = (pid, b) => call('POST', `/products/dns-hostings/${pid}/renewal`, { body: b });
const deleteDnsHosting   = (pid) => call('DELETE', `/products/dns-hostings/${pid}`);
const listDnsRecords     = (pid, type) => call('GET', `/products/dns-hostings/${pid}/dns`, { query: type ? { type } : undefined });
const getDnsRecord       = (pid, rid) => call('GET', `/products/dns-hostings/${pid}/dns/${rid}`);
const addDnsRecord       = (pid, b) => call('POST', `/products/dns-hostings/${pid}/dns`, { body: b });
const updateDnsRecord    = (pid, rid, b) => call('PATCH', `/products/dns-hostings/${pid}/dns/${rid}`, { body: b });
const deleteDnsRecord    = (pid, rid) => call('DELETE', `/products/dns-hostings/${pid}/dns/${rid}`);

// ---- Email Hosting product (real mailboxes; managed via login-link panel) ----
const registerEmailHosting = (b) => call('POST', '/products/email-hostings', { body: b });        // {customer_id,domain_name,plan_id,period}
const listEmailHostings    = (query) => call('GET', '/products/email-hostings', { query });
const getEmailHosting      = (pid) => call('GET', `/products/email-hostings/${pid}`);
const emailHostingLogin    = (pid, b) => call('POST', `/products/email-hostings/${pid}/login-link`, { body: b || {} });
const renewEmailHosting    = (pid, b) => call('POST', `/products/email-hostings/${pid}/renewal`, { body: b });
const deleteEmailHosting   = (pid) => call('DELETE', `/products/email-hostings/${pid}`);

// ---- Email Exchange product (hosted Exchange-style mailboxes) ----
const registerEmailExchange = (b) => call('POST', '/products/email-exchanges', { body: b });
const listEmailExchanges    = (query) => call('GET', '/products/email-exchanges', { query });
const getEmailExchange      = (pid) => call('GET', `/products/email-exchanges/${pid}`);
const emailExchangeLogin    = (pid, b) => call('POST', `/products/email-exchanges/${pid}/login-link`, { body: b || {} });
const renewEmailExchange    = (pid, b) => call('POST', `/products/email-exchanges/${pid}/renewal`, { body: b });
const deleteEmailExchange   = (pid) => call('DELETE', `/products/email-exchanges/${pid}`);

// pull the balance number out of { status, data:{ balance, currency } }
function readBalance(resp) {
  const d = resp && resp.data && resp.data.data;
  if (d && d.balance != null) return { balance: Number(d.balance), currency: d.currency || 'AUD' };
  return null;
}

function evaluateBalance(balanceNum, estimatedCost = 0) {
  const bal = Number(balanceNum);
  if (!isFinite(bal)) return { decision: 'unknown', reserve: MIN_RESERVE };
  const after = bal - Number(estimatedCost || 0);
  if (after < MIN_RESERVE) return { decision: 'block', reason: 'requires_admin_balance', balance: bal, after, reserve: MIN_RESERVE };
  if (bal < LOW_WARNING)   return { decision: 'warn', balance: bal, after, reserve: MIN_RESERVE, warning: LOW_WARNING };
  return { decision: 'ok', balance: bal, after, reserve: MIN_RESERVE };
}
const priceFor = tld => PRICE_TABLE[tld] != null ? PRICE_TABLE[tld] : 49.95;

// Resolve the retail price to CHARGE/SHOW for a domain. One source of truth used
// by both availability.js (display) and checkout.js (charge), so they never drift.
//   DOMAIN_PRICE_SOURCE = 'table' (default)  -> use the PRICE_TABLE retail above
//                                                (your Dreamscape console retail)
//                       = 'dreamscape'        -> use the API register_price as-is
//                                                (only if that ever returns RETAIL,
//                                                 not wholesale — it currently does NOT)
//                       = 'markup'            -> register_price * DOMAIN_PRICE_MARKUP
//   DOMAIN_PRICE_MARKUP = multiplier for 'markup' mode (default 2)
// In every mode we fall back to PRICE_TABLE so a price is never shown as $0.
const DOMAIN_PRICE_SOURCE = String(process.env.DOMAIN_PRICE_SOURCE || 'table').toLowerCase();
const DOMAIN_PRICE_MARKUP = Number(process.env.DOMAIN_PRICE_MARKUP || 2);
function resolveSell(tld, dsPrice) {
  const p = Number(dsPrice);
  const have = isFinite(p) && p > 0;
  if (DOMAIN_PRICE_SOURCE === 'dreamscape') return have ? p : priceFor(tld);
  if (DOMAIN_PRICE_SOURCE === 'markup') return have ? (Math.ceil(p * DOMAIN_PRICE_MARKUP) - 0.05) : priceFor(tld);
  return priceFor(tld); // 'table' (default)
}
const envStatus = () => ({
  hasKey: !!RAW_KEY, keyLen: RAW_KEY.length,
  keyLooksValid: /^[a-z0-9]{32}$/.test(RAW_KEY),   // docs: 32 lowercase alphanumeric
  hasResellerId: !!RESELLER_ID, auth: 'signed (Api-Request-Id + Api-Signature)'
});

module.exports = {
  PRIORITY_TLDS, PRICE_TABLE, PRIVACY_PRICE, MIN_RESERVE, LOW_WARNING, BASE,
  call, priceFor, resolveSell, DOMAIN_PRICE_SOURCE, evaluateBalance, envStatus, readBalance,
  ping, getReseller, getBalance, getInvoices, getCurrencies, listTlds, checkAvailability, listDomainPrivacyProducts,
  createCustomer, getCustomer, listCustomers, createRegistrant, updateRegistrant,
  registerDomain, getDomain, listDomains, renewDomain, patchDomain, deleteDomain, registerDomainPrivacy,
  // Domain-level DNS (basic) + hosts
  listDomainDns, getDomainDns, addDomainDns, updateDomainDns, deleteDomainDns,
  listHosts, addHost, getHost, updateHost, deleteHost,
  // Product catalogue
  listProductTypes, listPlans, getPlan, getPlanFeatures,
  // DNS Hosting (Premium DNS) + records
  registerDnsHosting, listDnsHostings, getDnsHosting, getDnsConfig, renewDnsHosting, deleteDnsHosting,
  listDnsRecords, getDnsRecord, addDnsRecord, updateDnsRecord, deleteDnsRecord,
  // Email Hosting
  registerEmailHosting, listEmailHostings, getEmailHosting, emailHostingLogin, renewEmailHosting, deleteEmailHosting,
  // Email Exchange
  registerEmailExchange, listEmailExchanges, getEmailExchange, emailExchangeLogin, renewEmailExchange, deleteEmailExchange
};
