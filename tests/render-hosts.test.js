/**
 * Host classification for tenant render + Live Preview.
 * Ensures app.leadpages.com.au is never treated as partner showcase "app".
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePrimaryHosts,
  isPrimaryHost,
  showcaseSlugFromHost,
  BUILTIN_PRIMARY_HOSTS
} = require('../lib/render-hosts');

describe('resolvePrimaryHosts', () => {
  it('always includes app.leadpages.com.au even when env omits it', () => {
    const hosts = resolvePrimaryHosts('leadpages.webculture.au,leadpages.com.au');
    assert.ok(hosts.includes('app.leadpages.com.au'));
    assert.ok(hosts.includes('leadpages.com.au'));
    assert.ok(hosts.includes('leadpages.webculture.au'));
  });

  it('merges custom env hosts without dropping builtins', () => {
    const hosts = resolvePrimaryHosts('staging.example.com');
    assert.ok(hosts.includes('staging.example.com'));
    for (const h of BUILTIN_PRIMARY_HOSTS) assert.ok(hosts.includes(h));
  });
});

describe('isPrimaryHost', () => {
  it('treats app.leadpages.com.au as primary', () => {
    const hosts = resolvePrimaryHosts('leadpages.com.au');
    assert.equal(isPrimaryHost('app.leadpages.com.au', hosts), true);
  });

  it('treats marketing hosts as primary', () => {
    const hosts = resolvePrimaryHosts('');
    assert.equal(isPrimaryHost('leadpages.com.au', hosts), true);
    assert.equal(isPrimaryHost('www.leadpages.com.au', hosts), true);
  });

  it('treats real custom domains as non-primary', () => {
    const hosts = resolvePrimaryHosts('');
    assert.equal(isPrimaryHost('acmeplumbing.com.au', hosts), false);
    assert.equal(isPrimaryHost('shaun.leadpages.com.au', hosts), false);
  });
});

describe('showcaseSlugFromHost', () => {
  const bases = ['leadpages.com.au', 'leadpages.webculture.au'];
  const primary = resolvePrimaryHosts('leadpages.com.au');

  it('does not treat app.leadpages.com.au as partner slug "app"', () => {
    assert.equal(
      showcaseSlugFromHost('app.leadpages.com.au', { primaryHosts: primary, showcaseBases: bases }),
      null
    );
  });

  it('does not treat www.leadpages.com.au as a showcase', () => {
    assert.equal(
      showcaseSlugFromHost('www.leadpages.com.au', { primaryHosts: primary, showcaseBases: bases }),
      null
    );
  });

  it('resolves real partner subdomains', () => {
    assert.deepEqual(
      showcaseSlugFromHost('localwebsiteco.leadpages.com.au', { primaryHosts: primary, showcaseBases: bases }),
      { slug: 'localwebsiteco', base: 'leadpages.com.au' }
    );
  });

  it('skips other reserved labels (api, manage, …)', () => {
    assert.equal(
      showcaseSlugFromHost('api.leadpages.com.au', { primaryHosts: primary, showcaseBases: bases }),
      null
    );
    assert.equal(
      showcaseSlugFromHost('manage.leadpages.com.au', { primaryHosts: primary, showcaseBases: bases }),
      null
    );
  });
});
