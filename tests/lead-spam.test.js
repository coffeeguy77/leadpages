const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { assessLeadSpam, HONEYPOT_KEYS, MIN_MS } = require('../lib/lead-spam');

describe('lead-spam assessLeadSpam', () => {
  it('allows clean payloads and ignores legitimate website fields', () => {
    assert.deepEqual(
      assessLeadSpam({
        name: 'Sam Taylor',
        phone: '0412000000',
        website: 'https://samplumbing.com.au',
        details: { website: 'https://samplumbing.com.au', job: 'Blocked drain' }
      }),
      { spam: false }
    );
  });

  it('flags filled dedicated honeypot keys', () => {
    assert.equal(assessLeadSpam({ name: 'Bot', lp_hp: 'http://spam.example' }).reason, 'honeypot');
    assert.equal(assessLeadSpam({ name: 'Bot', honeypot: 'x' }).reason, 'honeypot');
    assert.equal(
      assessLeadSpam({ name: 'Bot', details: { lp_hp: 'filled' } }).reason,
      'honeypot_details'
    );
  });

  it('flags too-fast submits when _t is present', () => {
    const r = assessLeadSpam({ name: 'Quick', _t: Date.now() - 100 });
    assert.equal(r.spam, true);
    assert.equal(r.reason, 'too_fast');
  });

  it('allows old-enough _t and missing timing (cached pages)', () => {
    assert.deepEqual(
      assessLeadSpam({ name: 'Ok', _t: Date.now() - (MIN_MS + 50) }),
      { spam: false }
    );
    assert.deepEqual(assessLeadSpam({ name: 'Legacy', phone: '0412' }), { spam: false });
  });

  it('flags URL-like names', () => {
    assert.equal(assessLeadSpam({ name: 'https://evil.example' }).reason, 'name_url');
    assert.equal(assessLeadSpam({ name: 'www.spam.example' }).reason, 'name_url');
  });

  it('exports dedicated honeypot keys only', () => {
    assert.ok(HONEYPOT_KEYS.includes('lp_hp'));
    assert.ok(!HONEYPOT_KEYS.includes('website'));
  });
});
