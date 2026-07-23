'use strict';

/**
 * Shared property list / save handlers for GSC + GA4.
 */

const { createClient } = require('@supabase/supabase-js');
const oauthCfg = require('../google-oauth/config');
const { ensureAccessToken } = require('../google-oauth/tokens');
const { listSites } = require('./gsc-client');
const { listProperties } = require('./ga4-client');

function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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

async function loadConn(db, siteId, providerId) {
  const { data, error } = await db
    .from('si_connections')
    .select('*')
    .eq('site_id', siteId)
    .eq('provider', providerId)
    .maybeSingle();
  if (error && /relation|does not exist/i.test(String(error.message || ''))) {
    const err = new Error('schema_pending');
    err.code = 'schema_pending';
    throw err;
  }
  if (error) throw new Error(error.message);
  return data || null;
}

function makePropertiesHandler(providerId) {
  return async function properties(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }
    const token = bearer(req);
    if (!token) return sendJson(res, 401, { error: 'auth_required' });
    if (!(await resolveUserId(token))) return sendJson(res, 401, { error: 'invalid_session' });

    const body = req.method === 'POST' ? await readBody(req) : {};
    const q = req.query || {};
    const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
    if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });

    if (!oauthCfg.configured(providerId)) {
      return sendJson(res, 503, { error: 'not_configured' });
    }

    const db = admin();
    if (!db) return sendJson(res, 503, { error: 'database_unavailable' });

    try {
      const conn = await loadConn(db, siteId, providerId);
      if (!conn || conn.connection_status !== 'connected') {
        return sendJson(res, 400, { error: 'not_connected', message: 'Connect Google first.' });
      }
      const access = await ensureAccessToken(db, conn, providerId);
      const properties =
        providerId === 'ga4' ? await listProperties(access) : await listSites(access);
      return sendJson(res, 200, {
        ok: true,
        provider: providerId,
        siteId: siteId,
        selectedPropertyId: conn.property_id || null,
        properties: properties
      });
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === 'schema_pending' || e.code === 'schema_pending') {
        return sendJson(res, 503, { error: 'schema_pending' });
      }
      return sendJson(res, 500, { error: 'properties_failed', message: msg });
    }
  };
}

function makeSavePropertyHandler(providerId) {
  return async function saveProperty(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    const token = bearer(req);
    if (!token) return sendJson(res, 401, { error: 'auth_required' });
    if (!(await resolveUserId(token))) return sendJson(res, 401, { error: 'invalid_session' });

    const body = await readBody(req);
    const siteId = String(body.siteId || body.site_id || '').trim();
    const propertyId = String(body.propertyId || body.property_id || '').trim();
    if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });
    if (!propertyId) return sendJson(res, 400, { error: 'missing_propertyId' });

    const db = admin();
    if (!db) return sendJson(res, 503, { error: 'database_unavailable' });

    try {
      const conn = await loadConn(db, siteId, providerId);
      if (!conn || conn.connection_status !== 'connected') {
        return sendJson(res, 400, { error: 'not_connected' });
      }

      const meta = Object.assign({}, conn.property_meta || {}, {
        label: body.label || body.propertyLabel || null,
        savedAt: new Date().toISOString()
      });
      if (providerId === 'ga4' && body.propertyResource) {
        meta.propertyResource = body.propertyResource;
      }

      const { error } = await db
        .from('si_connections')
        .update({
          property_id: propertyId,
          property_meta: meta,
          updated_at: new Date().toISOString(),
          last_sync_error: null
        })
        .eq('site_id', siteId)
        .eq('provider', providerId);
      if (error) throw new Error(error.message);

      return sendJson(res, 200, {
        ok: true,
        provider: providerId,
        siteId: siteId,
        propertyId: propertyId,
        propertyMeta: meta
      });
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === 'schema_pending' || e.code === 'schema_pending') {
        return sendJson(res, 503, { error: 'schema_pending' });
      }
      return sendJson(res, 500, { error: 'save_failed', message: msg });
    }
  };
}

module.exports = {
  makePropertiesHandler: makePropertiesHandler,
  makeSavePropertyHandler: makeSavePropertyHandler,
  sendJson: sendJson,
  bearer: bearer,
  admin: admin,
  readBody: readBody
};
