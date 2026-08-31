'use strict';

/**
 * Domain Finder availability — Dreamscape batch checks + optional cache table.
 */

let _ds = null;
function dreamscape() {
  if (!_ds) _ds = require('../../dreamscape');
  return _ds;
}

let _createClient = null;
function createClient() {
  if (!_createClient) {
    _createClient = require('@supabase/supabase-js').createClient;
  }
  return _createClient.apply(null, arguments);
}

let _sb = null;
function admin() {
  if (_sb) return _sb;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (_e) {
    return null;
  }
  return _sb;
}

function readEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const domain = String(e.domain_name || e.domain || e.name || '').toLowerCase();
  let available = null;
  if (typeof e.available === 'boolean') available = e.available;
  else if (typeof e.is_available === 'boolean') available = e.is_available;
  else if (typeof e.availability === 'boolean') available = e.availability;
  else {
    const s = String(e.status || e.availability || '').toLowerCase();
    if (s.includes('avail')) available = true;
    else if (s.includes('taken') || s.includes('registered') || s.includes('unavail')) available = false;
  }
  const toNum = function (v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const reg = toNum(e.register_price != null ? e.register_price : (e.price && e.price.register));
  const ren = toNum(e.renew_price != null ? e.renew_price : (e.price && e.price.renew));
  const premium = !!(e.premium || e.is_premium || (e.price && e.price.premium));
  return { domain: domain, available: available, register: reg, renew: ren, premium: premium };
}

async function loadRetailMap() {
  const sb = admin();
  if (!sb) return {};
  try {
    const r = await sb.from('domain_pricing').select('tld, retail');
    const m = {};
    (r.data || []).forEach(function (row) {
      if (!row || row.tld == null) return;
      const v = Number(row.retail);
      if (Number.isFinite(v) && v > 0) m[String(row.tld).toLowerCase()] = v;
    });
    return m;
  } catch (_e) {
    return {};
  }
}

async function readCache(domains, cfg) {
  const sb = admin();
  if (!sb || !domains || !domains.length) return {};
  try {
    const { data, error } = await sb
      .from('domain_finder_availability_cache')
      .select('full_domain,status,price,currency,premium,checked_at')
      .in('full_domain', domains);
    if (error || !data) return {};
    const now = Date.now();
    const out = {};
    data.forEach(function (row) {
      const at = row.checked_at ? new Date(row.checked_at).getTime() : 0;
      const age = now - at;
      const ttl = row.status === 'available' ? cfg.cacheAvailableMs : cfg.cacheUnavailableMs;
      if (age > ttl) return;
      out[row.full_domain] = {
        available: row.status === 'available',
        price: row.price != null ? Number(row.price) : null,
        currency: row.currency || 'AUD',
        premium: !!row.premium,
        fromCache: true
      };
    });
    return out;
  } catch (_e) {
    return {};
  }
}

async function writeCache(rows) {
  const sb = admin();
  if (!sb || !rows || !rows.length) return;
  try {
    const payload = rows.map(function (r) {
      return {
        full_domain: r.domain,
        tld: r.tld || (String(r.domain).split('.').slice(1).join('.')),
        status: r.available === true ? 'available' : (r.available === false ? 'unavailable' : 'unknown'),
        price: r.price,
        currency: r.currency || 'AUD',
        premium: !!r.premium,
        checked_at: new Date().toISOString()
      };
    });
    await sb.from('domain_finder_availability_cache').upsert(payload, { onConflict: 'full_domain' });
  } catch (_e) {
    /* cache is best-effort */
  }
}

/**
 * Batch-check domains via Dreamscape. Returns map domain → result.
 * @param {string[]} domains
 * @param {object} cfg from getConfig()
 * @param {{ fresh?: boolean }} [opts]
 */
async function checkDomains(domains, cfg, opts) {
  opts = opts || {};
  const unique = [];
  const seen = new Set();
  (domains || []).forEach(function (d) {
    const x = String(d || '').toLowerCase().trim();
    if (!x || seen.has(x)) return;
    seen.add(x);
    unique.push(x);
  });

  const byDomain = {};
  let toCheck = unique.slice();

  if (!opts.fresh) {
    const cached = await readCache(unique, cfg);
    Object.keys(cached).forEach(function (d) {
      byDomain[d] = cached[d];
    });
    toCheck = unique.filter(function (d) { return !byDomain[d]; });
  }

  const retailMap = await loadRetailMap();
  const batchSize = cfg.availabilityBatchSize || 40;
  const writeRows = [];

  for (let i = 0; i < toCheck.length; i += batchSize) {
    const batch = toCheck.slice(i, i + batchSize);
    const ds = dreamscape();
    const r = await ds.checkAvailability(batch);
    if (!r.ok) {
      batch.forEach(function (d) {
        if (!byDomain[d]) byDomain[d] = { available: null, price: null, error: r.error || 'availability_failed' };
      });
      continue;
    }
    const list = r.data && Array.isArray(r.data.data) ? r.data.data : [];
    const found = {};
    list.forEach(function (e) {
      const m = readEntry(e);
      if (!m || !m.domain) return;
      found[m.domain] = m;
    });
    batch.forEach(function (d) {
      const m = found[d] || null;
      const tld = d.split('.').slice(1).join('.');
      const dsReg = m && m.register != null ? m.register : null;
      const price = retailMap[tld] != null
        ? retailMap[tld]
        : (typeof ds.resolveSell === 'function' ? ds.resolveSell(tld, dsReg) : (ds.PRICE_TABLE && ds.PRICE_TABLE[tld]) || null);
      const row = {
        available: m ? m.available : null,
        price: price,
        renew: m && m.renew != null ? m.renew : null,
        premium: !!(m && m.premium),
        currency: 'AUD',
        tld: tld,
        fromCache: false
      };
      byDomain[d] = row;
      if (row.available === true || row.available === false) {
        writeRows.push(Object.assign({ domain: d }, row));
      }
    });
  }

  await writeCache(writeRows);
  return { ok: true, byDomain: byDomain, checked: toCheck.length, cached: unique.length - toCheck.length };
}

/**
 * Fresh single-domain check before registration handoff.
 */
async function freshCheck(domain, cfg) {
  const r = await checkDomains([domain], cfg, { fresh: true });
  return r.byDomain[String(domain).toLowerCase()] || { available: null };
}

module.exports = {
  checkDomains,
  freshCheck,
  readEntry,
  loadRetailMap
};
