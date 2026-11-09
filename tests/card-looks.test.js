'use strict';
// Card looks (Nov 2026, Duncan's Heating & Cooling design): every option is opt-in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.join(__dirname, '../assets/lp-layouts.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../assets/lp-layouts.css'), 'utf8');
const manage = fs.readFileSync(path.join(__dirname, '../manage.html'), 'utf8');

test('card looks only switch on from their own config values', () => {
  [
    "HD.logoDivider === true", "NM2.spread === true", "HS.eyebrowLook === 'plain'", "C.sectionHeadLine === 'under'",
    "(S.services || {}).photoCard === 'bar'", "TB.bleedEdge === 'fade'", "TB.featuresLook === 'ticks'", "Q.layout === 'card'",
    "Q.overlap === true", "(S.reviews || {}).cardStyle === 'soft'", "F.colDividers === true", "F.hills === true",
    "HS.layout === 'cover' && HS.coverShade === true", "c.mode === 'contact'", "c.mode === 'social'"
  ].forEach((frag) => assert.ok(js.includes(frag), frag));
});

test('hero: inline highlight, icon badges and the call card are opt-in', () => {
  assert.match(js, /var hlIn = HS\.highlightInline === true/);
  assert.match(js, /HS\.badgeStyle === 'icons'/);
  assert.match(js, /if \(HS\.nameCardLook === 'call'\)/);
  // the call card dials the site's own number; no new content fields
  assert.match(js, /var ncPh = txt\(C\.phone\) \|\| txt\(C\.phoneText\)/);
});

test("menu 'underline' keeps its old behaviour; the new accent bar is its own value", () => {
  assert.match(js, /var on = NM\.activeStyle === 'fill' \|\| NM\.activeStyle === 'bar';/);
  assert.match(js, /classList\.toggle\('lpl-nav-fill', NM\.activeStyle === 'fill'\)/);
  assert.ok(!/activeStyle === 'underline'/.test(js));
});

test('css for the new looks is scoped to their classes', () => {
  ['.svp-bar', '.tbx-fade', '.tbx-ticks', '.q-card', '.rv-soft', '.lpl-f-dividers', '.lpl-f-hills', '.hnc-call', '.hsp-ibadges', 'html.lpl-nav-bar', 'html.lpl-head-under', '.hsc-shade']
    .forEach((c) => assert.ok(css.includes(c), c));
});

test('footer column editor offers text, icon lines and social columns; quote card placeholders', () => {
  assert.match(manage, /<option value="text"'\+\(mode==='text'\?' selected':''\)\+'>Plain text lines<\/option>/);
  assert.match(manage, /<option value="contact"'/);
  assert.match(manage, /<option value="social"'/);
  assert.match(manage, /col\.mode=\(\['card','text','contact','social'\]\.indexOf\(t\.value\)>=0\)\?t\.value:'links'/);
  assert.match(manage, /\['emailPh','Email field placeholder \(card layout\)'\]/);
  assert.match(manage, /\['jobPh'\]/);
});
