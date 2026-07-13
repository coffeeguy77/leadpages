const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupDemosByIndustryTab, buildWebcultureCopy } = require('../../lib/partner-website/webculture-theme');
const { resolvePartnerThemeContent } = require('../../lib/partner-website/resolver');
const { buildWebCultureWebsiteProfile } = require('../../lib/partner-website/web-culture-profile');
const { validateWebsiteProfile } = require('../../lib/partner-website/validate');
const { build } = require('../../lib/partner-templates/webculture');
const { buildPartnerLandingHtml, normalizeTemplateKey } = require('../../lib/partner-templates');
const { PARTNER_TEMPLATES } = require('../../lib/partner-templates/registry');

test('registry — includes webculture template', function() {
  const tpl = PARTNER_TEMPLATES.find(function(t) { return t.id === 'webculture'; });
  assert.ok(tpl);
  assert.equal(normalizeTemplateKey('webculture'), 'webculture');
});

test('groupDemosByIndustryTab — groups demos by industry', function() {
  const demos = [
    { slug: 'a', name: 'Tradie', industry: 'Trades', url: 'https://x/a' },
    { slug: 'b', name: 'Cafe', industry: 'Hospitality', url: 'https://x/b' }
  ];
  const groups = groupDemosByIndustryTab(demos);
  assert.ok(groups.length >= 2);
  assert.equal(groups[0].tab.key, 'trades');
});

test('buildWebcultureCopy — uses profile agency name not hardcoded Web Culture', function() {
  const content = resolvePartnerThemeContent({
    prof: {
      showcase_config: {
        websiteProfile: validateWebsiteProfile(Object.assign(buildWebCultureWebsiteProfile(), {
          identity: { agencyName: 'Acme Digital', badgeStatus: 'leadpages-partner' }
        }))
      }
    },
    partner: { display_name: 'Alex Partner' },
    demos: [],
    base: 'leadpages.com.au'
  });
  buildWebcultureCopy(content);
  assert.equal(content.partner.agencyName, 'Acme Digital');
  assert.equal(content.partner.publicIntro.agencyHeading, 'Acme Digital');
  assert.match(content.partner.publicIntro.contactLine, /Work directly with Alex/);
});

