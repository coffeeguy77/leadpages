'use strict';

/**
 * POST /api/domain-finder/generate
 * AI naming only (no Dreamscape). Kept short to avoid Vercel 504.
 */

const { createClient } = require('@supabase/supabase-js');
const { getPlatformBrain, isDomainFinderEnabled } = require('../../lib/brain/platform');
const { callGenerate, normalizeBrief } = require('../../lib/domain-finder/orchestrate');
const { toRoot } = require('../../lib/domain-finder/normalize');
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
  if (!brief.business_description || brief.business_description.length < 12) {
    return json(res, 400, { ok: false, error: 'brief_required', message: 'Tell us what you are building.' });
  }

  const cfg = getConfig();
  const count = Math.min(
    20,
    Math.max(6, parseInt(body.count, 10) || cfg.candidatesPerRound || 12)
  );
  const excluded = Array.isArray(body.excluded)
    ? body.excluded.map(function (x) { return toRoot(x); }).filter(Boolean)
    : [];

  try {
    const brain = getPlatformBrain();
    const timeoutMs = Math.min(cfg.aiGenerateTimeoutMs || 12000, 15000);
    const gen = await callGenerate(brain, brief, excluded, count, 'openai', timeoutMs);
    const candidates = (gen.candidates || []).filter(function (c) {
      const root = toRoot(c.root || c.name);
      return !!root && excluded.indexOf(root) < 0;
    }).map(function (c) {
      return {
        name: c.name,
        root: toRoot(c.root || c.name),
        category: c.category || 'brandable',
        reason: c.reason || ''
      };
    });
    return json(res, 200, { ok: true, candidates: candidates, count: candidates.length });
  } catch (e) {
    console.error('domain-finder generate:', e && e.message);
    return json(res, 502, {
      ok: false,
      error: 'generate_failed',
      message: 'Naming engine timed out — try again.'
    });
  }
};
