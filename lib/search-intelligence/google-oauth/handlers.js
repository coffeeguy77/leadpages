'use strict';

/**
 * Shared connect / status / exchange / callback handlers for SI Google connectors.
 * Mirrors Google Ads OAuth: signed state + one-time nonce + encrypted tokens.
 */

const { createClient } = require('@supabase/supabase-js');
const oauthCfg = require('./config');
const {
  makeState,
  parseState,
  reserveStateNonce,
  consumeStateNonce,
  authorizeUrl,
  exchangeCode,
  fetchGoogleAccountEmail
} = require('./oauth');
const { encryptSecret } = require('./crypto');
const { appPath, safeReturnPath, privacyUrl, termsUrl } = require('../../app-url');

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

function wantsJson(req) {
  if (req.method === 'POST') return true;
  const q = req.query || {};
  if (String(q.format || '') === 'json') return true;
  const accept = String(req.headers.accept || '');
  return accept.indexOf('application/json') >= 0;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve({});
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

function makeConnectHandler(providerId) {
  return async function connect(req, res) {
    try {
      const p = oauthCfg.getProvider(providerId);
      if (!p) return sendJson(res, 404, { error: 'unknown_provider' });

      if (!oauthCfg.configured(providerId)) {
        return sendJson(res, 503, {
          error: 'not_configured',
          provider: providerId,
          hint: oauthCfg.configHint(providerId)
        });
      }

      if (!oauthCfg.encryptionConfigured()) {
        return sendJson(res, 503, {
          error: 'encryption_key_required',
          provider: providerId,
          hint:
            'Set SI_OAUTH_ENCRYPTION_KEY (Base64 of 32 bytes) or reuse GOOGLE_ADS_OAUTH_ENCRYPTION_KEY, then redeploy.'
        });
      }

      const token = bearer(req);
      if (!token) return sendJson(res, 401, { error: 'auth_required' });

      const userId = await resolveUserId(token);
      if (!userId) return sendJson(res, 401, { error: 'invalid_session' });

      const body = await readBody(req);
      const q = req.query || {};
      const siteId = String(body.siteId || q.siteId || q.site_id || '').trim();
      if (!siteId) return sendJson(res, 400, { error: 'missing_siteId' });

      const db = admin();
      if (!db) return sendJson(res, 503, { error: 'database_unavailable' });

      const { data: site } = await db.from('sites').select('id,slug').eq('id', siteId).maybeSingle();
      if (!site) return sendJson(res, 404, { error: 'site_not_found' });

      const returnPath = safeReturnPath(
        body.returnPath || q.returnPath || q.return || p.returnPath
      );
      const { state, nonce } = makeState({
        siteId: site.id,
        slug: site.slug || null,
        userId: userId,
        provider: providerId,
        returnPath: returnPath
      });

      try {
        await reserveStateNonce(db, {
          nonce: nonce,
          siteId: site.id,
          userId: userId,
          provider: providerId
        });
      } catch (e) {
        const msg = String((e && e.message) || e);
        if (/si_oauth_states|relation|does not exist/i.test(msg)) {
          return sendJson(res, 503, {
            error: 'schema_pending',
            message: 'Apply db/search_intelligence_schema.sql (si_oauth_states) before connecting.'
          });
        }
        console.error('si-connect state reserve failed:', msg);
        return sendJson(res, 500, { error: 'state_reserve_failed' });
      }

      const url = authorizeUrl(providerId, state);
      if (wantsJson(req)) {
        return sendJson(res, 200, {
          ok: true,
          url: url,
          authorizeUrl: url,
          redirectUri: oauthCfg.oauthRedirectUri(providerId),
          returnPath: returnPath,
          provider: providerId
        });
      }

      res.setHeader('cache-control', 'no-store');
      res.writeHead(302, { Location: url });
      res.end();
    } catch (e) {
      return sendJson(res, 500, {
        error: 'connect_failed',
        message: String((e && e.message) || e)
      });
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
      let schemaReady = true;
      try {
        const db = admin();
        if (db) {
          const { data, error } = await db
            .from('si_connections')
            .select(
              'connection_status,enabled,property_id,last_sync_at,google_account_email,last_sync_error'
            )
            .eq('site_id', siteId)
            .eq('provider', providerId)
            .maybeSingle();
          if (error && /relation|does not exist|si_connections/i.test(String(error.message || ''))) {
            schemaReady = false;
          } else {
            row = data || null;
          }
        }
      } catch (_e) {
        schemaReady = false;
        row = null;
      }

      const st = oauthCfg.connectionStatus(providerId, row);
      return sendJson(
        res,
        200,
        Object.assign({ ok: true, siteId: siteId, schemaReady: schemaReady }, st)
      );
    } catch (e) {
      return sendJson(res, 500, {
        error: 'status_failed',
        message: String((e && e.message) || e)
      });
    }
  };
}

async function upsertConnection(db, opts) {
  const o = opts || {};
  const now = new Date().toISOString();
  const expiresAt =
    o.expiresIn != null ? new Date(Date.now() + Number(o.expiresIn) * 1000).toISOString() : null;

  const row = {
    site_id: o.siteId,
    provider: o.providerId,
    google_account_email: o.email || null,
    granted_scopes: o.scopes || null,
    access_token: o.accessTokenEnc || null,
    refresh_token: o.refreshTokenEnc || null,
    token_expires_at: expiresAt,
    connection_status: 'connected',
    enabled: true,
    last_sync_error: null,
    connected_at: now,
    updated_at: now,
    disconnected_at: null
  };

  const { data: existing } = await db
    .from('si_connections')
    .select('id,refresh_token')
    .eq('site_id', o.siteId)
    .eq('provider', o.providerId)
    .maybeSingle();

  if (existing && existing.id) {
    if (!row.refresh_token && existing.refresh_token) {
      row.refresh_token = existing.refresh_token;
    }
    const { error } = await db.from('si_connections').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message || 'connection_update_failed');
    return existing.id;
  }

  const { data, error } = await db.from('si_connections').insert(row).select('id').single();
  if (error) throw new Error(error.message || 'connection_insert_failed');
  return data && data.id;
}

