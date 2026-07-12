const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePartnerLogo,
  isUsableLogoUrl,
  extractLogoValue,
  normalizeLogoForStorage,
  partnerLogoDisplayUrl
} = require('../../lib/partner-website/logo');
const { buildPartnerLandingHtml } = require('../../lib/partner-templates');

test('resolvePartnerLogo — reads showcase string and object logos', function() {
  assert.equal(
    resolvePartnerLogo({ showcaseConfig: { logo: 'https://example.com/a.png' } }),
    'https://example.com/a.png'
  );
  assert.equal(
    resolvePartnerLogo({ showcaseConfig: { logo: { imageUrl: 'https://example.com/b.png' } } }),
    'https://example.com/b.png'
  );
});

test('resolvePartnerLogo — ignores partner home site logo', function() {
  assert.equal(
    resolvePartnerLogo({
      showcaseConfig: {},
      home: { config: { logo: { imageUrl: 'https://example.com/c.png' } } }
    }),
    null
  );
});

test('resolvePartnerLogo — falls back to website profile identity logo', function() {
  assert.equal(
    resolvePartnerLogo({
      showcaseConfig: {
        websiteProfile: { identity: { logoUrl: 'https://example.com/profile.png' } }
      }
    }),
    'https://example.com/profile.png'
  );
});

test('extractLogoValue — rejects corrupted object string', function() {
  assert.equal(extractLogoValue('[object Object]'), null);
  assert.equal(normalizeLogoForStorage('[object Object]'), null);
});

test('isUsableLogoUrl — accepts https and protocol-relative URLs', function() {
  assert.equal(isUsableLogoUrl('https://res.cloudinary.com/demo/logo.png'), true);
  assert.equal(isUsableLogoUrl('//res.cloudinary.com/demo/logo.png'), true);
  assert.equal(isUsableLogoUrl(''), false);
  assert.equal(isUsableLogoUrl('[object Object]'), false);
});

test('partnerLogoDisplayUrl — adds Cloudinary width transform for sharp display', function() {
  const url = 'https://res.cloudinary.com/demo/image/upload/v123/partners/logo.png';
  const out = partnerLogoDisplayUrl(url, 440);
  assert.ok(out.includes('/upload/w_440,q_auto,f_auto,c_limit/'));
  assert.ok(out.includes('logo.png'));
});

test('buildPartnerLandingHtml — uses showcase logo only for Cause House nav', function() {
  const prof = {
    showcase_config: {
      templateKey: 'causehouse',
      logo: 'https://example.com/showcase-logo.png',
      logoSize: 2
    },
    showcase_headline: 'Test headline'
  };
  const partner = { display_name: 'Alex Partner' };
  const home = { config: { logo: { imageUrl: 'https://example.com/home-logo.png' } } };
  const html = buildPartnerLandingHtml(prof, partner, [], 'leadpages.com.au', { home, showTemplateSwitcher: false });
  assert.ok(html.includes('ch-nav-logo'));
  assert.ok(html.includes('showcase-logo.png'));
  assert.ok(!html.includes('home-logo.png'));
});
