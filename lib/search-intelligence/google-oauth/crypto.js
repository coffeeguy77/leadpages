'use strict';

/**
 * Token encryption for Search Intelligence Google connectors.
 * Prefers SI_OAUTH_ENCRYPTION_KEY; falls back to Google Ads key so one platform key works.
 */

const adsCrypto = require('../../google-ads/token-crypto');
const adsKey = require('../../google-ads/encryption-key');

function encryptionConfigured() {
  if (String(process.env.SI_OAUTH_ENCRYPTION_KEY || '').trim()) {
    // Temporarily map to Ads parser by swapping env — avoid duplicating key parse logic.
    const prev = process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY;
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = process.env.SI_OAUTH_ENCRYPTION_KEY;
    try {
      return adsKey.encryptionConfigured();
    } finally {
      if (prev == null) delete process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY;
      else process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = prev;
    }
  }
  return adsCrypto.encryptionConfigured();
}

function withSiKey(fn) {
  const si = String(process.env.SI_OAUTH_ENCRYPTION_KEY || '').trim();
  if (!si) return fn();
  const prev = process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY;
  process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = si;
  try {
    return fn();
  } finally {
    if (prev == null) delete process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY;
    else process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = prev;
  }
}

function encryptSecret(plain) {
  return withSiKey(function () {
    return adsCrypto.encryptSecret(plain);
  });
}

function decryptSecret(stored) {
  return withSiKey(function () {
    return adsCrypto.decryptSecret(stored);
  });
}

module.exports = {
  encryptionConfigured: encryptionConfigured,
  encryptSecret: encryptSecret,
  decryptSecret: decryptSecret
};
