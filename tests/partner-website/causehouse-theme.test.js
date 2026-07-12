const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupServicesByCategory } = require('../../lib/partner-website/causehouse-theme');
const { resolvePartnerThemeContent } = require('../../lib/partner-website/resolver');
const { buildWebCultureWebsiteProfile } = require('../../lib/partner-website/web-culture-profile');
const { validateWebsiteProfile } = require('../../lib/partner-website/validate');
const { build } = require('../../lib/partner-templates/causehouse');

test('groupServicesByCategory — returns at most four categories', function() {
  const services = [
    { key: 'new-websites', name: 'New business websites', description: 'x' },
    { key: 'quote-forms', name: 'Quote forms', description: 'x' },
    { key: 'crm', name: 'CRM integrations', description: 'x' },
    { key: 'seo-content', name: 'SEO content', description: 'x' }
  ];
  const cats = groupServicesByCategory(services);
  assert.equal(cats.length, 4);
  assert.equal(cats[0].heading, 'Build');
});

test('Cause House build — uses agency name and grouped services', function() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const prof = {
    partner_id: 'p1',
    showcase_headline: wp.positioning.heroHeadline,
    showcase_config: { templateKey: 'causehouse', websiteProfile: wp }
  };
  const partner = { id: 'p1', display_name: 'Shaun Matthews', email: 'a@b.com', phone: '0400000000' };
  const content = resolvePartnerThemeContent({ prof, partner, directory: null, demos: [], base: 'leadpages.com.au' });
  const html = build(prof, partner, [], 'leadpages.com.au', { themeContent: content });
  assert.ok(html.includes('Web Culture'));
  assert.ok(!html.includes('Partners Website Demo Site'));
  assert.ok(html.includes('ch-category-grid'));
  assert.ok(html.includes('data-ch-faq-expand'));
});
