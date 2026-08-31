'use strict';

/**
 * GET /api/domain-finder/sessions — recent searches
 * GET /api/domain-finder/sessions?id= — one session + candidates
 * POST /api/domain-finder/sessions — { action:'save'|'unsave'|'select', candidateId }
 */

const { createClient } = require('@supabase/supabase-js');
const { isDomainFinderEnabled } = require('../../lib/brain/platform');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

function groupCandidates(rows) {
  const byRoot = {};
  (rows || []).forEach(function (r) {
    if (!byRoot[r.root]) {
      byRoot[r.root] = {
        id: r.id,
        root: r.root,
        displayName: r.display_name,
        category: r.strategy,
        reason: r.ai_reason,
        badge: r.badge,
        scores: r.scores || { overall: r.ai_score },
        saved: !!r.saved,
        domains: [],
        availableTlds: []
      };
    }
    const fam = byRoot[r.root];
    fam.domains.push({
      id: r.id,
      domain: r.full_domain,
      tld: r.tld,
      available: r.availability === 'available',
      price: r.price,
      currency: r.currency,
      premium: !!r.premium
    });
    if (fam.availableTlds.indexOf(r.tld) < 0) fam.availableTlds.push(r.tld);
    if (r.saved) fam.saved = true;
    if (r.badge) fam.badge = r.badge;
    if (r.ai_score != null && (!fam.scores.overall || Number(r.ai_score) > Number(fam.scores.overall))) {
      fam.scores = r.scores || { overall: r.ai_score };
      fam.reason = r.ai_reason || fam.reason;
    }
  });
  return Object.keys(byRoot).map(function (k) { return byRoot[k]; })
    .sort(function (a, b) {
      return Number(b.scores && b.scores.overall || 0) - Number(a.scores && a.scores.overall || 0);
    });
}

module.exports = async function (req, res) {
  if (!isDomainFinderEnabled()) {
    return json(res, 404, { ok: false, error: 'disabled' });
  }
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://x');
    const id = (url.searchParams.get('id') || '').trim();
    if (id) {
      const { data: session, error } = await admin
        .from('domain_finder_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error || !session) return json(res, 404, { ok: false, error: 'not_found' });
      const { data: cands } = await admin
        .from('domain_finder_candidates')
        .select('*')
        .eq('session_id', id)
        .order('ai_score', { ascending: false });
      return json(res, 200, {
        ok: true,
        session: session,
        results: groupCandidates(cands || []),
        candidates: cands || []
      });
    }
    const { data: rows } = await admin
      .from('domain_finder_sessions')
      .select('id,business_description,business_type,location,status,meta,created_at,updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return json(res, 200, { ok: true, sessions: rows || [] });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const action = String(body.action || '').trim();
    const candidateId = String(body.candidateId || body.id || '').trim();
    if (!candidateId) return json(res, 400, { ok: false, error: 'candidateId_required' });

    const { data: cand } = await admin
      .from('domain_finder_candidates')
      .select('id,session_id,full_domain')
      .eq('id', candidateId)
      .maybeSingle();
    if (!cand) return json(res, 404, { ok: false, error: 'not_found' });

    const { data: session } = await admin
      .from('domain_finder_sessions')
      .select('id,user_id')
      .eq('id', cand.session_id)
      .maybeSingle();
    if (!session || session.user_id !== user.id) return json(res, 403, { ok: false, error: 'forbidden' });

    if (action === 'save' || action === 'unsave') {
      await admin.from('domain_finder_candidates').update({ saved: action === 'save' }).eq('id', candidateId);
      return json(res, 200, { ok: true, saved: action === 'save' });
    }
    if (action === 'select') {
      await admin.from('domain_finder_candidates').update({ selected: false }).eq('session_id', cand.session_id);
      await admin.from('domain_finder_candidates').update({ selected: true }).eq('id', candidateId);
      return json(res, 200, { ok: true, selected: cand.full_domain });
    }
    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
