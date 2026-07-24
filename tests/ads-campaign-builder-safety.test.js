'use strict';

const assert = require('assert');
const {
  assertSingleFinalUrlDomain,
  assertCampaignMutable,
  dailyToImpliedMonthly,
  hostNorm
} = require('../lib/google-ads/safety');

assert.equal(hostNorm('https://www.CoffeeEvents.com.au/hire'), 'coffeeevents.com.au');

const ok = assertSingleFinalUrlDomain(['https://coffeeevents.com.au/coffee-cart-hire']);
assert.equal(ok.ok, true);
assert.equal(ok.domain, 'coffeeevents.com.au');

const mixed = assertSingleFinalUrlDomain([
  'https://coffeeevents.com.au/a',
  'https://beanculture.com.au/b'
]);
assert.equal(mixed.ok, false);
assert.equal(mixed.error, 'mixed_final_url_domains');

const imported = assertCampaignMutable(
  { site_id: 's1', ownership: 'imported' },
  { siteId: 's1', confirmExternal: false }
);
assert.equal(imported.ok, false);
assert.equal(imported.error, 'external_campaign_confirm_required');

const confirmed = assertCampaignMutable(
  { site_id: 's1', ownership: 'imported' },
  { siteId: 's1', confirmExternal: true }
);
assert.equal(confirmed.ok, true);

const owned = assertCampaignMutable(
  { site_id: 's1', ownership: 'leadpages_created' },
  { siteId: 's1' }
);
assert.equal(owned.ok, true);

const monthly = dailyToImpliedMonthly(40);
assert.equal(monthly.avgDays30, 1200);
assert.ok(monthly.googleAvgMonthlyMax > 1200);

console.log('ads-campaign-builder-safety.test.js: ok');
