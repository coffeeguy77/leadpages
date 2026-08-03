/**
 * Instagram OAuth must use the Meta-registered www redirect URI by default.
 * Using APP_URL (app.leadpages.com.au) caused redirect_uri mismatches and
 * cross-origin exchange failures after the editor moved to the app host.
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEYS = ['INSTAGRAM_REDIRECT_URI', 'APP_URL', 'VERCEL_ENV', 'VERCEL_URL'];

function reloadOAuth() {
  delete require.cache[require.resolve('../lib/instagram-oauth')];
  return require('../lib/instagram-oauth');
}

describe('instagramRedirectUri', () => {
  const saved = {};
  beforeEach(() => {
    KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    reloadOAuth();
  });

  it('defaults to www.leadpages.com.au callback (not APP_URL)', () => {
    process.env.APP_URL = 'https://app.leadpages.com.au';
    process.env.VERCEL_ENV = 'production';
    const { instagramRedirectUri, DEFAULT_IG_REDIRECT } = reloadOAuth();
    assert.equal(DEFAULT_IG_REDIRECT, 'https://www.leadpages.com.au/api/instagram/callback');
    assert.equal(instagramRedirectUri(), DEFAULT_IG_REDIRECT);
    assert.doesNotMatch(instagramRedirectUri(), /app\.leadpages\.com\.au/);
  });

  it('honours INSTAGRAM_REDIRECT_URI when set', () => {
    process.env.INSTAGRAM_REDIRECT_URI = 'https://www.leadpages.com.au/api/instagram/callback/';
    const { instagramRedirectUri } = reloadOAuth();
    assert.equal(instagramRedirectUri(), 'https://www.leadpages.com.au/api/instagram/callback');
  });
});

describe('instagram API modules', () => {
  it('connect + exchange use instagramRedirectUri helper', () => {
    const connect = fs.readFileSync(path.join(ROOT, 'api/instagram/connect.js'), 'utf8');
    const exchange = fs.readFileSync(path.join(ROOT, 'api/instagram/exchange.js'), 'utf8');
    assert.match(connect, /instagramRedirectUri/);
    assert.match(exchange, /instagramRedirectUri/);
    assert.doesNotMatch(connect, /appUrl\(\)\s*\+\s*['"]\/api\/instagram\/callback['"]/);
    assert.doesNotMatch(exchange, /appUrl\(\)\s*\+\s*['"]\/api\/instagram\/callback['"]/);
  });

  it('callback exchanges on same origin and returns to APP_URL manage', () => {
    const cb = fs.readFileSync(path.join(ROOT, 'api/instagram/callback.js'), 'utf8');
    assert.match(cb, /exchangeUrl\s*=\s*['"]\/api\/instagram\/exchange['"]/);
    assert.match(cb, /appPath\(['"]\/manage['"]\)/);
    assert.doesNotMatch(cb, /appPath\(['"]\/api\/instagram\/exchange['"]\)/);
  });
});

describe('editor Instagram connect UI', () => {
  const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');

  it('exposes connect on Instagram Gallery and Instagram Feed', () => {
    assert.match(manage, /function igConnectCard\(/);
    assert.match(manage, /function wireIgConnect\(/);
    assert.match(manage, /sub==='instaGallery'[\s\S]*?igConnectCard\(/);
    assert.match(manage, /sub==='instaGallery'[\s\S]*?wireIgConnect\(\)/);
    assert.match(manage, /sub==='igProjectFeed'[\s\S]*?igConnectCard\(/);
    assert.match(manage, /sub==='igProjectFeed'[\s\S]*?wireIgConnect\(\)/);
    assert.doesNotMatch(
      manage,
      /Connect Instagram in the Instagram Feed section/
    );
  });
});