function makeExchangeHandler(providerId) {
  return async function exchange(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });

    try {
      if (!oauthCfg.configured(providerId)) {
        return sendJson(res, 503, { error: 'not_configured' });
      }
      if (!oauthCfg.encryptionConfigured()) {
        return sendJson(res, 503, { error: 'encryption_key_required' });
      }

      const body = await readBody(req);
      const state = parseState(body.state);
      if (!state) return sendJson(res, 400, { error: 'invalid_or_expired_state' });
      if (!body.code) return sendJson(res, 400, { error: 'missing_code' });
      if (!state.n) return sendJson(res, 400, { error: 'missing_nonce' });
      if (state.provider && state.provider !== providerId) {
        return sendJson(res, 400, { error: 'provider_mismatch' });
      }

      const db = admin();
      if (!db) return sendJson(res, 503, { error: 'database_unavailable' });

      const consumed = await consumeStateNonce(db, state.n);
      if (!consumed) return sendJson(res, 400, { error: 'state_already_used_or_expired' });

      let siteId = state.siteId || null;
      let slug = state.slug || null;
      if (siteId) {
        const { data } = await db.from('sites').select('id,slug').eq('id', siteId).maybeSingle();
        if (!data) return sendJson(res, 404, { error: 'site_not_found' });
        slug = data.slug;
      } else if (slug) {
        const { data } = await db.from('sites').select('id,slug').eq('slug', slug).maybeSingle();
        if (!data) return sendJson(res, 404, { error: 'site_not_found' });
        siteId = data.id;
      } else {
        return sendJson(res, 400, { error: 'missing_site' });
      }

      let tok;
      try {
        tok = await exchangeCode(providerId, body.code);
      } catch (e) {
        console.error('si exchange token error:', e && e.message);
        return sendJson(res, 400, { error: 'token_exchange_failed' });
      }

      if (!tok || !tok.access_token) {
        return sendJson(res, 502, { error: 'token_missing' });
      }

      const email = await fetchGoogleAccountEmail(tok.access_token);
      const accessEnc = encryptSecret(tok.access_token);
      const refreshEnc = tok.refresh_token ? encryptSecret(tok.refresh_token) : null;

      try {
        await upsertConnection(db, {
          siteId: siteId,
          providerId: providerId,
          email: email,
          scopes: tok.scope || null,
          accessTokenEnc: accessEnc,
          refreshTokenEnc: refreshEnc,
          expiresIn: tok.expires_in
        });
      } catch (e) {
        const msg = String((e && e.message) || e);
        if (/si_connections|relation|does not exist/i.test(msg)) {
          return sendJson(res, 503, {
            error: 'schema_pending',
            message: 'Apply db/search_intelligence_schema.sql (si_connections) before connecting.'
          });
        }
        throw e;
      }

      const returnPath = safeReturnPath(state.returnPath);
      return sendJson(res, 200, {
        ok: true,
        provider: providerId,
        siteId: siteId,
        slug: slug,
        returnPath: returnPath,
        googleAccountEmail: email
      });
    } catch (e) {
      console.error('si exchange error:', e && e.message);
      return sendJson(res, 500, {
        error: 'exchange_failed',
        message: String((e && e.message) || e)
      });
    }
  };
}

