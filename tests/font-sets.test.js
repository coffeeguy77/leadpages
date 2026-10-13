'use strict';

/** Site font sets (config.fontSet, assets/lp-fonts.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test';

const root = path.join(__dirname, '..');
const F = require('../assets/lp-fonts.js');
const { _injectFontSet } = require('../api/render.js');
const PAGE = '<html><head><title>x</title></head><body></body></html>';

test('every font set is complete and listed', () => {
  assert.deepEqual(F.ORDER.slice().sort(), Object.keys(F.SETS).sort());
  for (const k of F.ORDER) {
    const s = F.SETS[k];
    assert.ok(s.label && s.head.family && s.body.family, k);
    if (k !== 'classic') assert.match(F.googleUrl(s), /^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
  }
  assert.ok(F.ORDER.length >= 6);
});

test('the Archivo set gives extra-condensed heavy headings in normal case', () => {
  const css = F.css('archivo');
  assert.match(css, /--lp-font-head:"Archivo"/);
  assert.match(css, /--lp-font-head-stretch:62%/);
  assert.match(css, /h1,h2,h3,\.display\{font-weight:900;text-transform:none/);
});

test('no set / classic / unknown set leaves the page byte-for-byte unchanged', () => {
  assert.equal(_injectFontSet(PAGE, {}), PAGE);
  assert.equal(_injectFontSet(PAGE, { fontSet: 'classic' }), PAGE);
  assert.equal(_injectFontSet(PAGE, { fontSet: 'nope' }), PAGE);
  assert.equal(_injectFontSet(PAGE, null), PAGE);
});

test('a set is added once, at the end of <head>', () => {
  const out = _injectFontSet(PAGE, { fontSet: 'oswald' });
  assert.match(out, /<link id="lp-fontset-link" rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Oswald[^"]*"><style id="lp-fontset">[^<]*<\/style><\/head>/);
  assert.equal(_injectFontSet(out, { fontSet: 'oswald' }), out);
});

test('template and app stylesheets read the font variables (Barlow stays the fallback)', () => {
  const html = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
  for (const src of [html, fs.readFileSync(path.join(root, 'assets/lp-layouts.css'), 'utf8')]) {
    assert.doesNotMatch(src, /(?<!--lp-font-(?:head|body),)"Barlow( Condensed)?"/);
    assert.match(src, /var\(--lp-font-head,"Barlow Condensed"\)/);
    assert.match(src, /var\(--lp-font-body,"Barlow"\)/);
  }
});

test('the editor has a Fonts picker and the preview switches live', () => {
  const m = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  assert.match(m, /<script src="\/assets\/lp-fonts\.js\?v=\d+"><\/script>/);
  assert.match(m, /function lpMountFontCard/);
  const js = fs.readFileSync(path.join(root, 'assets/lp-layouts.js'), 'utf8');
  assert.match(js, /bookingHire, fontSet(, mobileBarSpace)?\]/);
});
