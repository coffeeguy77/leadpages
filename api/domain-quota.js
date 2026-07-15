// api/domain-quota.js — soft awareness of Vercel project domain capacity.
// Auth: Bearer JWT, super-admin only.
// Never blocks writes — returns count + warn/critical for the editor UI.

const { createClient } = require('@supabase/supabase-js');
const vercel = require('./vercel/_client');
const { evaluateDomainQuota, quotaLimits } = require('../lib/domain-quota');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CACHE_MS = Math.max(30000, parseInt(process.env.VERCEL_DOMAIN_QUOTA_CACHE_MS || '300000', 10) || 300000);
let _cache = null;

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function isSuperAdmin(userId) {
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function countRoutingDomains() {
  try {
    const { count, error } = await admin
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .not('custom_domain', 'is', null)
      .neq('custom_domain', '');
    if (error) return null;
    return count == null ? null : Number(count);
  } catch {
    return null;
  }
}

async function vercelDomainCount(force) {
  if (!force && _cache && Date.now() - _cache.at < CACHE_MS) {
    return { count: _cache.count, cached: true, error: null };
  }
  if (!vercel.projectConfigured()) {
    return { count: null, cached: false, error: 'not_configured' };
  }
  try {
    const r = await vercel.countProjectDomains({ includeRedirects: false });
    _cache = { at: Date.now(), count: r.count };
    return { count: r.count, cached: false, error: null };
  } catch (e) {
    return {
      count: _cache ? _cache.count : null,
      cached: !!_cache,
      error: (e && (e.code || e.message)) || 'vercel_error'
    };
  }
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method' }));
  }

  const user = await requireUser(req);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'auth' }));
  }
  if (!(await isSuperAdmin(user.id))) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
  }

  const force = String(req.query && req.query.refresh) === '1';
  const limits = quotaLimits();
  const routingCount = await countRoutingDomains();
  const v = await vercelDomainCount(force);
  const configured = vercel.projectConfigured();

  let verdict = { decision: 'ok', count: v.count == null ? 0 : v.count, softLimit: null, hardLimit: null };
  if (configured && v.count != null) {
    verdict = evaluateDomainQuota(v.count, limits);
  } else if (!configured) {
    verdict = {
      decision: 'ok',
      count: 0,
      softLimit: limits.softLimit > 0 ? limits.softLimit : null,
      hardLimit: limits.hardLimit > 0 ? limits.hardLimit : null,
      message: 'Set VERCEL_TOKEN + VERCEL_PROJECT_ID to track project domain capacity.'
    };
  }

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      ok: true,
      configured,
      count: v.count,
      routingCount,
      softLimit: verdict.softLimit,
      hardLimit: verdict.hardLimit,
      decision: verdict.decision,
      message: verdict.message || null,
      cached: !!v.cached,
      vercelError: v.error,
      blocksPublish: false
    })
  );
};
