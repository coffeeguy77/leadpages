'use strict';

/**
 * POST /api/domain-finder/rank
 * Rank already-available domain families (AI + deterministic). Short request.
 */

const { createClient } = require('@supabase/supabase-js');
const { getPlatformBrain, isDomainFinderEnabled } = require('../../lib/brain/platform');
const { callRank, normalizeBrief } = require('../../lib/domain-finder/orchestrate');
const { buildFamilies, mergeScores, ensureFeaturedBadges } = require('../../lib/domain-finder/rank');
const { getConfig } = require('../../lib/domain-finder/config');

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
  const brief = normalizeBrief(body);
  brief.actor = { userId: user.id };
  const rows = Array.isArray(body.available) ? body.available : [];
  if (!rows.length) {
    return json(res, 200, { ok: true, results: [] });
  }

  const cfg = getConfig();
  const families = buildFamilies(rows.slice(0, 80));
  const skipAi = body.fast === true || String(process.env.DOMAIN_FINDER_AI_RANK || '1') === '0';
  try {
    const brain = skipAi ? null : getPlatformBrain();
    const timeoutMs = Math.min(cfg.aiRankTimeoutMs || 10000, 12000);
    const aiRank = await callRank(brain, brief, families, 'openai', timeoutMs);
    let ranked = mergeScores(families, (aiRank && aiRank.ranked) || []);
    ranked = ensureFeaturedBadges(ranked);
    return json(res, 200, { ok: true, results: ranked });
  } catch (e) {
    console.error('domain-finder rank:', e && e.message);
    let ranked = mergeScores(families, []);
    ranked = ensureFeaturedBadges(ranked);
    return json(res, 200, { ok: true, results: ranked, meta: { rankedFallback: true } });
  }
};
