'use strict';

const assert = require('assert');
const {
  coffeeEventsPilotDefaults,
  planForPage,
  publishedPages
} = require('../lib/google-ads/planner');
const { normalizeEventName, isAllowedEvent } = require('../lib/tracking/events-contract');

const site = {
  custom_domain: 'coffeeevents.com.au',
  business_name: 'Coffee Events',
  config: {
    domain: 'coffeeevents.com.au',
    city: 'Canberra',
    sections: {
      services: {
        items: [{ on: true, title: 'Coffee Cart Hire', body: 'Mobile coffee cart hire' }]
      }
    },
    pages: [
      { id: 'p1', slug: 'coffee-cart-hire', title: 'Coffee Cart Hire', status: 'published' }
    ]
  }
};

const pages = publishedPages(site);
assert.equal(pages.length, 1);

const plan = planForPage(site, pages[0], { service: 'Coffee Cart Hire', geo: 'Canberra', budgetDaily: 40 });
assert.ok(plan.campaignName);
assert.equal(plan.budgetDaily, 40);
assert.ok(plan.adGroups && plan.adGroups[0]);
assert.ok(String(plan.adGroups[0].finalUrl).includes('coffeeevents.com.au'));
assert.equal(plan.statusOnCreate || 'PAUSED', 'PAUSED');

const pilot = coffeeEventsPilotDefaults(site, pages[0], 55);
assert.equal(pilot.pilot.siteHint, 'coffeeevents.com.au');
assert.ok(pilot.pilot.protectExternalDomains.indexOf('beanculture.com.au') >= 0);
assert.equal(pilot.budgetDaily, 55);
assert.ok(/Coffee Cart Hire/i.test(pilot.campaignName));
assert.ok(/Canberra/i.test(pilot.campaignName + ' ' + (pilot.geoFocus || '')));

assert.equal(normalizeEventName('call_click'), 'phone_click');
assert.equal(normalizeEventName('lead_submit'), 'form_submit');
assert.equal(isAllowedEvent('form_submit'), true);
assert.equal(isAllowedEvent('phone_click'), true);

console.log('ads-campaign-builder-planner.test.js: ok');
