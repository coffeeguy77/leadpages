'use strict';

/**
 * POST /api/integrations/search-console/sync
 * { siteId, days? } — pull GSC query×page into si_query_page_stats
 */

const { createClient } = require('@supabase/supabase-js');
const { syncGscSite } = require('../../../lib/search-intelligence/sync');

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body));
        } catch {
          return resolve({});
        }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function resolveUserId(token) {
  const anon = process.env.SUPABASE_ANON_KEY || '';
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: {
        apikey: anon || process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + token
      }
    });
    if (ur.ok) {
      const u = await ur.json();
      if (u && u.id) return u.id;
    }
  } catch (_e) {
    /* fall through */
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
  const token = bearer(req);
  if (!token) return sendJson(res, 401, { error: 'auth_required' });
  if (!(await resolveUserId(token))) return sendJson(res, 401, { error: 'invalid_session' });

  const body = await readBody(req);
  const siteId = String(body.siteId || body.site_id || '').trim();
  if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });
  const days = Math.max(1, Math.min(90, parseInt(body.days || '28', 10) || 28));

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: conn, error } = await admin
    .from('si_connections')
    .select('*')
    .eq('site_id', siteId)
    .eq('provider', 'search_console')
    .maybeSingle();
  if (error && /relation|does not exist/i.test(String(error.message || ''))) {
    return sendJson(res, 503, { error: 'schema_pending' });
  }
  if (!conn) return sendJson(res, 400, { error: 'not_connected' });

  const result = await syncGscSite(admin, conn, { days: days });
  return sendJson(res, result.ok ? 200 : 400, result);
};
