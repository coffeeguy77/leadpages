'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const themes = fs.readFileSync(path.join(root, 'assets/lp-themes.css'), 'utf8');
const embed = fs.readFileSync(path.join(root, 'assets/lp-messages-embed.js'), 'utf8');
const clickApi = fs.readFileSync(path.join(root, 'api/site/support-contact-click.js'), 'utf8');
const activityApi = fs.readFileSync(path.join(root, 'api/partner/support-contact-activity.js'), 'utf8');
const supportApi = fs.readFileSync(path.join(root, 'api/site/support-contact.js'), 'utf8');
const partnerHtml = fs.readFileSync(path.join(root, 'partner.html'), 'utf8');
const partnersAdmin = fs.readFileSync(path.join(root, 'partners-admin.html'), 'utf8');

describe('Support contact badge theme + tracking', () => {
  it('uses site theme tokens instead of hardcoded white card', () => {
    assert.match(themes, /#lp-support-card\.lp-support-card/);
    assert.match(themes, /background:\s*var\(--panel/);
    assert.match(themes, /\.lp-sc-btn-msg/);
    assert.match(manage, /className='lp-support-card'|class="lp-support-card"/);
    assert.doesNotMatch(
      manage.slice(manage.indexOf('function lpRenderSupportContact'), manage.indexOf('function applyTemplateChrome')),
      /background:#fff/
    );
  });

  it('replaces email mailto with Message action that opens provider chat', () => {
    const fn = manage.slice(manage.indexOf('function lpRenderSupportContact'), manage.indexOf('function applyTemplateChrome'));
    assert.doesNotMatch(fn, /mailto:/);
    assert.match(fn, /lp-sc-msg/);
    assert.match(fn, /lpOpenSupportMessage/);
    assert.match(manage, /lpTrackSupportContactClick\('message'/);
    assert.match(embed, /async function openProvider\(prefill\)/);
    assert.match(embed, /await openProvider\(o\.prefill\)/);
    assert.match(manage, /open:\s*_open/);
  });

  it('keeps click-to-call and logs call clicks', () => {
    const fn = manage.slice(manage.indexOf('function lpRenderSupportContact'), manage.indexOf('function applyTemplateChrome'));
    assert.match(fn, /href="tel:/);
    assert.match(fn, /lpTrackSupportContactClick\('call'/);
  });

  it('stores clicks in partner_audit_logs via authenticated API', () => {
    assert.match(clickApi, /partner_audit_logs/);
    assert.match(clickApi, /support_contact_/);
    assert.match(clickApi, /owners only/);
    assert.match(activityApi, /support_contact_message/);
    assert.match(activityApi, /support_contact_call/);
    assert.match(supportApi, /id:\s*site\.servicing_partner_id/);
  });

  it('surfaces activity in partner console and partners admin', () => {
    assert.match(partnerHtml, /support-contact-activity/);
    assert.match(partnerHtml, /Client contact activity/);
    assert.match(partnersAdmin, /support_contact_/);
    assert.match(partnersAdmin, /clicked <strong>/);
  });
});
