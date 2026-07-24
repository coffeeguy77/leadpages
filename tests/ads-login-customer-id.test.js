'use strict';

const assert = require('assert');

function withEnv(map, fn) {
  const prev = {};
  Object.keys(map).forEach((k) => {
    prev[k] = process.env[k];
    if (map[k] === undefined) delete process.env[k];
    else process.env[k] = map[k];
  });
  try {
    return fn();
  } finally {
    Object.keys(map).forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  }
}

withEnv({ GOOGLE_ADS_LOGIN_CUSTOMER_ID: '386-242-0047' }, () => {
  // Reload modules so config picks up env for this process.
  delete require.cache[require.resolve('../lib/google-ads/config')];
  delete require.cache[require.resolve('../lib/google-ads/client')];
  const { resolveLoginCustomerId, digits } = require('../lib/google-ads/client');

  assert.equal(digits('386-242-0047'), '3862420047');
  assert.equal(resolveLoginCustomerId({ customer_id: '8375352023' }), '3862420047');
  assert.equal(
    resolveLoginCustomerId({ customer_id: '8375352023', login_customer_id: '1112223333' }),
    '1112223333'
  );
  assert.equal(resolveLoginCustomerId({ customer_id: '8375352023' }, '9998887777'), '9998887777');
});

withEnv({ GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined }, () => {
  delete require.cache[require.resolve('../lib/google-ads/config')];
  delete require.cache[require.resolve('../lib/google-ads/client')];
  const { resolveLoginCustomerId } = require('../lib/google-ads/client');
  assert.equal(resolveLoginCustomerId({ customer_id: '8375352023' }), '8375352023');
});

console.log('ads-login-customer-id.test.js: ok');
