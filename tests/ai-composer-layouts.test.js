'use strict';

/**
 * Extra app layouts (assets/lp-layouts.js), the Bookings hire bar
 * (assets/lp-booking-hire.js) and what AI Composer may write for them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test';

const catalogue = require('../lib/ai-composer/catalogue');
const { sanitizeClientPlan } = require('../lib/ai-composer/plan');
const { normalizeFill, buildSiteConfig } = require('../lib/ai-composer/build-config');
const { fillSystemPrompt, planSystemPrompt } = require('../lib/ai-composer/prompts');
const { _injectBookingStorefront: injectBooking } = require('../api/render.js');

const DESIGN = { url: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1790000000/leadpages/ai-composer/202610/design-abc.png', width: 1440, height: 3000 };
function onePlan(sections, photos) {
  return sanitizeClientPlan({ design: DESIGN, businessName: 'Hire Co', sections, photos: photos || [] });
}
const TEMPLATE_LIKE = '<html><head><style id="lp-fouc-guard">html:not(.lp-cfg-ready) [data-sec="bookingStorefront"]{visibility:hidden!important}</style></head>' +
  '<body><main id="top"><section data-sec="hero"></section><section data-sec="quote" class="q"></section></main></body></html>';

test.describe('Bookings section rendering', () => {
  test('hire layout injects the bar shell, its stylesheet and script before the quote form', () => {
    const html = injectBooking(TEMPLATE_LIKE, 'hire-co', { sections: { bookingStorefront: { on: true, layout: 'hire' } } });
    assert.match(html, /<link rel="stylesheet" href="\/assets\/lp-booking-hire\.css\?v=\d+"><section data-sec="bookingStorefront" class="sec booking-storefront bk-hire" id="bookingStorefront"><\/section><script src="\/assets\/lp-booking-hire\.js\?v=\d+" defer><\/script><section data-sec="quote"/);
  });

  test('CTA layout is placed even though the page CSS mentions the section (was skipped before)', () => {
    const html = injectBooking(TEMPLATE_LIKE, 'hire-co', { sections: { bookingStorefront: { on: true, heading: 'Book a time' } } });
    assert.match(html, /<section data-sec="bookingStorefront" class="sec booking-storefront" id="bookingStorefront">[\s\S]*Book a time[\s\S]*<\/section><section data-sec="quote"/);
    assert.ok(!html.includes('lp-booking-hire'), 'CTA layout loads no hire assets');
  });

  test('an existing bookings section is replaced, and nothing is added when switched off', () => {
    const withSec = TEMPLATE_LIKE.replace('<section data-sec="quote"', '<section data-sec="bookingStorefront" class="old">x</section><section data-sec="quote"');
    const html = injectBooking(withSec, 'hire-co', { sections: { bookingStorefront: { on: true, layout: 'hire' } } });
    assert.equal((html.match(/data-sec="bookingStorefront" class/g) || []).length, 1);
    assert.ok(!html.includes('class="old"'));
    assert.equal(injectBooking(TEMPLATE_LIKE, 'hire-co', { sections: { bookingStorefront: { on: false, layout: 'hire' } } }), TEMPLATE_LIKE);
  });
});

test.describe('AI Composer — extra layouts', () => {
  test('bookingStorefront is offered only as the hire bar', () => {
    const sheet = catalogue.appFieldSheet('bookingStorefront');
    assert.ok(sheet, 'bookings app is in the catalogue');
    const paths = sheet.fields.map((f) => f.path);
    assert.ok(paths.includes('sections.bookingStorefront.hireHeading'));
    assert.ok(!paths.includes('sections.bookingStorefront.heading'), 'CTA heading stays with the editor');
    assert.deepEqual(sheet.lists.map((l) => l.path).sort(), ['sections.bookingStorefront.points', 'sections.bookingStorefront.rates']);
  });

  test('layout choices accept listed values only; icons must be LeadPages icon names', () => {
    assert.ok(catalogue.isIconName('truck'));
    assert.ok(!catalogue.isIconName('🚚'));
    const plan = onePlan([{ id: 's1', appKey: 'activityCounter', rows: { y0: 0, y1: 300 } }]);
    const [fill] = normalizeFill({ apps: [{ appKey: 'activityCounter', fields: {
      'sections.activityCounter.style': 'strip', 'sections.activityCounter.heading': ''
    }, lists: { 'sections.activityCounter.stats': [
      { icon: 'truck', value: '4.5 Tonne', label: '(GVM)' },
      { icon: 'not-an-icon', value: '850kg', label: 'Payload' },
      { icon: 'box' }
    ] } }] }, plan.sections, plan);
    assert.equal(fill.scalars['sections.activityCounter.style'], 'strip');
    const stats = fill.lists['sections.activityCounter.stats'];
    assert.equal(stats.length, 2, 'an icon alone does not make an item');
    assert.equal(stats[0].icon, 'truck');
    assert.ok(!('icon' in stats[1]), 'unknown icon dropped');
    const [bad] = normalizeFill({ apps: [{ appKey: 'activityCounter', fields: { 'sections.activityCounter.style': 'giant' }, lists: {} }] }, plan.sections, plan);
    assert.ok(!('sections.activityCounter.style' in bad.scalars));
  });

  test('a chosen Bookings app is always the hire layout; layout-only lists never remove an app', () => {
    const plan = onePlan([
      { id: 's1', appKey: 'heroSlider', rows: { y0: 0, y1: 600 } },
      { id: 's2', appKey: 'bookingStorefront', rows: { y0: 600, y1: 800 } },
      { id: 's3', appKey: 'textBox', rows: { y0: 800, y1: 1200 } }
    ]);
    const fills = normalizeFill({ apps: [
      { appKey: 'heroSlider', fields: {}, lists: { 'sections.heroSlider.slides': [{ heading: 'Move more' }] } },
      { appKey: 'bookingStorefront', fields: { 'sections.bookingStorefront.hireHeading': 'Check Truck Availability', 'sections.bookingStorefront.icon': 'truck' },
        lists: { 'sections.bookingStorefront.rates': [{ label: 'Mon – Thu', price: '$150', unit: 'per 24 hours' }] } },
      { appKey: 'textBox', fields: { 'sections.textBox.heading': 'Modern trucks' }, lists: {} }
    ] }, plan.sections, plan);
    const cfg = buildSiteConfig(plan, fills, { businessName: 'Hire Co' });
    assert.equal(cfg.sections.bookingStorefront.on, true);
    assert.equal(cfg.sections.bookingStorefront.layout, 'hire');
    assert.equal(cfg.sections.bookingStorefront.rates[0].price, '$150');
    assert.equal(cfg.sections.textBox.on, true, 'text box without features is kept');
    assert.deepEqual(cfg.sectionOrder.slice(0, 3), ['heroSlider', 'bookingStorefront', 'textBox']);
  });

  test('prompts describe the booking bar and the extra layouts', () => {
    assert.match(planSystemPrompt(), /bookingStorefront/);
    const fill = fillSystemPrompt();
    ['services.mode "tick"', 'aboutUs.layout "location"', 'reviews.theme "dark"', 'kind "icon"'].forEach((s) => assert.ok(fill.includes(s), s));
  });
});
