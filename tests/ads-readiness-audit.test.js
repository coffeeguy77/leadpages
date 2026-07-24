'use strict';

const assert = require('assert');
const { runReadinessAudit, primaryFromEventRoles } = require('../lib/google-ads/readiness');

assert.deepEqual(primaryFromEventRoles({ form_submission: 'primary', call_click: 'primary', email_click: 'secondary' }), [
  'form_submit',
  'phone_click'
]);

const site = {
  business_name: 'Bean Culture',
  custom_domain: 'coffeeevents.com.au',
  config: { analytics: { gaId: 'G-H25DWT5M7F' } }
};

// No plan → landing is warn (not fail); event_roles satisfy primary conversion
const a = runReadinessAudit({
  site: site,
  adsConn: {
    customer_id: '8375352023',
    connection_status: 'connected',
    event_roles: { form_submission: 'primary', call_click: 'primary' },
    tag_id: null
  },
  ga4Conn: { provider: 'ga4' },
  gtmConn: { connection_status: 'connected' },
  plan: null,
  stats: { form_submit: 2, phone_click: 1 }
});
assert.equal(a.overall, 'warn');
assert.equal(a.canPublish, true);
const landing = a.checks.find((c) => c.id === 'landing');
assert.equal(landing.status, 'warn');
const primary = a.checks.find((c) => c.id === 'primary_conversion');
assert.equal(primary.status, 'pass');
const tag = a.checks.find((c) => c.id === 'google_tag');
assert.equal(tag.status, 'warn');

// Plan with landing → pass landing
const b = runReadinessAudit({
  site: site,
  adsConn: {
    customer_id: '1',
    connection_status: 'connected',
    event_roles: { form_submission: 'primary' },
    tag_id: 'AW-123'
  },
  plan: {
    primaryDomain: 'coffeeevents.com.au',
    conversionGoals: { primary: ['form_submit'] },
    adGroups: [{ finalUrl: 'https://coffeeevents.com.au/coffee-cart-hire' }]
  },
  stats: { form_submit: 1, phone_click: 1 }
});
assert.equal(b.overall, 'warn'); // ads↔ga4 always warn without both oauth verified
assert.equal(b.checks.find((c) => c.id === 'landing').status, 'pass');
assert.equal(b.checks.find((c) => c.id === 'google_tag').status, 'pass');

console.log('ads-readiness-audit.test.js: ok');
