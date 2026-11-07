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
    support_phone: '0414 631 463',
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
  phone: '0414 631 463'
};

test('registry — Culture first, then the Studio designs (localwebsiteco keeps its id)', function() {
  assert.deepEqual(PARTNER_TEMPLATES.map(function(t) { return t.id; }), ['webculture', 'localwebsiteco', 'studioplus', 'presence', 'plum', 'forest']);
  assert.equal(normalizeTemplateKey('localwebsiteco'), 'localwebsiteco');
  assert.equal(normalizeTemplateKey('unknown-template'), 'webculture');
});

// Nov 2026: the "localwebsiteco" key now draws the orange Studio design. The previous Local
// Website Co. layout is kept in lib/partner-templates/localwebsiteco.js and still builds.
test('buildPartnerLandingHtml — localwebsiteco renders the orange Studio design', function() {
  const html = buildPartnerLandingHtml(localProfile('localwebsiteco'), partner, [], 'leadpages.com.au', { showTemplateSwitcher: false });
  assert.ok(html.includes('st-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('family=Manrope'));
  assert.ok(html.includes('Impossible to ignore.'));
  assert.ok(html.includes('/assets/partner-templates/studio.css'));
  assert.ok(html.includes('/assets/lp-try-colours.js'));
  assert.ok(!/\sclass="[^"]*\bwc-body\b/.test(html));
  assert.ok(!html.includes('/assets/partner-templates/webculture.css'));
  assert.ok(!html.includes('headshot-sv8msu50.svg'));
});

test('previous Local Website Co. layout still builds directly', function() {
  const { resolvePartnerThemeContent } = require('../../lib/partner-website/resolver');
  const prof = localProfile('localwebsiteco');
  const themeContent = resolvePartnerThemeContent({ prof: prof, partner: partner, demos: [], base: 'leadpages.com.au' });
  themeContent.meta.templateKey = 'localwebsiteco';
  const html = require('../../lib/partner-templates/localwebsiteco').build(prof, partner, [], 'leadpages.com.au', { themeContent: themeContent });
  assert.ok(html.includes('lwc-body'));
  assert.ok(html.includes('Flow Pro Plumbing'));
});

test('buildLocalWebsiteCoCopy — rejects SVG headshot and prefers curated demos', function() {
  const { buildLocalWebsiteCoCopy } = require('../../lib/partner-website/localwebsiteco-theme');
  const copy = buildLocalWebsiteCoCopy({
    partner: {
      firstName: 'Shaun',
      agencyName: 'Web Culture',
      headshotUrl: 'https://res.cloudinary.com/example/image/upload/v1/profile/headshot.svg'
    },
    demos: [
      { name: 'Bean Culture', industry: 'Builder', thumbnail: 'https://example.com/a.jpg', description: 'x' },
      { name: 'RTT Truck', industry: 'Diesel Mechanic', thumbnail: 'https://example.com/b.jpg', description: 'y' }
    ],
    testimonials: [
      { customerName: 'Jenny', businessName: 'Wholesale', text: 'Great work' }
    ]
  });
  assert.ok(copy.about.image.indexOf('about-shaun.jpg') !== -1);
  assert.ok(copy.trust.image.indexOf('tech-strip.jpg') !== -1);
  assert.ok(copy.contact.image.indexOf('contact-meeting.jpg') !== -1);
  assert.equal(copy.demos.cards[0].name, 'Flow Pro Plumbing');
  assert.equal(copy.demos.cards.length, 6);
  assert.equal(copy.testimonials.items.length, 3);
  assert.equal(copy.testimonials.items[0].customerName, 'Jenny');
  assert.equal(copy.testimonials.items[1].customerName, 'Megan');
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

test('buildPartnerLandingHtml — templateOverride selects a Studio design and shows the preview switcher', function() {
  const html = buildPartnerLandingHtml(localProfile('webculture'), partner, [], 'leadpages.com.au', {
    templateOverride: 'localwebsiteco',
    showTemplateSwitcher: true
  });
  assert.ok(html.includes('st-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('pt-tpl-bar'));
});
