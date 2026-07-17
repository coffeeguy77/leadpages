const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const KEYS = [
  'APP_URL',
  'GOOGLE_ADS_REDIRECT_URI',
  'GOOGLE_ADS_OAUTH_ENCRYPTION_KEY',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'VERCEL_ENV'
];

function reload() {
  [
    '../lib/app-url',
    '../lib/google-ads/config',
    '../lib/google-ads/oauth',
    '../lib/google-ads/token-crypto'
  ].forEach((p) => { delete require.cache[require.resolve(p)]; });
  return {
    cfg: require('../lib/google-ads/config'),
    oauth: require('../lib/google-ads/oauth'),
    cryptoTok: require('../lib/google-ads/token-crypto')
  };
}

describe('google ads oauth security', () => {
  const saved = {};
  KEYS.forEach((k) => { saved[k] = process.env[k]; });

  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    reload();
  });

  it('requests required scopes and include_granted_scopes', () => {
    process.env.GOOGLE_ADS_CLIENT_ID = 'cid';
    process.env.GOOGLE_ADS_REDIRECT_URI = 'https://app.leadpages.com.au/api/integrations/google-ads/callback';
    const { cfg, oauth } = reload();
    const scopes = cfg.scopes();
    assert.ok(scopes.includes('openid'));
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.email'));
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.profile'));
    assert.ok(scopes.includes('https://www.googleapis.com/auth/adwords'));
    const { state } = oauth.makeState({ siteId: 's', userId: 'u' });
    const url = oauth.authorizeUrl(state);
    const u = new URL(url);
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('access_type'), 'offline');
    assert.equal(u.searchParams.get('include_granted_scopes'), 'true');
    assert.equal(u.searchParams.get('prompt'), 'consent');
    assert.equal(
      u.searchParams.get('redirect_uri'),
      'https://app.leadpages.com.au/api/integrations/google-ads/callback'
    );
  });

  it('signs state with nonce and rejects tampering / expiry', () => {
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = 'x'.repeat(32);
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'secret';
    const { oauth } = reload();
    const { state, nonce } = oauth.makeState({ siteId: 'site', userId: 'user' });
    assert.ok(nonce && nonce.length >= 16);
    const parsed = oauth.parseState(state);
    assert.equal(parsed.siteId, 'site');
    assert.equal(parsed.userId, 'user');
    assert.equal(parsed.n, nonce);
    assert.equal(oauth.parseState(state + 'x'), null);
    assert.equal(oauth.parseState(state, -1), null);
  });

  it('refuses plaintext token storage without encryption key', () => {
    delete process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY;
    const { cryptoTok } = reload();
    assert.equal(cryptoTok.encryptionConfigured(), false);
    assert.throws(() => cryptoTok.encryptSecret('refresh-token'), /ENCRYPTION_KEY|plaintext/i);
  });

  it('encrypts and decrypts with AES-GCM enc:v1 blobs', () => {
    process.env.GOOGLE_ADS_OAUTH_ENCRYPTION_KEY = 'unit-test-encryption-key-32chars!!';
    const { cryptoTok } = reload();
    const blob = cryptoTok.encryptSecret('refresh-token-value');
    assert.ok(blob.startsWith('enc:v1:'));
    assert.equal(cryptoTok.decryptSecret(blob), 'refresh-token-value');
  });
});
