const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('../../lib/partner-website/validate');
const { resolvePartnerThemeContent } = require('../../lib/partner-website/resolver');
const { computeProfileCompletion } = require('../../lib/partner-website/completion');
const { websiteProfileFromRow } = require('../../lib/partner-website/profile-store');

test('validateWebsiteProfile — trims and caps strings', function() {
  var out = validateWebsiteProfile({
    positioning: { heroHeadline: '  Hello world  ' },
    biography: { fullBio: 'x'.repeat(2000) }
  });
  assert.equal(out.positioning.heroHeadline, 'Hello world');
  assert.equal(out.biography.fullBio.length, 1200);
});

test('validateWebsiteProfile — service selections require serviceKey', function() {
  var out = validateWebsiteProfile({
    serviceSelections: [
      { serviceKey: 'new-websites', enabled: true, personalNote: 'My note' },
      { enabled: true }
    ]
  });
  assert.equal(out.serviceSelections.length, 1);
  assert.equal(out.serviceSelections[0].serviceKey, 'new-websites');
});

test('mergeWebsiteProfilePatch — deep merges identity without wiping fields', function() {
  var base = validateWebsiteProfile({
    identity: { agencyName: 'Web Culture', headshotUrl: 'https://example.com/photo.jpg', logoUrl: 'https://example.com/old.png' },
    biography: { shortIntro: 'Hi there' }
  });
  var merged = mergeWebsiteProfilePatch(base, {
    identity: { logoUrl: 'https://example.com/new.png' }
  });
  assert.equal(merged.identity.agencyName, 'Web Culture');
  assert.equal(merged.identity.headshotUrl, 'https://example.com/photo.jpg');
  assert.equal(merged.identity.logoUrl, 'https://example.com/new.png');
  assert.equal(merged.biography.shortIntro, 'Hi there');
});

test('mergeWebsiteProfilePatch — deep merges sections', function() {
  var base = validateWebsiteProfile({
    biography: { shortIntro: 'Hi' },
    positioning: { heroHeadline: 'Old' }
  });
  var merged = mergeWebsiteProfilePatch(base, {
    positioning: { heroHeadline: 'New headline' }
  });
  assert.equal(merged.positioning.heroHeadline, 'New headline');
  assert.equal(merged.biography.shortIntro, 'Hi');
});

test('resolvePartnerThemeContent — legacy showcase fields migrate', function() {
  var prof = {
    partner_id: 'p1',
    showcase_headline: 'Legacy headline',
    showcase_config: { intro: 'Legacy intro text', logo: 'https://example.com/logo.png' },
    region: 'Canberra, Queanbeyan',
    bio: 'Partner bio paragraph.'
  };
  var partner = { id: 'p1', display_name: 'Alex Partner', email: 'alex@example.com', phone: '0400000000' };
  var content = resolvePartnerThemeContent({ prof, partner, directory: null, demos: [], base: 'leadpages.com.au' });
  assert.equal(content.hero.headline, 'Legacy headline');
  assert.ok(content.hero.supportingText.includes('Legacy intro'));
  assert.equal(content.partner.displayName, 'Alex Partner');
  assert.equal(content.partner.logoUrl, 'https://example.com/logo.png');
  assert.ok(content.serviceArea.areas.length >= 1);
});

test('resolvePartnerThemeContent — normalises object logo format', function() {
  var prof = {
    partner_id: 'p1',
    showcase_config: { logo: { imageUrl: 'https://example.com/object-logo.png' } }
  };
  var content = resolvePartnerThemeContent({
    prof,
    partner: { id: 'p1', display_name: 'Alex Partner' },
    demos: [],
    base: 'leadpages.com.au'
  });
  assert.equal(content.partner.logoUrl, 'https://example.com/object-logo.png');
});

test('resolvePartnerThemeContent — ignores partner home site logo', function() {
  var prof = {
    partner_id: 'p1',
    showcase_config: { templateKey: 'webculture' }
  };
  var home = { config: { logo: { imageUrl: 'https://example.com/home-logo.png' } } };
  var content = resolvePartnerThemeContent({
    prof,
    partner: { id: 'p1', display_name: 'Alex Partner' },
    demos: [],
    base: 'leadpages.com.au',
    home: home
  });
  assert.equal(content.partner.logoUrl, null);
});

test('resolvePartnerThemeContent — enabled services from selections', function() {
  var prof = {
    partner_id: 'p1',
    website_profile: validateWebsiteProfile({
      serviceSelections: [
        { serviceKey: 'new-websites', enabled: true },
        { serviceKey: 'ecommerce', enabled: false }
      ]
    })
  };
  var content = resolvePartnerThemeContent({
    prof,
    partner: { id: 'p1', display_name: 'Sam' },
    demos: [],
    base: 'leadpages.com.au'
  });
  assert.equal(content.services.length, 1);
  assert.equal(content.services[0].key, 'new-websites');
});

test('computeProfileCompletion — returns overall score and actions', function() {
  var content = resolvePartnerThemeContent({
    prof: { partner_id: 'p1' },
    partner: { id: 'p1', display_name: 'Pat' },
    demos: [],
    base: 'leadpages.com.au'
  });
  var c = computeProfileCompletion(content);
  assert.ok(c.overall >= 0 && c.overall <= 100);
  assert.ok(Array.isArray(c.groups));
  assert.ok(c.groups.length > 0);
});

test('websiteProfileFromRow — falls back to showcase_config.websiteProfile', function() {
  var row = {
    showcase_config: { websiteProfile: { identity: { agencyName: 'Stored Co' } } }
  };
  assert.equal(websiteProfileFromRow(row).identity.agencyName, 'Stored Co');
});
