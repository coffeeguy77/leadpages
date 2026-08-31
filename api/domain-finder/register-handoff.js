'use strict';

/**
 * POST /api/domain-finder/register-handoff
 * Fresh availability check, then hand off to existing /domains purchase UI.
 * Body: { domain }
 * Returns: { ok, available, domain, price, registerUrl } or snapped-up alternatives hint.
 */

const { createClient } = require('@supabase/supabase-js');
const { isDomainFinderEnabled } = require('../../lib/brain/platform');
const { getConfig, FINDER_TLDS } = require('../../lib/domain-finder/config');
const { parseDomain } = require('../../lib/domain-finder/normalize');
const { freshCheck } = require('../../lib/domain-finder/availability');

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
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!isDomainFinderEnabled()) return json(res, 404, { ok: false, error: 'disabled' });

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const body = await readBody(req);
  const domain = String(body.domain || '').trim().toLowerCase();
  const parsed = parseDomain(domain);
  if (!parsed.hadTld || !parsed.domain) {
    return json(res, 400, { ok: false, error: 'domain_required' });
  }
  if (FINDER_TLDS.indexOf(parsed.tld) < 0) {
    return json(res, 400, {
      ok: false,
      error: 'tld_not_supported',
      message: 'Only .com.au, .au and .net.au are supported here.'
    });
  }

  const cfg = getConfig();
  const hit = await freshCheck(parsed.domain, cfg);
  if (hit.available !== true) {
    return json(res, 409, {
      ok: false,
      error: 'snapped_up',
      message: 'This one was snapped up. Domain availability can change quickly. Try a close alternative from your results.',
      domain: parsed.domain,
      available: false
    });
  }

  const registerUrl = '/domains?q=' + encodeURIComponent(parsed.domain) + '&from=domain-finder';
  return json(res, 200, {
    ok: true,
    available: true,
    domain: parsed.domain,
    price: hit.price,
    premium: !!hit.premium,
    registerUrl: registerUrl
  });
};
