/**
 * Optional at-rest encryption for Google Ads OAuth refresh/access tokens.
 * Uses GOOGLE_ADS_OAUTH_ENCRYPTION_KEY (32+ char secret). When unset, stores plaintext
 * (compatible with existing rows) and logs nothing sensitive.
 */
const crypto = require('crypto');
const { encryptionKey } = require('./config');

const PREFIX = 'enc:v1:';

function keyBuf() {
  const raw = encryptionKey();
  if (!raw || String(raw).length < 16) return null;
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  const key = keyBuf();
  if (!key) return String(plain);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptSecret(stored) {
  if (stored == null || stored === '') return stored;
  const s = String(stored);
  if (!s.startsWith(PREFIX)) return s; // plaintext legacy row
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
  try {
    if (out.refresh_token) out.refresh_token = decryptSecret(out.refresh_token);
    if (out.access_token) out.access_token = decryptSecret(out.access_token);
  } catch (e) {
    throw e;
  }
  return out;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  prepareConnectionTokens
};
