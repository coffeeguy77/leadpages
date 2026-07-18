'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { looksLikeEmail, validateForApplication } = require('../lib/website-studio-application/validate');
const { MODES } = require('../lib/website-studio-application/permissions');

describe('Website Studio application validation UX', () => {
  it('rejects incomplete emails like a@.com', () => {
    assert.equal(looksLikeEmail('a@a.com'), true);
    assert.equal(looksLikeEmail('hello@business.com'), true);
    assert.equal(looksLikeEmail('a@.com'), false);
    assert.equal(looksLikeEmail('a@'), false);
    assert.equal(looksLikeEmail('not-an-email'), false);
  });

  it('blocks create when approval is only ready-for-review', () => {
    const result = validateForApplication({
      actor: { userId: 'u1', isSuperuser: true },
      draft: { id: 'd1', meta: { approvalState: 'ready-for-review' } },
      version: {
        id: 'v1',
        concept_json: {
          conceptId: 'c1',
          businessProfile: { businessName: 'Pink Diamond Vault', industry: 'Luxury Jewellery' },
          sectionOrder: ['hero'],
          approvalState: 'ready-for-review'
        },
        draft_config_json: {
          sectionOrder: ['hero'],
          sections: { hero: { on: true, title: 'Hello' } },
          seo: { title: 'Pink Diamond Vault' },
          __websiteComposer: { approvalState: 'ready-for-review', contentInheritance: 'none' }
        }
      },
      mode: MODES.CREATE_SITE,
      contactConfirmation: {
        businessEmail: 'hello@vault.test',
        leadRecipientEmail: 'leads@vault.test',
        confirmed: true
      },
      acknowledgeWarnings: true,
      imagePolicy: { allowTempUrls: true, allowUnapproved: true }
    });

    assert.equal(result.ok, false);
    assert.ok(result.critical.some((i) => i.code === 'not_approved'));
  });

  it('blocks invalid business email even when @ is present', () => {
    const result = validateForApplication({
      actor: { userId: 'u1', isSuperuser: true },
      draft: { id: 'd1', meta: { approvalState: 'approved-for-application' } },
      version: {
        id: 'v1',
        concept_json: {
          conceptId: 'c1',
          businessProfile: { businessName: 'Vault', industry: 'Luxury Jewellery' },
          sectionOrder: ['hero'],
          approvalState: 'approved-for-application'
        },
        draft_config_json: {
          sectionOrder: ['hero'],
          sections: { hero: { on: true, title: 'Hello' } },
          seo: { title: 'Vault' },
          __websiteComposer: { approvalState: 'approved-for-application', contentInheritance: 'none' }
        }
      },
      mode: MODES.CREATE_SITE,
      contactConfirmation: {
        businessEmail: 'a@.com',
        leadRecipientEmail: 'leads@vault.test',
        confirmed: true
      },
      acknowledgeWarnings: true,
      imagePolicy: { allowTempUrls: true, allowUnapproved: true }
    });

    assert.equal(result.ok, false);
    assert.ok(result.critical.some((i) => i.code === 'business_email_required'));
  });

  it('UI exposes save-options help and defaults approval for application', () => {
    const html = fs.readFileSync(path.join(ROOT, 'theme-studio-v2.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'assets/website-studio.js'), 'utf8');
    assert.match(html, /approved-for-application" selected/);
    assert.match(html, /ws-save-options-help/);
    assert.match(html, /What do the save \/ create buttons do/);
    assert.match(js, /clientApplicationPreflight/);
    assert.match(js, /paintApplicationValidation/);
    assert.match(js, /validation\.critical/);
    assert.ok(fs.existsSync(path.join(ROOT, 'docs/website-studio/SAVE-OPTIONS.md')));
  });
});
