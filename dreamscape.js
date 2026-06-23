// dreamscape.js — server-side client for the Dreamscape Reseller REST API.
// Runs ONLY inside Vercel serverless functions. The API key lives in an env var
// and is NEVER sent to the browser.
//
// Dreamscape uses a SINGLE API key (no secret). The exact auth HEADER style can
// vary, so set DREAMSCAPE_API_AUTH_SCHEME=auto (default) and the client probes
// GET /reseller with each known style once, caches the one that works, and uses it.
// Once /api/domains/diag tells you the winner, set the scheme explicitly to skip probing.

const BASE = (process.env.DREAMSCAPE_API_BASE_URL || 'https://reseller-api.ds.network').replace(/\/+$/, '');
const SCHEME = (process.env.DREAMSCAPE_API_AUTH_SCHEME || 'auto').toLowerCase();

const RAW_KEY    = process.env.DREAMSCAPE_API_TOKEN || process.env.DREAMSCAPE_API_KEY || '';
const RAW_SECRET = process.env.DREAMSCAPE_API_SECRET || '';
const RESELLER_ID = process.env.DREAMSCAPE_RESELLER_ID || '';

const MIN_RESERVE = Number(process.env.DREAMSCAPE_MINIMUM_RESERVE_BALANCE || 150);
const LOW_WARNING = Number(process.env.DREAMSCAPE_LOW_BALANCE_WARNING || 250);

const PRIORITY_TLDS = ['com.au', 'au', 'com', 'net.au', 'net', 'co'];
const PRICE_TABLE = {
  'com.au': 19.95, 'au': 14.95, 'com': 21.95, 'net.au': 19.95,
  'net': 24.95, 'co': 34.95, 'org': 24.95, 'org.au': 19.95, 'io': 69.95
};
const PRIVACY_PRICE = 9.95;

const b64 = s => Buffer.from(s).toString('base64');

// Each strategy returns the auth headers to add for the single API key.
const STRATEGIES = {
  'bearer':       () => ({ 'authorization': 'Bearer ' + RAW_KEY }),
  'x-api-key':    () => Object.assign({ 'x-api-key': RAW_KEY }, RAW_SECRET ? { 'x-api-secret': RAW_SECRET } : {}),
  'api-key':      () => ({ 'api-key': RAW_KEY }),
  'basic-id':     () => ({ 'authorization': 'Basic ' + b64(RESELLER_ID + ':' + RAW_KEY) }),
  'basic-secret': () => ({ 'authorization': 'Basic ' + b64(RAW_KEY + ':' + RAW_SECRET) }),
  'basic-key':    () => ({ 'authorization': 'Basic ' + b64(RAW_KEY + ':') }),
  'raw':          () => ({ 'authorization': RAW_KEY })
};
const PROBE_ORDER = ['bearer', 'x-api-key', 'api-key', 'basic-id', 'basic-secret', 'raw', 'basic-key'];
const EXPLICIT = { bearer: 'bearer', basic: 'basic-secret', apikey: 'x-api-key' };

let _resolved = null; // cached working strategy for this warm instance

function headersFor(strat) {
  const fn = STRATEGIES[strat];
  return Object.assign({ 'content-type': 'application/json', 'accept': 'application/json' }, fn ? fn() : {});
}

async function probe(strat) {
  try {
    const r = await fetch(BASE + '/reseller', { method: 'GET', headers: headersFor(strat) });
    return r.status;
  } catch (e) { return 0; }
}

// Probe every strategy (used by diag to report which work).
async function diagnoseAuth() {
  const out = {};
  for (const s of PROBE_ORDER) out[s] = await probe(s);
  return out;
}

async function resolveStrategy() {
  if (_resolved) return _resolved;
  if (SCHEME !== 'auto') { _resolved = EXPLICIT[SCHEME] || 'bearer'; return _resolved; }
  for (const s of PROBE_ORDER) {
    const st = await probe(s);
    if (st >= 200 && st < 300) { _resolved = s; return s; }
  }
  _resolved = 'bearer';
  return _resolved;
}

async function call(method, path, { query, body, timeoutMs = 15000 } = {}) {
  const strat = await resolveStrategy();
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetch(url.toString(), {
      method, headers: headersFor(strat),
      body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal
    });
    text = await res.text();
  } catch (e) { clearTimeout(t); return { ok: false, status: 0, error: String(e && e.message || e), data: null }; }
  clearTimeout(t);
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { _raw: text }; }
  return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data && (data.message || data.error)) || ('HTTP ' + res.status), _auth: strat };
}

// ---- read-only ----
const ping        = () => call('GET', '/ping');
const getReseller = () => call('GET', '/reseller');
const getBalance  = () => call('GET', '/finances/balance');
const getCurrencies = () => call('GET', '/finances/currencies');
const listTlds    = () => call('GET', '/domains/tlds');
const checkAvailability = (domain) => call('GET', '/domains/availability', { query: { domain } });
const listDomainPrivacyProducts = () => call('GET', '/products/domain-privacies');
// ---- write (Phase 2 only) ----
const createCustomer    = (b) => call('POST',  '/customers', { body: b });
const getCustomer       = (id) => call('GET',  `/customers/${id}`);
const createRegistrant  = (b) => call('POST',  '/domains/registrants', { body: b });
const updateRegistrant  = (id, b) => call('PATCH', `/domains/registrants/${id}`, { body: b });
const registerDomain    = (b) => call('POST',  '/domains', { body: b });
const getDomain         = (id) => call('GET',  `/domains/${id}`);
const renewDomain       = (id, b) => call('POST', `/domains/${id}/renewal`, { body: b });
const addDnsRecord      = (id, b) => call('POST', `/domains/${id}/dns`, { body: b });
const listDnsRecords    = (id) => call('GET',  `/domains/${id}/dns`);
const updateDnsRecord   = (id, rid, b) => call('PATCH', `/domains/${id}/dns/${rid}`, { body: b });
const deleteDnsRecord   = (id, rid) => call('DELETE', `/domains/${id}/dns/${rid}`);
const registerDomainPrivacy = (b) => call('POST', '/products/domain-privacies', { body: b });

function evaluateBalance(balanceNum, estimatedCost = 0) {
  const bal = Number(balanceNum);
  if (!isFinite(bal)) return { decision: 'unknown', reserve: MIN_RESERVE };
  const after = bal - Number(estimatedCost || 0);
  if (after < MIN_RESERVE) return { decision: 'block', reason: 'requires_admin_balance', balance: bal, after, reserve: MIN_RESERVE };
  if (bal < LOW_WARNING)   return { decision: 'warn', balance: bal, after, reserve: MIN_RESERVE, warning: LOW_WARNING };
  return { decision: 'ok', balance: bal, after, reserve: MIN_RESERVE };
}
const priceFor = tld => PRICE_TABLE[tld] != null ? PRICE_TABLE[tld] : 24.95;

module.exports = {
  PRIORITY_TLDS, PRICE_TABLE, PRIVACY_PRICE, MIN_RESERVE, LOW_WARNING, SCHEME, BASE,
  call, priceFor, evaluateBalance, diagnoseAuth, resolveStrategy,
  ping, getReseller, getBalance, getCurrencies, listTlds, checkAvailability, listDomainPrivacyProducts,
  createCustomer, getCustomer, createRegistrant, updateRegistrant, registerDomain, getDomain, renewDomain,
  addDnsRecord, listDnsRecords, updateDnsRecord, deleteDnsRecord, registerDomainPrivacy
};
