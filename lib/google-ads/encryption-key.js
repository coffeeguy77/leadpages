/**
 * Parse GOOGLE_ADS_OAUTH_ENCRYPTION_KEY into a 32-byte AES-256 key.
 *
 * Accepted formats (checked in order):
 * 1. Standard Base64 or Base64URL of exactly 32 cryptographically random bytes
 *    (typical string length 43–44; `openssl rand -base64 32`)
 * 2. 64 hexadecimal characters (32 bytes)
 * 3. Legacy passphrase: UTF-8 string length ≥ 32 → SHA-256(utf8) as key material
 *
 * Never log or return the key value.
 */
const crypto = require('crypto');

function rawEncryptionKey() {
  return String(process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY || '').trim();
}

function stripPad(s) {
  return String(s || '').replace(/=+$/, '');
}

/**
 * Strict Base64 / Base64URL → Buffer of expected length, or null.
 */
function tryDecodeBase64Exact(raw, byteLength) {
  const compact = String(raw || '').trim().replace(/\s+/g, '');
  if (!compact) return null;
  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;
  let buf;
  try {
    buf = Buffer.from(normalized, 'base64');
  } catch (e) {
    return null;
  }
  if (!buf || buf.length !== byteLength) return null;
  // Reject Buffer.from's lenient garbage decode via round-trip.
  if (stripPad(buf.toString('base64')) !== stripPad(normalized)) return null;
  return buf;
}

function tryDecodeHexExact(raw, byteLength) {
  const s = String(raw || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(s)) return null;
  if (s.length !== byteLength * 2) return null;
  return Buffer.from(s, 'hex');
}

/** Best-effort decoded length for diagnostics when the key is invalid. */
function probeDecodedByteLength(raw) {
  const compact = String(raw || '').trim().replace(/\s+/g, '');
  if (!compact) return 0;
  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    try {
      const buf = Buffer.from(normalized, 'base64');
      if (stripPad(buf.toString('base64')) === stripPad(normalized)) return buf.length;
    } catch (e) { /* ignore */ }
  }
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0) {
    return compact.length / 2;
  }
  return 0;
}

/**
 * @returns {{
 *   configured: boolean,
 *   rawLength: number,
 *   decodedByteLength: number,
 *   mode: 'base64'|'hex'|'passphrase'|null,
 *   key: Buffer|null
 * }}
 */
function resolveEncryptionKey() {
  const raw = rawEncryptionKey();
  const rawLength = Buffer.byteLength(raw, 'utf8');
  if (!raw) {
    return { configured: false, rawLength: 0, decodedByteLength: 0, mode: null, key: null };
  }

  const b64 = tryDecodeBase64Exact(raw, 32);
  if (b64) {
    return { configured: true, rawLength, decodedByteLength: 32, mode: 'base64', key: b64 };
  }

  const hex = tryDecodeHexExact(raw, 32);
  if (hex) {
    return { configured: true, rawLength, decodedByteLength: 32, mode: 'hex', key: hex };
  }

  // Legacy passphrase path (pre–raw-key). Still requires ≥32 UTF-8 code units.
  if (raw.length >= 32) {
    const key = crypto.createHash('sha256').update(raw, 'utf8').digest();
    return { configured: true, rawLength, decodedByteLength: key.length, mode: 'passphrase', key };
  }

  return {
    configured: false,
    rawLength,
    decodedByteLength: probeDecodedByteLength(raw),
    mode: null,
    key: null
  };
}

function encryptionConfigured() {
  return resolveEncryptionKey().configured;
}

function encryptionKeyBytes() {
  return resolveEncryptionKey().key;
}

/** Safe diagnostics — never includes key material. */
function encryptionKeyDiagnostics() {
  const r = resolveEncryptionKey();
  return {
    configured: r.configured,
    rawLength: r.rawLength,
    decodedByteLength: r.decodedByteLength,
    runtime: (typeof EdgeRuntime !== 'undefined') ? 'edge' : 'nodejs',
    vercelEnvironment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
  };
}

module.exports = {
  rawEncryptionKey,
  resolveEncryptionKey,
  encryptionConfigured,
  encryptionKeyBytes,
  encryptionKeyDiagnostics,
  tryDecodeBase64Exact
};
