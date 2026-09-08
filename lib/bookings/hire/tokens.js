'use strict';

/**
 * Token encryption for Bookings integrations (Google / Xero).
 * Reuses Google Ads AES-256-GCM helpers when available; falls back to
 * BOOKINGS_OAUTH_ENCRYPTION_KEY / INTEGRATIONS_OAUTH_ENCRYPTION_KEY.
 */

const crypto = require('crypto');

let adsCrypto = null;
try {
  adsCrypto = require('../../google-ads/token-crypto');
} catch (_e) {
  adsCrypto = null;
}

const PREFIX = 'enc:v1:';

function keyBytes() {
  const raw =
    process.env.BOOKINGS_OAUTH_ENCRYPTION_KEY ||
    process.env.INTEGRATIONS_OAUTH_ENCRYPTION_KEY ||
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY ||
    '';
  if (!raw) return null;
  // Prefer base64 32-byte key
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch (_e) {}
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (raw.length >= 32) return crypto.createHash('sha256').update(raw, 'utf8').digest();
  return null;
}

function encryptionConfigured() {
  if (adsCrypto && typeof adsCrypto.encryptionConfigured === 'function' && adsCrypto.encryptionConfigured()) {
    return true;
  }
  return !!keyBytes();
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  if (adsCrypto && typeof adsCrypto.encryptSecret === 'function' && encryptionConfigured()) {
    try {
      return adsCrypto.encryptSecret(plain);
    } catch (_e) {
      // fall through to local
    }
  }
  const key = keyBytes();
  if (!key) {
    throw new Error(
      'BOOKINGS_OAUTH_ENCRYPTION_KEY (or GOOGLE_ADS_OAUTH_ENCRYPTION_KEY) required — refusing plaintext token storage'
    );
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptSecret(stored) {
  if (stored == null || stored === '') return stored;
  const s = String(stored);
  if (adsCrypto && typeof adsCrypto.decryptSecret === 'function' && s.indexOf('enc:') === 0) {
    try {
      return adsCrypto.decryptSecret(s);
    } catch (_e) {
      // try local format
    }
  }
  if (!s.startsWith(PREFIX)) {
    throw new Error('plaintext_or_unknown_token_blob — reconnect integration after enabling encryption');
  }
  const key = keyBytes();
  if (!key) throw new Error('encrypted_token_but_no_BOOKINGS_OAUTH_ENCRYPTION_KEY');
  const buf = Buffer.from(s.slice(PREFIX.length), 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = {
  encryptionConfigured,
  encryptSecret,
  decryptSecret
};
