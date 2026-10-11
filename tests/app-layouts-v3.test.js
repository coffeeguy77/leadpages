'use strict';

/**
 * Layouts on existing apps (assets/lp-layouts.js): Hero Slider "Booking card", Bookings
 * "Price week", Text Box "Brand band", Services "Icon row", How It Works "Numbered",
 * Reviews "Quotes", FAQ "Split" — and the old whole-page "Bold" design is gone.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');

/** Load lp-layouts.js with a stub DOM so its pure helpers can be called. */
function helpers() {
  const src = js.replace("window.__lpLayoutsRun = run;", "window.__lpLayoutsRun = run; window.__lplTest = { weekFromRates: weekFromRates, specOf: specOf };");
  const doc = { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  const win = { addEventListener() {} };
  vm.runInNewContext(src, { window: win, document: doc, setTimeout() {}, clearTimeout() {}, getComputedStyle() { return {}; } });
  const t = win.__lplTest;
  // Plain copies (objects come from another VM context).
  return { weekFromRates: (r) => JSON.parse(JSON.stringify(t.weekFromRates(r))), specOf: (x) => JSON.parse(JSON.stringify(t.specOf(x))) };
}

test('price week reads a day for each weekday from the rate card labels', () => {
  const h = helpers();
  const week = h.weekFromRates([
    { label: 'Mon – Thu', price: '$150', unit: 'per 24 hours' },
    { label: 'Friday', price: '$220' },
    { label: 'Weekends & Public Holidays', price: '$250' }
  ]);
  assert.deepEqual(week.map((d) => d.price), ['$150', '$150', '$150', '$150', '$220', '$250', '$250']);
  assert.equal(week[0].i, 0);
  assert.equal(week[6].i, 2);
  // Labels that don't cover the week fall back to the rate cards as they are.
  assert.equal(h.weekFromRates([{ label: 'Per day', price: '$99' }]), null);
  // Hidden rate cards are ignored.
  assert.equal(h.weekFromRates([{ label: 'Mon – Sun', price: '$1', on: false }]), null);
});

test('text box band turns "Label: value" features into spec rows', () => {
  const h = helpers();
  assert.deepEqual(h.specOf('Payload: 850kg'), { label: 'Payload', value: '850kg' });
  assert.deepEqual(h.specOf('GVM — 4.5 tonne'), { label: 'GVM', value: '4.5 tonne' });
  assert.equal(h.specOf('ABS braking'), null);
});

test('every new layout is drawn by lp-layouts.js, styled, and opt-in', () => {
  for (const [cls, key] of [
    ['hbk-on', "HS.layout === 'booking'"],
    ['bkw-on', "S.layout === 'priceweek'"],
    ['tbx-band', "TB.layout === 'band'"],
    ['svcs-iconrow', "SV.mode === 'iconrow'"],
    ['sp-numbered', "SP.layout === 'numbered'"],
    ['rv-quotes', "RV.layout === 'quotes'"],
    ['faq-split', "FQ.layout === 'split'"]
  ]) {
    assert.ok(js.indexOf(key) >= 0, key);
    assert.ok(css.indexOf(cls) >= 0, cls + ' styled');
  }
  assert.match(js, /bookingWeek, heroBooking, bookingHire, fontSet\]/);
});

test('every new layout has its option in the page editor', () => {
  for (const re of [
    /\['booking','Booking card/,
    /\['priceweek','Price week/,
    /\['band','Brand band/,
    /<option value="iconrow"/,
    /\['numbered','Numbered/,
    /\['quotes','Quotes/,
    /\['split','Split/
  ]) assert.match(manage, re);
});

test('auto-select hooks point at the right fields', () => {
  for (const hook of ['list:heroSlides:', 'list:heroSliderBadges:', 'list:bookingRates:', 'list:textBoxFeatures:', 'data-lpe="bookTitle"', 'data-lpe="calloutTitle"', 'data-lpe="weekHeading"']) {
    assert.ok(js.indexOf(hook) >= 0, hook);
  }
});

test('the whole-page Bold design is removed everywhere', () => {
  assert.ok(!fs.existsSync(path.join(root, 'assets/lp-skin-bold.js')));
  assert.ok(!fs.existsSync(path.join(root, 'assets/lp-skin-bold.css')));
  assert.doesNotMatch(read('api/render.js'), /injectBoldDesign|lp-skin-bold/);
  assert.doesNotMatch(js, /boldDesign|lp-skin-bold/);
  assert.doesNotMatch(manage, /d-design|d-bold-/);
});

test('layout details match the design: quotes without stars by default, title-case steps, chevron FAQ, edge map, offline card button', () => {
  assert.match(css, /\.rv-quotes \.review \.stars\{display:none\}/);
  assert.match(css, /\.rv-quotes\.rv-qstars \.review \.stars\{display:block/);
  assert.match(css, /sp-numbered \.sp-title\{[^}]*text-transform:none!important/);
  assert.match(css, /faq-split \.faq summary::after\{content:""/);
  assert.match(css, /mh-bleed \.mh\{/);
  assert.match(js, /'bookCtaCall'/);
  assert.match(manage, /\['bleed','Edge map/);
  assert.match(manage, /k:'quoteStars'/);
});

