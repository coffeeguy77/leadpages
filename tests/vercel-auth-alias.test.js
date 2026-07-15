const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

describe('vercel client auth alias', () => {
  const prev = {
    TOKEN: process.env.VERCEL_TOKEN,
    ACCESS: process.env.VERCEL_ACCESS_TOKEN,
    PROJECT: process.env.VERCEL_PROJECT_ID
  };

  after(() => {
    if (prev.TOKEN == null) delete process.env.VERCEL_TOKEN;
    else process.env.VERCEL_TOKEN = prev.TOKEN;
    if (prev.ACCESS == null) delete process.env.VERCEL_ACCESS_TOKEN;
    else process.env.VERCEL_ACCESS_TOKEN = prev.ACCESS;
    if (prev.PROJECT == null) delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = prev.PROJECT;
    delete require.cache[require.resolve('../api/vercel/_client')];
  });

  it('accepts VERCEL_ACCESS_TOKEN when VERCEL_TOKEN is unset', () => {
    delete process.env.VERCEL_TOKEN;
    process.env.VERCEL_ACCESS_TOKEN = 'access-xyz';
    process.env.VERCEL_PROJECT_ID = 'prj_test';
    delete require.cache[require.resolve('../api/vercel/_client')];
    const v = require('../api/vercel/_client');
    assert.equal(v.authToken(), 'access-xyz');
    assert.equal(v.isConfigured(), true);
    assert.equal(v.projectConfigured(), true);
    assert.equal(typeof v.addProjectDomain, 'function');
    assert.equal(typeof v.listProjectDomains, 'function');
  });

  it('prefers VERCEL_TOKEN over ACCESS', () => {
    process.env.VERCEL_TOKEN = 'token-primary';
    process.env.VERCEL_ACCESS_TOKEN = 'access-secondary';
    delete require.cache[require.resolve('../api/vercel/_client')];
    const v = require('../api/vercel/_client');
    assert.equal(v.authToken(), 'token-primary');
  });
});
