'use strict';

const assert = require('assert');
const dataforseo = require('../lib/search-intelligence/providers/dataforseo');

assert.equal(typeof dataforseo.searchVolume, 'function');
assert.equal(typeof dataforseo.configured, 'function');

// Without credentials → clear not_configured (never invents rows)
const prevLogin = process.env.DATAFORSEO_LOGIN;
const prevPass = process.env.DATAFORSEO_PASSWORD;
const prevEmail = process.env.DATAFORSEO_EMAIL;
const prevApi = process.env.DATAFORSEO_API_PASSWORD;
delete process.env.DATAFORSEO_LOGIN;
delete process.env.DATAFORSEO_PASSWORD;
delete process.env.DATAFORSEO_EMAIL;
delete process.env.DATAFORSEO_API_PASSWORD;

assert.equal(dataforseo.configured(), false);

(async () => {
  const r = await dataforseo.searchVolume({
    keywords: ['coffee van hire canberra', 'bean culture'],
    location: 'Canberra'
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_configured');
  assert.match(String(r.message || ''), /DATAFORSEO/i);

  if (prevLogin == null) delete process.env.DATAFORSEO_LOGIN;
  else process.env.DATAFORSEO_LOGIN = prevLogin;
  if (prevPass == null) delete process.env.DATAFORSEO_PASSWORD;
  else process.env.DATAFORSEO_PASSWORD = prevPass;
  if (prevEmail == null) delete process.env.DATAFORSEO_EMAIL;
  else process.env.DATAFORSEO_EMAIL = prevEmail;
  if (prevApi == null) delete process.env.DATAFORSEO_API_PASSWORD;
  else process.env.DATAFORSEO_API_PASSWORD = prevApi;

  console.log('ads-dataforseo-search-volume.test.js: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