function makeCallbackHandler(providerId) {
  return async function callback(req, res) {
    const p = oauthCfg.getProvider(providerId);
    const q = req.query || {};
    const code = String(q.code || '');
    const stateRaw = String(q.state || '');
    const err = String(q.error || '');

    const state = stateRaw ? parseState(stateRaw) : null;
    const returnPath = safeReturnPath(state && state.returnPath);
    const successBase = appPath(returnPath);
    const exchangeUrl = appPath(p.exchangePath);
    const flashKey = p.flashKey;
    const label = p.label;

    const html =
      '<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting ' +
      label +
      '…</title>' +
      '<style>body{font:15px/1.45 system-ui,sans-serif;max-width:440px;margin:48px auto;padding:0 16px;color:#1a2230;background:#f6f7f9}' +
      '.card{border:1px solid #e5e7eb;border-radius:12px;padding:22px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.06)}' +
      'h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#5b6878}' +
      '.foot{margin-top:18px;font-size:12px;color:#9aa3af}.foot a{color:#5b6878}</style></head><body>' +
      '<div class="card"><h1>Connecting ' +
      label +
      '…</h1><p id="m">Please wait.</p>' +
      '<p class="foot"><a href="' +
      privacyUrl() +
      '" target="_blank" rel="noopener">Privacy</a> · <a href="' +
      termsUrl() +
      '" target="_blank" rel="noopener">Terms</a></p></div>' +
      '<script>(function(){' +
      'var err=' +
      JSON.stringify(err) +
      ';' +
      'var code=' +
      JSON.stringify(code) +
      ';' +
      'var state=' +
      JSON.stringify(stateRaw) +
      ';' +
      'var exchangeUrl=' +
      JSON.stringify(exchangeUrl) +
      ';' +
      'var successBase=' +
      JSON.stringify(successBase) +
      ';' +
      'var flashKey=' +
      JSON.stringify(flashKey) +
      ';' +
      'var m=document.getElementById("m");' +
      'if(err){ m.textContent="Google returned an error: "+err; return; }' +
      'if(!code||!state){ m.textContent="Missing OAuth code. Close this window and try Connect again."; return; }' +
      'fetch(exchangeUrl,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({code:code,state:state})})' +
      '.then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })' +
      '.then(function(x){' +
      'if(!x.ok){ m.textContent=(x.j&&(x.j.message||x.j.error))||"Connection failed."; return; }' +
      'var siteId=(x.j&&x.j.siteId)||"";' +
      'var slug=(x.j&&x.j.slug)||"";' +
      'var url=successBase+(successBase.indexOf("?")>=0?"&":"?")+flashKey+"=connected"' +
      '+(siteId?("&siteId="+encodeURIComponent(siteId)):"")' +
      '+(slug?("&site="+encodeURIComponent(slug)):"");' +
      'm.textContent="Connected. Redirecting…";' +
      'location.replace(url);' +
      '}).catch(function(e){ m.textContent="Connection failed: "+(e&&e.message||e); });' +
      '})();</script></body></html>';

    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(html);
  };
}

module.exports = {
  makeConnectHandler: makeConnectHandler,
  makeStatusHandler: makeStatusHandler,
  makeExchangeHandler: makeExchangeHandler,
  makeCallbackHandler: makeCallbackHandler,
  sendJson: sendJson,
  bearer: bearer
};
