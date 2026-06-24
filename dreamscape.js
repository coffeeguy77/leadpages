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
// Retail (SELL) prices in AUD/yr — kept safely above live Dreamscape COST:
//   .au/.com.au/.net.au cost ~12.09 · .com 21.39 · .net 25.59 · .org 21.50
const PRICE_TABLE = {
  'com.au': 24.95, 'au': 24.95, 'net.au': 24.95, 'org.au': 24.95,
  'com': 34.95, 'net': 39.95, 'org': 34.95, 'co': 49.95, 'io': 89.95
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
const getCurrencies = () => call('GET', '/finances/currencies');
const listTlds    = () => call('GET', '/domains/tlds');
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
const addDnsRecord      = (id, b) => call('POST', `/domains/${id}/dns`, { body: b });
const listDnsRecords    = (id) => call('GET',  `/domains/${id}/dns`);
const registerDomainPrivacy = (b) => call('POST', '/products/domain-privacies', { body: b });

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
const envStatus = () => ({
  hasKey: !!RAW_KEY, keyLen: RAW_KEY.length,
  keyLooksValid: /^[a-z0-9]{32}$/.test(RAW_KEY),   // docs: 32 lowercase alphanumeric
  hasResellerId: !!RESELLER_ID, auth: 'signed (Api-Request-Id + Api-Signature)'
});

module.exports = {
  PRIORITY_TLDS, PRICE_TABLE, PRIVACY_PRICE, MIN_RESERVE, LOW_WARNING, BASE,
  call, priceFor, evaluateBalance, envStatus, readBalance,
  ping, getReseller, getBalance, getCurrencies, listTlds, checkAvailability, listDomainPrivacyProducts,
  createCustomer, getCustomer, listCustomers, createRegistrant, updateRegistrant, registerDomain, getDomain, renewDomain,
  addDnsRecord, listDnsRecords, registerDomainPrivacy, listDomains
};
