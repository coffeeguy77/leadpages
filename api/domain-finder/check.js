'use strict';

/**
 * GET /api/domain-finder/check?q=homeready
 * Direct domain check using Dreamscape (AU TLDs only).
 */

const { createClient } = require('@supabase/supabase-js');
const { isDomainFinderEnabled } = require('../../lib/brain/platform');
const { FINDER_TLDS, getConfig } = require('../../lib/domain-finder/config');
const { parseDomain, expandCandidates, toRoot } = require('../../lib/domain-finder/normalize');
const { checkDomains, freshCheck } = require('../../lib/domain-finder/availability');

const SUPABASE_URL = process.env.SUPABASE_URL;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
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

  const url = new URL(req.url, 'https://x');
  const q = (url.searchParams.get('q') || url.searchParams.get('domain') || '').trim();
  const fresh = url.searchParams.get('fresh') === '1';
  if (!q || q.length < 2) return json(res, 400, { ok: false, error: 'query_required' });

  const cfg = getConfig();
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
