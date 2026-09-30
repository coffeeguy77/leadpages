/**
 * Billing cron must never delete sites or Cloudinary images.
 * Images are removed only on explicit site/account delete in Manage.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cron = fs.readFileSync(path.join(root, 'api/billing/cron.js'), 'utf8');
const accounting = fs.readFileSync(path.join(root, 'api/billing/accounting.js'), 'utf8');
const billingAdmin = fs.readFileSync(path.join(root, 'billing-admin.html'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

describe('billing: no automatic image / site deletion', () => {
  it('cron accrues contra only and never flags or deletes', () => {
    assert.match(cron, /MUST NEVER delete sites, Cloudinary assets/);
    assert.match(cron, /autoDelete:\s*false/);
    assert.match(cron, /accrueOwner/);
    assert.doesNotMatch(cron, /flagged_deletion/);
    assert.doesNotMatch(cron, /require\(['"][^'"]*cloudinary/i);
    assert.doesNotMatch(cron, /\.from\(['"]sites['"]\)[\s\S]{0,80}\.update\(/);
    assert.doesNotMatch(cron, /\.delete\(/);
  });

  it('accounting exposes a manual review queue + no-auto-delete policy', () => {
    assert.match(accounting, /review_queue/);
    assert.match(accounting, /auto_delete_images:\s*false/);
    assert.match(accounting, /manual_site_or_account_delete/);
  });

  it('accounting dashboard shows review queue and manual-delete copy', () => {
    assert.match(billingAdmin, /Accounts needing review/);
    assert.match(billingAdmin, /Nothing here is auto-deleted/);
    assert.match(billingAdmin, /review-list/);
    assert.match(billingAdmin, /Open → delete in Settings/);
  });

  it('Manage deletes Cloudinary only inside deleteSiteNow; no auto-delete extend UI', () => {
    assert.match(manage, /cwDeletePrefix\('leadpages\/'\+cwSiteSeg\(\)/);
    assert.match(manage, /Images are removed only on explicit site\/account delete/);
    assert.match(manage, /deleted \(images removed\)/);
    assert.doesNotMatch(manage, /Auto-delete extended/);
    assert.doesNotMatch(manage, /bl-extend/);
  });
});
