/**
 * At-rest encryption for Google Ads OAuth refresh/access tokens.
 *
 * Algorithm: AES-256-GCM
 * Key: GOOGLE_ADS_OAUTH_ENCRYPTION_KEY
 *   - Preferred: Base64 (or Base64URL) encoding of 32 random bytes → used as raw AES key
 *   - Also: 64 hex chars → raw AES key
 *   - Legacy: UTF-8 passphrase ≥32 chars → SHA-256(passphrase) as AES key
 * Wire format: enc:v1: + base64url( iv[12] || tag[16] || ciphertext )
 *
 * Key rotation is NOT supported in v1 (single active key). Re-connect sites after key change.
 * Plaintext storage is refused — encryptSecret throws if the key is missing/invalid.
 */
const crypto = require('crypto');
const { encryptionConfigured, encryptionKeyBytes } = require('./encryption-key');

const PREFIX = 'enc:v1:';

function keyBuf() {
  return encryptionKeyBytes();
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  const key = keyBuf();
  if (!key) {
    throw new Error('GOOGLE_ADS_OAUTH_ENCRYPTION_KEY required (Base64 of 32 bytes) — refusing plaintext token storage');
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
  if (!s.startsWith(PREFIX)) {
    throw new Error('plaintext_or_unknown_token_blob — re-connect Google Ads after enabling encryption');
  }
  const key = keyBuf();
  if (!key) throw new Error('encrypted_token_but_no_GOOGLE_ADS_OAUTH_ENCRYPTION_KEY');
  const buf = Buffer.from(s.slice(PREFIX.length), 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function prepareConnectionTokens(conn) {
  if (!conn) return conn;
  const out = Object.assign({}, conn);
  if (out.refresh_token) out.refresh_token = decryptSecret(out.refresh_token);
  if (out.access_token) out.access_token = decryptSecret(out.access_token);
  return out;
}

module.exports = {
  PREFIX,
  encryptSecret,
  decryptSecret,
  prepareConnectionTokens,
  encryptionConfigured
};
