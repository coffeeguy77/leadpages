'use strict';

/**
 * Shared connect/status handlers for SI Google connectors (scaffold).
 */

const oauthCfg = require('../../../lib/search-intelligence/google-oauth/config');

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
    if (req.method === 'GET' || req.method === 'HEAD') return resolve({});
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function makeConnectHandler(providerId) {
  return async function connect(req, res) {
    try {
      const p = oauthCfg.getProvider(providerId);
      if (!p) return sendJson(res, 404, { error: 'unknown_provider' });

      if (!bearer(req) && req.method === 'POST') {
        /* still allow status of platform without user for diagnostics via GET */
      }
      if (!bearer(req)) {
        return sendJson(res, 401, { error: 'auth_required' });
      }

      if (!oauthCfg.configured(providerId)) {
        return sendJson(res, 503, {
          error: 'not_configured',
          provider: providerId,
          hint:
            'Set ' +
            p.clientIdEnv +
            ' and ' +
            p.clientSecretEnv +
            ' (and optional ' +
            p.redirectEnv +
            ') then redeploy.'
        });
      }

      const body = await readBody(req);
      const q = req.query || {};
      const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
      if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });

      // Credentials exist but full authorize→exchange is not enabled yet.
      return sendJson(res, 503, {
        error: 'oauth_exchange_pending',
        provider: providerId,
        platformConfigured: true,
        siteId: siteId,
        redirectUri: oauthCfg.oauthRedirectUri(providerId),
        scopes: p.scopes,
        message:
          p.label +
          ' platform credentials are present. OAuth authorize/exchange will enable Connect in a follow-up; si_connections storage is prepared in db/search_intelligence_schema.sql.'
      });
    } catch (e) {
      return sendJson(res, 500, { error: 'connect_failed', message: String(e && e.message || e) });
    }
  };
}

function makeStatusHandler(providerId) {
  return async function status(req, res) {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
      }
      if (!bearer(req)) return sendJson(res, 401, { error: 'auth_required' });

      const body = req.method === 'POST' ? await readBody(req) : {};
      const q = req.query || {};
      const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
      if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });

      let row = null;
      try {
        const { createClient } = require('@supabase/supabase-js');
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data } = await sb
            .from('si_connections')
            .select('connection_status,enabled,property_id,last_sync_at')
            .eq('site_id', siteId)
            .eq('provider', providerId)
            .maybeSingle();
          row = data || null;
        }
      } catch (_e) {
        row = null;
      }

      const st = oauthCfg.connectionStatus(providerId, row);
      return sendJson(res, 200, Object.assign({ ok: true, siteId: siteId }, st));
    } catch (e) {
      return sendJson(res, 500, { error: 'status_failed', message: String(e && e.message || e) });
    }
  };
}

module.exports = {
  makeConnectHandler: makeConnectHandler,
  makeStatusHandler: makeStatusHandler,
  sendJson: sendJson,
  bearer: bearer
};
