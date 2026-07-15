const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeApex,
  wwwHost,
  classifyProjectDomainResult,
  attachHostsToProject
} = require('../lib/vercel-project-domain');

describe('vercel-project-domain helpers', () => {
  it('normalizes apex hosts', () => {
    assert.equal(normalizeApex('HTTPS://WWW.Example.COM.AU/path'), 'example.com.au');
    assert.equal(wwwHost('example.com.au'), 'www.example.com.au');
  });

  it('classifies successful add and already-exists errors', () => {
    assert.equal(classifyProjectDomainResult({ name: 'a.com', verified: true }, false).status, 'added');
    assert.equal(classifyProjectDomainResult({ name: 'a.com', verified: false }, false).status, 'pending');
    const already = classifyProjectDomainResult(
      {
        status: 400,
        message: 'Domain already exists on this project',
        data: { error: { code: 'domain_already_in_use', message: 'already' } }
      },
      true
    );
    assert.equal(already.status, 'already_exists');
  });

  it('classifies quota and not-configured', () => {
    assert.equal(
      classifyProjectDomainResult({ code: 'no_token', message: 'VERCEL_TOKEN is not configured' }, true)
        .code,
      'not_configured'
    );
    assert.equal(
      classifyProjectDomainResult(
        { status: 402, message: 'Domain limit reached for this plan', data: {} },
        true
      ).code,
      'quota_exceeded'
    );
  });

  it('attachHostsToProject treats already_exists as success path', async () => {
    const calls = [];
    const fake = {
      async addProjectDomain(name) {
        calls.push(name);
        if (name.startsWith('www.')) {
          const err = new Error('already');
          err.status = 400;
          err.data = { error: { message: 'Domain already exists' } };
          throw err;
        }
        return { name, verified: true };
      },
      async getProjectDomain(name) {
        return { name, verified: true };
      }
    };
    const r = await attachHostsToProject(fake, 'https://www.Acme.com.au/', {});
    assert.deepEqual(calls, ['acme.com.au', 'www.acme.com.au']);
    assert.equal(r.apex.status, 'added');
    assert.equal(r.www.status, 'already_exists');
  });
});