test('Web Culture build — renders premium sections from profile', function() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const prof = {
    partner_id: 'p1',
    showcase_headline: wp.positioning.heroHeadline,
    showcase_config: {
      templateKey: 'webculture',
      websiteProfile: wp,
      logo: 'https://example.com/logo.png'
    }
  };
  const partner = { id: 'p1', display_name: 'Shaun Matthews', email: 'a@b.com', phone: '0400000000' };
  const demos = [
    { slug: 'demo-tradie', business_name: 'Tradie Pro', config: { trade: 'Trades', showcase: { image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80' } } },
    { slug: 'demo-cafe', business_name: 'Cafe Demo', config: { trade: 'Hospitality', showcase: { image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80' } } }
  ];
  const content = resolvePartnerThemeContent({ prof, partner, directory: null, demos, base: 'leadpages.com.au' });
  const html = build(prof, partner, demos, 'leadpages.com.au', { themeContent: content });
  assert.ok(html.includes('wc-body'));
  assert.ok(html.includes('wc-hero-benefits'));
  assert.ok(html.includes('Built-in analytics'));
  assert.ok(html.includes('Visitor tracking'));
  assert.ok(html.includes('Conversion insights'));
  assert.ok(!html.includes('data-prm-hero-showcase'));
  assert.ok(!html.includes('prm-hero-browser'));
  assert.ok(html.includes('prm-demo-showcase'));
  assert.ok(html.includes('prm-live-iframe'));
  assert.ok(html.includes('YOUR LOCAL LEADPAGES PARTNER'));
  assert.ok(html.includes('wc-hero-title'));
  assert.ok(html.includes('wc-highlight'));
  assert.ok(html.includes('work harder'));
  assert.ok(html.includes('for your business.'));
  assert.ok(html.includes('wc-hero-lead'));
  assert.ok(html.includes('wc-lead-brand'));
  assert.ok(html.includes('wc-lead-em'));
  assert.ok(html.includes('Work directly with'));
  assert.ok(html.includes('wc-lead-brand'));
  assert.ok(html.includes('Web Culture</strong> to create a professional website'));
  assert.ok(html.includes('local support every step of the way'));
  assert.ok(html.includes('Explore Live Demos'));
  assert.ok(html.includes('Plan My Website'));
  assert.ok(html.includes('Canberra-Based Partner'));
  assert.ok(html.includes('Explore Live Websites'));
  assert.ok(html.includes('Powered by LeadPages'));
  assert.ok(!html.includes('Beautiful websites. Smarter systems.'));
  assert.ok(!html.includes('Gungahlin Partner'));
  assert.ok(!html.includes('YOUR CANBERRA WEBSITE PARTNER'));
  assert.ok(!html.includes('built to win business'));
  assert.ok(html.includes('prm-demo-showcase'));
  assert.ok(html.includes('data-prm-demo-carousel'));
  assert.ok(html.includes('data-prm-demo-prev'));
  assert.ok(html.includes('data-prm-demo-next'));
  assert.ok(html.includes('prm-demo-indicator'));
  assert.ok(html.includes('Choose an industry.'));
  assert.ok(html.includes('Explore a real website.'));
  assert.ok(!html.includes('prm-gallery-strip'));
  assert.ok(!html.includes('wc-hero-demos'));
  assert.ok(html.indexOf('prm-lead-flow') < html.indexOf('Choose an industry.'));
  assert.ok(html.indexOf('Choose an industry.') < html.indexOf('id="services"'));
  assert.ok(html.includes('data-prm-tab'));
  assert.ok(html.includes('prm-lead-flow'));
  assert.ok(html.includes('data-prm-flow-board'));
  assert.ok(!html.includes('New Customers'));
  assert.ok(!html.includes('prm-flow-branch'));
  assert.ok(html.includes('prm-service-card'));
  assert.ok(html.includes('id="services"'));
  assert.ok(html.includes('WHAT WE DO'));
  assert.ok(html.includes('Websites that do more for your business.'));
  assert.ok(html.includes('wc-section--ink wc-services'));
  assert.ok(!html.includes('ONE CONNECTED SERVICE'));
  assert.ok(!html.includes('prm-platform-diagram'));
  assert.ok(html.includes('prm-timeline'));
  assert.ok(html.includes('data-prm-timeline-animate'));
  assert.ok(html.includes('prm-final-cta--slim'));
  assert.ok(html.includes('Ready for a website that works as hard as you do?'));
  assert.ok(html.includes('Let\u2019s build something your customers will remember.'));
  assert.ok(html.includes('prm-icon-ring--cta'));
  assert.match(html, /prm-icon-ring--cta[\s\S]*prm-final-cta-title/);
  assert.ok(!html.includes('prm-review-badge'));
  assert.ok(!html.includes('prm-review-contact'));
  assert.ok(html.includes('data-pl-lead-form'));
  assert.ok(html.includes('prm-form--compact'));
  assert.ok(html.includes('Let\u2019s talk about your business.'));
  assert.ok(html.includes('placeholder="Name *"'));
  assert.ok(!html.includes('<span>Name *</span>'));
  assert.ok(html.includes('prm-review-top'));
  assert.ok(html.includes('data-prm-review-slider'));
  assert.ok(html.includes('prm-review-slide'));
  assert.ok(html.includes('prm-review-indicator'));
  assert.ok(html.includes('prm-partner-agency'));
  assert.ok(html.includes('prm-partner-contact-line'));
  assert.ok(html.includes('Work directly with Shaun'));
  const partnerChunk = html.slice(html.indexOf('prm-partner-card'), html.indexOf('prm-partner-card') + 2500);
  const contactMatches = partnerChunk.match(/Work directly with Shaun/g) || [];
  assert.equal(contactMatches.length, 1, 'contact line should appear once in partner card');
  assert.ok(!html.includes('Shaun Matthews'));
  assert.ok(html.includes('wc-footer-local'));
  assert.ok(html.includes('Canberra Website Designer'));
  assert.ok(html.includes('wc-sticky-cta'));
  assert.ok(html.includes('data-wc-sticky-cta'));
  assert.ok(html.includes('wc-footer-lockup'));
  assert.ok(html.includes('wc-footer-cloud-mark'));
  assert.ok(html.includes('wc-wordmark--footer'));
  assert.ok(html.includes('wc-wordmark-culture'));
  assert.ok(html.includes('data-lp-logo-pulse'));
  assert.ok(!html.includes('data-lp-logo-pulse="false"'));
  assert.ok(html.includes('prm-icon-ring--cloud'));
  assert.ok(html.includes('Powered by'));
  assert.ok(!html.includes('Partners Website Demo Site'));
});

test('Web Culture build — stale DB positioning does not override theme hero copy', function() {
  const wp = validateWebsiteProfile(buildWebCultureWebsiteProfile());
  const prof = {
    partner_id: 'p1',
    showcase_headline: 'Web Culture',
    showcase_config: {
      templateKey: 'webculture',
      intro: 'Work directly with Shaun Matthews, your local website partner in Mitchell. Get a professionally built website, live demos you can explore, and ongoing support from someone who understands your business.',
      websiteProfile: Object.assign({}, wp, {
        positioning: {
          heroEyebrow: 'Web Culture',
          heroHeadline: 'Web Culture',
          heroSupporting: 'Work directly with Shaun Matthews, your local website partner in Mitchell. Get a professionally built website, live demos you can explore, and ongoing support from someone who understands your business.'
        }
      })
    }
  };
  const partner = { id: 'p1', display_name: 'Shaun Matthews', email: 'a@b.com', phone: '0400000000' };
  const content = resolvePartnerThemeContent({ prof, partner, directory: { suburb: 'Mitchell' }, demos: [], base: 'leadpages.com.au' });
  const html = build(prof, partner, [], 'leadpages.com.au', { themeContent: content });
  assert.ok(html.includes('YOUR LOCAL LEADPAGES PARTNER'));
  assert.ok(html.includes('wc-hero-title'));
  assert.ok(html.includes('work harder'));
  assert.ok(html.includes('wc-lead-brand'));
  assert.ok(html.includes('Web Culture</strong> to create a professional website'));
  assert.ok(!html.includes('<p class="wc-hero-lead">Work directly with Shaun Matthews'));
  assert.ok(!html.includes('<h1 class="wc-display prm-serif">Web Culture</h1>'));
  assert.ok(!html.includes('Shaun Matthews'));
});

test('buildPartnerLandingHtml — dispatches webculture template', function() {
  const prof = {
    showcase_config: { templateKey: 'webculture', logo: 'https://example.com/logo.png' },
    showcase_headline: 'Test headline'
  };
  const html = buildPartnerLandingHtml(prof, { display_name: 'Test' }, [], 'leadpages.com.au', { showTemplateSwitcher: false });
  assert.ok(html.includes('data-pt-template="webculture"'));
  assert.ok(html.includes('/assets/partner-templates/webculture.css'));
  assert.ok(html.includes('__LP_VISITOR_A11Y__={enabled:false}'));
});
