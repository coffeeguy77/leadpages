const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const KEYS = ['APP_URL', 'GOOGLE_ADS_REDIRECT_URI', 'VERCEL_ENV', 'VERCEL_URL'];

function clearEnv() {
  KEYS.forEach((k) => { delete process.env[k]; });
}

function reload() {
  delete require.cache[require.resolve('../lib/app-url')];
  delete require.cache[require.resolve('../lib/google-ads/config')];
  return {
    appUrl: require('../lib/app-url'),
    cfg: require('../lib/google-ads/config')
  };
}

describe('app-url + google-ads redirect URI', () => {
  const saved = {};
  KEYS.forEach((k) => { saved[k] = process.env[k]; });

  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    reload();
  });

  it('defaults production APP_URL when VERCEL_ENV=production and APP_URL unset', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    const { appUrl } = reload();
    assert.equal(appUrl.appUrl(), appUrl.PROD_APP_URL);
  });

  it('does not use production callback on preview without APP_URL', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'leadpages-git-abc.vercel.app';
    const { appUrl, cfg } = reload();
    assert.equal(appUrl.appUrl(), 'https://leadpages-git-abc.vercel.app');
    assert.equal(
      cfg.oauthRedirectUri(),
      'https://leadpages-git-abc.vercel.app/api/integrations/google-ads/callback'
    );
    assert.notEqual(
      cfg.oauthRedirectUri(),
      'https://app.leadpages.com.au/api/integrations/google-ads/callback'
    );
  });

  it('honours explicit GOOGLE_ADS_REDIRECT_URI', () => {
    clearEnv();
    process.env.APP_URL = 'https://app.leadpages.com.au';
    process.env.GOOGLE_ADS_REDIRECT_URI = 'https://app.leadpages.com.au/api/integrations/google-ads/callback';
    const { cfg } = reload();
    assert.equal(
      cfg.oauthRedirectUri(),
      'https://app.leadpages.com.au/api/integrations/google-ads/callback'
    );
  });

  it('local default callback is localhost', () => {
    clearEnv();
    const { cfg } = reload();
    assert.equal(
      cfg.oauthRedirectUri(),
      'http://localhost:3000/api/integrations/google-ads/callback'
    );
  });

  it('safeReturnPath blocks open redirects', () => {
    clearEnv();
    const { appUrl } = reload();
    assert.equal(appUrl.safeReturnPath('https://evil.com'), '/settings/integrations/google-ads');
    assert.equal(appUrl.safeReturnPath('//evil.com'), '/settings/integrations/google-ads');
    assert.equal(appUrl.safeReturnPath('/settings/integrations/google-ads'), '/settings/integrations/google-ads');
  });
});
