'use strict';

const crypto = require('crypto');

const DEFAULT_TTL_SEC = 15 * 60;

function secret() {
  return (
    process.env.THEME_STUDIO_PREVIEW_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'theme-studio-dev-secret'
  );
}

/**
 * Create a short-lived signed preview token for a draft version.
 * @param {{ draftId: string, versionId: string, userId: string, exp?: number }} payload
 */
function signPreviewToken(payload) {
  const exp = payload.exp || Math.floor(Date.now() / 1000) + DEFAULT_TTL_SEC;
  const body = {
    d: payload.draftId,
    v: payload.versionId,
    u: payload.userId,
    exp
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return data + '.' + sig;
}

/**
 * @param {string} token
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
function verifyPreviewToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'invalid_token' };
  }
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad_signature' };
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, error: 'expired' };
    }
    return {
      ok: true,
      payload: {
        draftId: payload.d,
        versionId: payload.v,
        userId: payload.u,
        exp: payload.exp
      }
    };
  } catch (_e) {
    return { ok: false, error: 'invalid_payload' };
  }
}

module.exports = {
  signPreviewToken,
  verifyPreviewToken,
  DEFAULT_TTL_SEC
};
