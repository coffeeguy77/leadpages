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
const ga4link = a.checks.find((c) => c.id === 'ads_ga4_link');
assert.equal(ga4link.status, 'warn');

// Confirmed Ads↔GA4 → pass that check; still warn overall if tag missing
const a2 = runReadinessAudit({
  site: site,
  adsConn: {
    customer_id: '8375352023',
    connection_status: 'connected',
    event_roles: { form_submission: 'primary', call_click: 'primary' },
    tag_id: 'AW-1',
    ads_ga4_link_confirmed_at: '2026-07-24T12:00:00.000Z'
  },
  ga4Conn: { provider: 'ga4' },
  plan: null,
  stats: { form_submit: 2, phone_click: 1 }
});
assert.equal(a2.checks.find((c) => c.id === 'ads_ga4_link').status, 'pass');
assert.equal(a2.checks.find((c) => c.id === 'google_tag').status, 'pass');
// landing still warn without plan
assert.equal(a2.overall, 'warn');

// With plan + confirmed link + tag → overall pass (ads_ga4 no longer forces warn)
const passAll = runReadinessAudit({
  site: site,
  adsConn: {
    customer_id: '1',
    connection_status: 'connected',
    event_roles: { form_submission: 'primary' },
    tag_id: 'AW-123',
    ads_ga4_link_confirmed_at: '2026-07-24T12:00:00.000Z'
  },
  ga4Conn: { provider: 'ga4' },
  plan: {
    primaryDomain: 'coffeeevents.com.au',
    conversionGoals: { primary: ['form_submit'] },
    adGroups: [{ finalUrl: 'https://coffeeevents.com.au/coffee-cart-hire' }]
  },
  stats: { form_submit: 1, phone_click: 1 }
});
assert.equal(passAll.overall, 'pass');
assert.equal(passAll.canPublish, true);

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
assert.equal(b.overall, 'warn'); // ads↔ga4 not confirmed yet
assert.equal(b.checks.find((c) => c.id === 'landing').status, 'pass');
assert.equal(b.checks.find((c) => c.id === 'google_tag').status, 'pass');

console.log('ads-readiness-audit.test.js: ok');
