'use strict';

/**
 * POST /api/domain-finder/search
 * Orchestrates AI naming + Dreamscape availability for AU TLDs only.
 */

const { createClient } = require('@supabase/supabase-js');
const { getPlatformBrain, isDomainFinderEnabled } = require('../../lib/brain/platform');
const { runSearch } = require('../../lib/domain-finder/orchestrate');
const { FINDER_TLDS } = require('../../lib/domain-finder/config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HITS = new Map();
function limited(key) {
  const now = Date.now();
  const a = (HITS.get(key) || []).filter(function (t) { return now - t < 60000; });
  a.push(now);
  HITS.set(key, a);
  return a.length > 8;
}

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

async function persistSession(user, body, result) {
  try {
    const { data: session, error } = await admin.from('domain_finder_sessions').insert({
      user_id: user.id,
      site_id: body.site_id || null,
      business_description: String(body.business_description || body.brief || '').slice(0, 8000),
      business_type: String(body.business_type || 'Local Business').slice(0, 80),
      location: String(body.location || '').slice(0, 120),
      preferred_words: Array.isArray(body.preferred_words) ? body.preferred_words : [],
      excluded_words: Array.isArray(body.excluded_words) ? body.excluded_words : [],
      existing_ideas: Array.isArray(body.existing_ideas) ? body.existing_ideas : [],
      preferred_tlds: FINDER_TLDS,
      mode: String(body.mode || 'standard').slice(0, 40),
      status: result.ok ? (result.results && result.results.length ? 'completed' : 'partial') : 'failed',
      progress: result.progress || [],
      meta: result.meta || {}
    }).select('id,created_at').maybeSingle();
    if (error || !session) return null;

    const rows = [];
    (result.results || []).forEach(function (fam) {
      (fam.domains || []).forEach(function (d) {
        rows.push({
          session_id: session.id,
          display_name: fam.displayName || fam.root,
          root: fam.root,
          full_domain: d.domain,
          tld: d.tld,
          strategy: fam.category || 'brandable',
          availability: 'available',
          price: d.price,
          currency: d.currency || 'AUD',
          premium: !!d.premium,
          ai_score: fam.scores && fam.scores.overall,
          ai_reason: fam.reason || '',
          scores: fam.scores || {},
          badge: fam.badge || null,
          generation_round: 1,
          saved: false,
          selected: false
        });
      });
    });
    if (rows.length) {
      await admin.from('domain_finder_candidates').insert(rows);
    }
    return session;
  } catch (_e) {
    return null;
  }
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!isDomainFinderEnabled()) {
    return json(res, 404, { ok: false, error: 'disabled', message: 'Domain Finder is not enabled.' });
  }

  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth', message: 'Sign in to use Domain Finder.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || user.id;
  if (limited(user.id + ':' + ip)) {
    return json(res, 429, { ok: false, error: 'rate_limit', message: 'Too many searches — wait a moment and try again.' });
  }

  const body = await readBody(req);
  // Product rule: AU TLDs only
  body.tlds = FINDER_TLDS.slice();

  try {
    const brain = getPlatformBrain();
    const result = await runSearch({
      body: body,
      brain: brain,
      actor: { userId: user.id },
      providerOverride: 'openai',
      // Legacy monolithic path — keep strictly short; UI prefers stepped APIs.
      config: {
        maxGenerationRounds: 1,
        candidatesPerRound: 10,
        targetAvailable: 8,
        maxDomainsChecked: 24,
        deadlineMs: 25000,
        aiGenerateTimeoutMs: 12000,
        aiRankTimeoutMs: 8000
      }
    });

    if (!result.ok) return json(res, 400, result);

    const session = await persistSession(user, body, result);
    return json(res, 200, {
      ok: true,
      sessionId: session && session.id,
      progress: result.progress,
      results: result.results,
      meta: result.meta,
      notice: 'Domain availability does not confirm trademark or business-name availability. We recommend checking your chosen name before launching your brand.',
      registerPath: '/domains'
    });
  } catch (e) {
    console.error('domain-finder search:', e && e.message);
    // Prefer a soft JSON response over 5xx so the UI can recover (Vercel 504 is worse).
    return json(res, 200, {
      ok: true,
      progress: [{ id: 'error', label: 'Live checking hit a snag — try again shortly', state: 'done' }],
      results: [],
      meta: { error: 'search_failed', zero: true },
      message: 'We can create name ideas, but live availability checking is temporarily unavailable. Try again shortly.',
      notice: 'Domain availability does not confirm trademark or business-name availability. We recommend checking your chosen name before launching your brand.',
      registerPath: '/domains'
    });
  }
};
