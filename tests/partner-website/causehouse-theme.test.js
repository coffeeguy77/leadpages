const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupServicesByCategory, buildCausehouseCopy } = require('../../lib/partner-website/causehouse-theme');
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
  assert.equal(cats[0].heading, 'Build your presence');
});

test('buildCausehouseCopy — profile-driven hero trust and footer', function() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const content = resolvePartnerThemeContent({
    prof: { showcase_config: { websiteProfile: wp } },
    partner: { display_name: 'Shaun Matthews' },
    directory: null,
    demos: [],
    base: 'leadpages.com.au'
  });
  const copy = buildCausehouseCopy(content);
  assert.equal(copy.heroTrust[0].label, 'Canberra-based partner');
  assert.equal(copy.footer.tagline, 'Canberra website strategy, design and connected business systems.');
  assert.equal(copy.partner.heading, 'Work directly with Shaun Matthews.');
});

test('Cause House build — uses agency name and grouped services', function() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const prof = {
    partner_id: 'p1',
    showcase_headline: wp.positioning.heroHeadline,
    showcase_config: {
      templateKey: 'causehouse',
      websiteProfile: wp,
      logo: 'https://example.com/web-culture-logo.png',
      logoSize: 1.5
    }
  };
  const partner = { id: 'p1', display_name: 'Shaun Matthews', email: 'a@b.com', phone: '0400000000' };
  const demos = [
    { slug: 'demo-tradie', business_name: 'Tradie Pro', config: { trade: 'Trades', showcase: { image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80' } } },
    { slug: 'demo-cafe', business_name: 'Cafe Demo', config: { trade: 'Hospitality', showcase: { image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80' } } },
    { slug: 'demo-legal', business_name: 'Legal Practice', config: { trade: 'Professional services', showcase: { image: 'https://images.unsplash.com/photo-1486406146926-c627a92fd1b2?w=800&q=80' } } }
  ];
  const content = resolvePartnerThemeContent({ prof, partner, directory: null, demos, base: 'leadpages.com.au' });
  const html = build(prof, partner, demos, 'leadpages.com.au', { themeContent: content });
  assert.ok(html.includes('Web Culture'));
  assert.ok(!html.includes('Partners Website Demo Site'));
  assert.ok(html.includes('ch-brand-img'));
  assert.ok(html.includes('ch-brand-img-plate'));
  assert.ok(html.includes('web-culture-logo.png'));
  assert.ok(html.includes('ch-hero-logo'));
  assert.ok(html.includes('YOUR CANBERRA WEBSITE PARTNER'));
  assert.ok(html.includes('Canberra-based partner'));
  assert.ok(html.includes('LeadPages platform client'));
  assert.ok(html.includes('ch-category-grid'));
  assert.ok(html.includes('data-ch-faq-expand'));
  assert.ok(html.includes('Tell us a little more'));
  assert.ok(html.includes('One connected website service'));
  assert.ok(html.includes('Ready for a website that works harder for your business?'));
});
