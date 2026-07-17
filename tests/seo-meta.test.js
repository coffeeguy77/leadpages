'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  clipSeoTitle,
  clipSeoDescription,
  buildCanonicalUrl,
  landingPageTitle
} = require('../lib/seo/meta');

describe('lib/seo/meta', () => {
  it('clips long titles without cutting mid-word when possible', () => {
    const long = 'Heavy Vehicle Repairs Canberra | RTT Truck and Track — RTT Truck And Track Extra Words';
    const out = clipSeoTitle(long);
    assert.ok(out.length <= 61);
    assert.ok(out.endsWith('…'));
    assert.ok(!out.includes('Track Extra'));
  });

  it('clips long descriptions', () => {
    const long = 'RTT Truck and Track provides earthmoving equipment repairs, servicing and diesel diagnostics in Canberra for excavators, loaders, skid steers, dozers and heavy machinery across the ACT region.';
    const out = clipSeoDescription(long);
    assert.ok(out.length <= 156);
    assert.ok(out.endsWith('…'));
  });

  it('builds www-preserving per-page canonicals on custom domains', () => {
    const site = { slug: 'rtt', custom_domain: 'rttruckandtrack.com.au' };
    assert.equal(
      buildCanonicalUrl('www.rttruckandtrack.com.au', site, 'earthmoving-equipment-repairs-canberra', true),
      'https://www.rttruckandtrack.com.au/earthmoving-equipment-repairs-canberra'
    );
    assert.equal(
      buildCanonicalUrl('www.rttruckandtrack.com.au', site, '', true),
      'https://www.rttruckandtrack.com.au/'
    );
  });

  it('builds path canonicals on platform hosts', () => {
    const site = { slug: 'rtt-truck' };
    assert.equal(
      buildCanonicalUrl('leadpages.com.au', site, 'heavy-vehicle-repairs-canberra', false),
      'https://leadpages.com.au/rtt-truck/heavy-vehicle-repairs-canberra'
    );
  });

  it('avoids duplicating business name in landing titles', () => {
    assert.equal(
      landingPageTitle('Heavy Vehicle Repairs Canberra — RTT Truck And Track', 'RTT Truck And Track'),
      'Heavy Vehicle Repairs Canberra — RTT Truck And Track'
    );
    assert.equal(
      landingPageTitle('Heavy Vehicle Repairs Canberra', 'RTT Truck And Track'),
      'Heavy Vehicle Repairs Canberra — RTT Truck And Track'
    );
  });
});
