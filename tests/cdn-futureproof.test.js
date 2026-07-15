const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { limited } = require('../api/_rate-limit');
const { cacheTagForSlug, cacheTagForSiteId } = require('../api/vercel/_client');

describe('cdn futureproof helpers', () => {
  it('builds safe vercel cache tags', () => {
    assert.equal(cacheTagForSlug("Joe's Plumbing!!"), 'lp-site-joe-s-plumbing');
    assert.equal(cacheTagForSiteId('AbC-123'), 'lp-siteid-abc-123');
    assert.equal(cacheTagForSlug(''), '');
  });

  it('rate-limits by IP after max hits', () => {
    const req = { headers: { 'x-forwarded-for': '9.9.9.9' } };
    let blocked = 0;
    for (let i = 0; i < 12; i++) {
      if (limited(req, { key: 'unit-test', max: 10, windowMs: 60000 })) blocked++;
    }
    assert.equal(blocked, 2);
  });
});
