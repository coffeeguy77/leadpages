const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PARTNER_TEMPLATES, normalizeTemplateKey } = require('../../lib/partner-templates/registry');
const { buildPartnerLandingHtml } = require('../../lib/partner-templates');
const { buildLocalWebsiteCoWebsiteProfile } = require('../../lib/partner-website/local-website-co-profile');
const { validateWebsiteProfile } = require('../../lib/partner-website/validate');

function localProfile(templateKey) {
  const wp = validateWebsiteProfile(buildLocalWebsiteCoWebsiteProfile());
  return {
    partner_id: 'p-local',
    showcase_headline: wp.positioning.heroHeadline,
    support_email: 'shaun@example.com',
    support_phone: '0400 000 000',
    showcase_config: {
      templateKey: templateKey || 'localwebsiteco',
      websiteProfile: wp,
      intro: wp.positioning.heroSupporting
    }
  };
}

const partner = {
  id: 'p-local',
  display_name: 'Shaun Matthews',
  email: 'shaun@example.com',
  phone: '0400 000 000'
};

test('registry — has Culture first and Local Website Co. second', function() {
  assert.equal(PARTNER_TEMPLATES.length, 2);
  assert.equal(PARTNER_TEMPLATES[0].id, 'webculture');
  assert.equal(PARTNER_TEMPLATES[1].id, 'localwebsiteco');
  assert.equal(normalizeTemplateKey('localwebsiteco'), 'localwebsiteco');
  assert.equal(normalizeTemplateKey('unknown-template'), 'webculture');
});

test('buildPartnerLandingHtml — renders Local Website Co. template', function() {
  const html = buildPartnerLandingHtml(localProfile('localwebsiteco'), partner, [], 'leadpages.com.au', { showTemplateSwitcher: false });
  assert.ok(html.includes('lwc-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('A better website, built by someone who knows your business.'));
  assert.ok(html.includes('Websites powered by LeadPages'));
  assert.ok(html.includes('From first chat to live website.'));
  assert.ok(html.includes('Questions before we chat?'));
  assert.ok(html.includes('Powered by <strong>LeadPages</strong>'));
  assert.ok(!/\sclass="[^"]*\bwc-body\b/.test(html));
  assert.ok(!html.includes('/assets/partner-templates/webculture.css'));
});

test('buildPartnerLandingHtml — default still renders Web Culture', function() {
  const html = buildPartnerLandingHtml({
    showcase_config: {},
    showcase_headline: 'Test headline'
  }, { display_name: 'Test Partner' }, [], 'leadpages.com.au', { showTemplateSwitcher: false });
  assert.ok(html.includes('wc-body'));
  assert.ok(html.includes('data-pt-template="webculture"'));
  assert.ok(!html.includes('lwc-body'));
});

test('buildPartnerLandingHtml — templateOverride selects Local Website Co.', function() {
  const html = buildPartnerLandingHtml(localProfile('webculture'), partner, [], 'leadpages.com.au', {
    templateOverride: 'localwebsiteco',
    showTemplateSwitcher: true
  });
  assert.ok(html.includes('lwc-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('pt-tpl-bar'));
});
