'use strict';

/**
 * GET  /api/domain-finder/check?q=homeready
 * POST /api/domain-finder/check  { candidates:[{name,root,category,reason}], tlds?:['com.au'], domains?:['x.com.au'] }
 * Dreamscape availability only — keep batches small to avoid 504.
 */

const { createClient } = require('@supabase/supabase-js');
const { isDomainFinderEnabled } = require('../../lib/brain/platform');
const { FINDER_TLDS, getConfig } = require('../../lib/domain-finder/config');
const { parseDomain, expandCandidates, toRoot, displayName } = require('../../lib/domain-finder/normalize');
const { checkDomains, freshCheck } = require('../../lib/domain-finder/availability');

const SUPABASE_URL = process.env.SUPABASE_URL;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch (_e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_e) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (_e) {
    return null;
  }
}

module.exports = async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!isDomainFinderEnabled()) return json(res, 404, { ok: false, error: 'disabled' });

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const cfg = getConfig();
  const url = new URL(req.url, 'https://x');
  const fresh = url.searchParams.get('fresh') === '1';

  if (req.method === 'POST') {
    const body = await readBody(req);
    const tlds = (Array.isArray(body.tlds) && body.tlds.length ? body.tlds : ['com.au'])
      .map(function (t) { return String(t).toLowerCase().replace(/^\./, ''); })
      .filter(function (t) { return FINDER_TLDS.indexOf(t) >= 0; });
    if (!tlds.length) tlds.push('com.au');

    let expanded = [];
    if (Array.isArray(body.domains) && body.domains.length) {
      body.domains.slice(0, 40).forEach(function (d) {
        const p = parseDomain(d);
        if (!p.hadTld || FINDER_TLDS.indexOf(p.tld) < 0) return;
        expanded.push({
          displayName: displayName(p.root),
          root: p.root,
          tld: p.tld,
          domain: p.domain,
          category: 'direct',
          reason: ''
        });
      });
    } else if (Array.isArray(body.candidates) && body.candidates.length) {
      expanded = expandCandidates(body.candidates.slice(0, 40), tlds, cfg);
    } else {
      return json(res, 400, { ok: false, error: 'candidates_or_domains_required' });
    }

    if (!expanded.length) return json(res, 200, { ok: true, available: [], results: [], checked: 0 });

    const check = await checkDomains(
      expanded.map(function (e) { return e.domain; }),
      cfg,
      { fresh: !!body.fresh || fresh }
    );

    const results = expanded.map(function (e) {
      const hit = check.byDomain[e.domain] || {};
      return {
        displayName: e.displayName,
        root: e.root,
        tld: e.tld,
        domain: e.domain,
        category: e.category,
        reason: e.reason,
        available: hit.available,
        price: hit.price,
        renew: hit.renew,
        premium: !!hit.premium,
        currency: hit.currency || 'AUD'
      };
    });
    const available = results.filter(function (r) { return r.available === true; });
    return json(res, 200, {
      ok: true,
      results: results,
      available: available,
      checked: check.checked || expanded.length,
      cached: check.cached || 0
    });
  }

  // GET — single-name helper
  const q = (url.searchParams.get('q') || url.searchParams.get('domain') || '').trim();
  if (!q || q.length < 2) return json(res, 400, { ok: false, error: 'query_required' });

  const parsed = parseDomain(q);
  if (!parsed.root) return json(res, 400, { ok: false, error: 'invalid_name' });

  if (parsed.hadTld) {
    if (FINDER_TLDS.indexOf(parsed.tld) < 0) {
      return json(res, 400, {
        ok: false,
        error: 'tld_not_supported',
        message: 'Domain Finder supports .com.au, .au and .net.au only.'
      });
    }
    const hit = fresh
      ? await freshCheck(parsed.domain, cfg)
      : (await checkDomains([parsed.domain], cfg)).byDomain[parsed.domain];
    return json(res, 200, {
      ok: true,
      query: q,
      root: parsed.root,
      results: [{
        domain: parsed.domain,
        tld: parsed.tld,
        available: hit && hit.available,
        price: hit && hit.price,
        premium: !!(hit && hit.premium),
        currency: 'AUD'
      }]
    });
  }

  const expanded = expandCandidates([{ name: q, root: toRoot(q), category: 'direct', reason: '' }], FINDER_TLDS, cfg);
  const check = await checkDomains(expanded.map(function (e) { return e.domain; }), cfg, { fresh: fresh });
  return json(res, 200, {
    ok: true,
    query: q,
    root: parsed.root,
    results: expanded.map(function (e) {
      const hit = check.byDomain[e.domain] || {};
      return {
        domain: e.domain,
        tld: e.tld,
        available: hit.available,
        price: hit.price,
        premium: !!hit.premium,
        currency: hit.currency || 'AUD'
      };
    })
  });
};
