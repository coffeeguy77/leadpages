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

test('registry — has Culture first and Local Website Co. second', function() {
  assert.equal(PARTNER_TEMPLATES.length, 2);
  assert.equal(PARTNER_TEMPLATES[0].id, 'webculture');
  assert.equal(PARTNER_TEMPLATES[1].id, 'localwebsiteco');
  assert.equal(normalizeTemplateKey('localwebsiteco'), 'localwebsiteco');
  assert.equal(normalizeTemplateKey('unknown-template'), 'webculture');
});

test('buildPartnerLandingHtml — renders Local Website Co. template at partners1 scale', function() {
  const html = buildPartnerLandingHtml(localProfile('localwebsiteco'), partner, [], 'leadpages.com.au', { showTemplateSwitcher: false });
  assert.ok(html.includes('lwc-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('DM+Serif+Display'));
  assert.ok(html.includes('family=Inter'));
  assert.ok(html.includes('A better'));
  assert.ok(html.includes('Websites powered by LeadPages'));
  assert.ok(html.includes("Let's build a website"));
  assert.ok(html.includes('Tell me about your business'));
  assert.ok(html.includes('Look professional'));
  assert.ok(html.includes('Always open'));
  assert.ok(html.includes('Local knowledge'));
  assert.ok(html.includes('Call 0414 631 463'));
  assert.ok(html.includes('Flow Pro Plumbing'));
  assert.ok(html.includes('Brightline Electrical'));
  assert.ok(html.includes('Green Space Landscapes'));
  assert.ok(html.includes('Harvest Café') || html.includes('Harvest Caf'));
  assert.ok(html.includes('Clear Path Consulting'));
  assert.ok(html.includes('Bloom Beauty Studio'));
  assert.ok(html.includes('MOST POPULAR'));
  assert.ok(html.includes('Grow my business'));
  assert.ok(html.includes('>Luke<'));
  assert.ok(html.includes('>Megan<'));
  assert.ok(html.includes('>David<'));
  assert.ok(html.includes('Powered by LeadPages Australia'));
  assert.ok(html.includes('lwc-final-photo'));
  assert.ok(html.includes('lwc-about-photo'));
  assert.ok(html.includes('/assets/partner-templates/localwebsiteco/about-shaun.jpg'));
  assert.ok(html.includes('/assets/partner-templates/localwebsiteco/tech-strip.jpg'));
  assert.ok(html.includes('/assets/partner-templates/localwebsiteco/contact-meeting.jpg'));
  assert.ok(html.includes('data-lwc-faq'));
  assert.ok(html.includes('--lwc-max:1240px') || html.includes('calc(100% - 64px)') || html.includes('lwc-shell'));
  assert.ok(!/\sclass="[^"]*\bwc-body\b/.test(html));
  assert.ok(!html.includes('/assets/partner-templates/webculture.css'));
  assert.ok(!html.includes('headshot-sv8msu50.svg'));
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

test('buildPartnerLandingHtml — templateOverride selects Local Website Co.', function() {
  const html = buildPartnerLandingHtml(localProfile('webculture'), partner, [], 'leadpages.com.au', {
    templateOverride: 'localwebsiteco',
    showTemplateSwitcher: true
  });
  assert.ok(html.includes('lwc-body'));
  assert.ok(html.includes('data-pt-template="localwebsiteco"'));
  assert.ok(html.includes('pt-tpl-bar'));
});
