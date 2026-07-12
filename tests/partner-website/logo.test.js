const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePartnerLogo, isUsableLogoUrl } = require('../../lib/partner-website/logo');
const { buildPartnerLandingHtml } = require('../../lib/partner-templates');

test('resolvePartnerLogo — reads showcase, object, and home logos', function() {
  assert.equal(
    resolvePartnerLogo({ showcaseConfig: { logo: 'https://example.com/a.png' } }),
    'https://example.com/a.png'
  );
  assert.equal(
    resolvePartnerLogo({ showcaseConfig: { logo: { imageUrl: 'https://example.com/b.png' } } }),
    'https://example.com/b.png'
  );
  assert.equal(
    resolvePartnerLogo({
      showcaseConfig: {},
      home: { config: { logo: { imageUrl: 'https://example.com/c.png' } } }
    }),
    'https://example.com/c.png'
  );
});

test('isUsableLogoUrl — accepts https and protocol-relative URLs', function() {
  assert.equal(isUsableLogoUrl('https://res.cloudinary.com/demo/logo.png'), true);
  assert.equal(isUsableLogoUrl('//res.cloudinary.com/demo/logo.png'), true);
  assert.equal(isUsableLogoUrl(''), false);
});

test('buildPartnerLandingHtml — merges home logo into Cause House nav', function() {
  const prof = {
    showcase_config: { templateKey: 'causehouse', logoSize: 2 },
    showcase_headline: 'Test headline'
  };
  const partner = { display_name: 'Alex Partner' };
  const home = { config: { logo: { imageUrl: 'https://example.com/home-logo.png' } } };
  const html = buildPartnerLandingHtml(prof, partner, [], 'leadpages.com.au', { home, showTemplateSwitcher: false });
  assert.ok(html.includes('ch-brand-img'));
  assert.ok(html.includes('home-logo.png'));
});
