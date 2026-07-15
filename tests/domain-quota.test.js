const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDomainQuota } = require('../lib/domain-quota');

describe('domain-quota evaluateDomainQuota', () => {
  it('is ok below soft limit', () => {
    const r = evaluateDomainQuota(12, { softLimit: 80, hardLimit: 100 });
    assert.equal(r.decision, 'ok');
    assert.equal(r.count, 12);
    assert.equal(r.softLimit, 80);
    assert.equal(r.hardLimit, 100);
  });

  it('warns at soft limit', () => {
    const r = evaluateDomainQuota(80, { softLimit: 80, hardLimit: 100 });
    assert.equal(r.decision, 'warn');
    assert.match(r.message, /Approaching/);
  });

  it('is critical at hard limit', () => {
    const r = evaluateDomainQuota(100, { softLimit: 80, hardLimit: 100 });
    assert.equal(r.decision, 'critical');
    assert.match(r.message, /hard awareness/);
  });

  it('disables thresholds when soft/hard are 0', () => {
    assert.equal(evaluateDomainQuota(999, { softLimit: 0, hardLimit: 0 }).decision, 'ok');
    assert.equal(evaluateDomainQuota(999, { softLimit: 0, hardLimit: 0 }).softLimit, null);
  });
});
