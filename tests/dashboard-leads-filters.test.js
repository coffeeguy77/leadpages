/**
 * Dashboard Captured Leads — filters, spam blocklist, source labels.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  isLeadBlocked,
  addBlock,
  removeBlock,
  normalizeInbox
} = require('../lib/lead-blocklist');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const themes = fs.readFileSync(path.join(root, 'assets/lp-themes.css'), 'utf8');
const leadsApi = fs.readFileSync(path.join(root, 'api/leads.js'), 'utf8');
const crm = fs.readFileSync(path.join(root, 'lib/quote-system/crm.js'), 'utf8');

// Blocklist unit
assert.deepStrictEqual(normalizeInbox(null).blockedEmails, []);
assert.ok(isLeadBlocked({ email: 'a@bad.com' }, { blockedEmails: ['a@bad.com'] }).blocked);
assert.ok(isLeadBlocked({ email: 'x@spam.co' }, { blockedDomains: ['spam.co'] }).blocked);
assert.ok(isLeadBlocked({ email: 'x@mail.spam.co' }, { blockedDomains: ['spam.co'] }).blocked);
assert.ok(isLeadBlocked({ country: 'ru' }, { blockedCountries: ['ru'] }).blocked);
assert.ok(!isLeadBlocked({ email: 'ok@good.com' }, { blockedDomains: ['spam.co'] }).blocked);
var inbox = addBlock({}, 'domain', '*.Evil.COM');
assert.ok(inbox.blockedDomains.indexOf('evil.com') >= 0);
inbox = removeBlock(inbox, 'domain', 'evil.com');
assert.ok(inbox.blockedDomains.indexOf('evil.com') < 0);

// Manage UI
assert.ok(manage.includes('dash-leads-filters'), 'filter toolbar host');
assert.ok(manage.includes('Website Enquiries'), 'website filter label');
assert.ok(manage.includes('Quote System'), 'quote filter label');
assert.ok(manage.includes("data-dash-filter=\"spam\"") || manage.includes("data-dash-filter='spam'") || manage.includes('dash-leads-spam'), 'spam filter control');
assert.ok(manage.includes('dash-leads-dot'), 'new-lead notification dot');
assert.ok(manage.includes('DASH_LEADS.quoteEnabled'), 'quote filter gated on enabled');
assert.ok(manage.includes('_dashLeadSourceLabel') || manage.includes('Website enquiry'), 'source labels');
assert.ok(manage.includes('data-dash-lead-del'), 'delete control');
assert.ok(manage.includes('data-dash-lead-spam'), 'mark spam control');
assert.ok(manage.includes('leadInbox'), 'blocklist stored on site config');
assert.ok(manage.includes('blockedDomains'), 'domain wildcard filters');
assert.ok(manage.includes('blockedCountries'), 'country filters');
assert.ok(manage.includes('is-scroll') || manage.includes('dash-leads-list'), 'scrollable list when many leads');
assert.ok(manage.includes('_dashLeadDelete'), 'delete helper');
assert.ok(manage.includes('_dashLeadMarkSpam'), 'spam helper');

// CSS polish
assert.ok(themes.includes('.dash-leads-head'), 'leads header layout');
assert.ok(themes.includes('.lp-lead-card-inner'), 'desktop card flex');
assert.ok(themes.includes('.dash-leads-list.is-scroll'), 'scroll after many items');
assert.ok(themes.includes('.dash-lead-view'), 'view message spacing');
assert.ok(themes.includes('gap: 10px 14px') || themes.includes('.lp-lead-card-actions'), 'action gap');

// Ingest respects blocklist
assert.ok(leadsApi.includes('isLeadBlocked'), 'website leads check blocklist');
assert.ok(leadsApi.includes("skipped: 'blocked'"), 'blocked ingest returns soft skip');
assert.ok(crm.includes('isLeadBlocked'), 'quote CRM checks blocklist');

console.log('dashboard-leads-filters.test.js: ok');
