'use strict';

/**
 * "Bold" page design (assets/lp-skin-bold.js + api/render.js injectBoldDesign).
 * Opt-in per site with config.design = 'bold'; every other site must be untouched.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test';

const { _injectBoldDesign: injectBold } = require('../api/render.js');
const skin = require('../assets/lp-skin-bold.js');

const PAGE = '<!DOCTYPE html><html lang="en-AU" class="site-width-capped"><head><title>x</title></head>' +
  '<body><header class="site"></header><main id="top"><section data-sec="hero"></section></main></body></html>';

const CFG = {
  businessName: 'Hire Co', slug: 'hire-co', phone: '0262413555', phoneText: '02 6241 3555',
  sections: {
    heroSlider: { on: true, slides: [{ heading: 'Move More.', highlightText: 'Stress Less.', subText: 'Trucks by the day.' }], badges: [{ title: 'Car licence' }] },
    bookingStorefront: { on: true, layout: 'hire', rates: [
      { label: 'Mon – Thu', price: '$150' }, { label: 'Friday', price: '$220' }, { label: 'Weekends & Public Holidays', price: '$250' }] },
    faq: { on: true, heading: 'FAQ', items: [{ q: 'Licence?', a: 'Car licence.' }, { q: 'Insurance?', a: '' }] },
    aboutUs: { on: true, address: 'Unit 3, 47-49 Vicars St, Mitchell ACT 2911', hours: 'Mon – Fri  7:30am – 5:00pm' }
  }
};

test('sites without design = "bold" are returned byte-for-byte unchanged', () => {
  assert.equal(injectBold(PAGE, {}), PAGE);
  assert.equal(injectBold(PAGE, { design: 'classic' }), PAGE);
  assert.equal(injectBold(PAGE, null), PAGE);
});

test('bold sites get the design on the server: root, html class, stylesheet and script', () => {
  const out = injectBold(PAGE, Object.assign({ design: 'bold' }, CFG));
  assert.match(out, /<html lang="en-AU" class="lpb-on site-width-capped">/);
  assert.match(out, /<body><div id="lpb-root" class="lpb"/);
  assert.match(out, /<link rel="stylesheet" href="\/assets\/lp-skin-bold\.css\?v=\d+">[\s\S]*<\/head>/);
  assert.match(out, /<script src="\/assets\/lp-skin-bold\.js\?v=\d+" defer><\/script><\/body>/);
  // the classic markup is still there (hidden by CSS), so switching back loses nothing
  assert.match(out, /<header class="site"><\/header><main id="top">/);
});

test('the week of prices is read from the booking bar rate cards', () => {
  const w = skin.weekFromRates(CFG.sections.bookingStorefront.rates);
  assert.deepEqual(w, ['$150', '$150', '$150', '$150', '$220', '$250', '$250']);
  assert.equal(skin.weekFromRates([{ label: 'Weekdays', price: '$1' }]), null);
});

test('content is escaped and only safe image URLs are used', () => {
  const cfg = JSON.parse(JSON.stringify(CFG));
  cfg.bold = { heroTitle: '<img src=x onerror=alert(1)>', logoLight: 'javascript:alert(1)', heroImage: 'https://res.cloudinary.com/x.jpg' };
  const html = skin.render(cfg, {});
  assert.ok(html.indexOf('<img src=x') < 0);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(html.indexOf('javascript:') < 0);
  assert.match(html, /src="https:\/\/res\.cloudinary\.com\/x\.jpg"/);
});

test('falls back to the site content and answers empty FAQs with the phone number', () => {
  const html = skin.render(Object.assign({ design: 'bold' }, CFG), {});
  assert.match(html, /<span>Move More\. Stress Less\.<\/span>/);
  assert.match(html, /\$220/);
  assert.match(html, /Good question — call us on <a href="tel:0262413555">02 6241 3555<\/a>/);
  assert.match(html, /Unit 3, 47-49 Vicars St, Mitchell ACT 2911/);
  assert.match(html, /<span>Mon – Fri<\/span><b>7:30am – 5:00pm<\/b>/);
});

test('bold.hideReviews leaves reviews out; a part-filled week is ignored', () => {
  const cfg = JSON.parse(JSON.stringify(CFG));
  cfg.sections.reviews = { on: true, items: [{ who: 'A', text: 'Great' }] };
  assert.match(skin.render(cfg, {}), /lpb-reviews/);
  cfg.bold = { hideReviews: true, week: ['$1', '', '', '', '', '', ''] };
  const html = skin.render(cfg, {});
  assert.ok(html.indexOf('lpb-reviews') < 0);
  assert.match(html, /\$150/); // fell back to the rate cards
});
