'use strict';

/**
 * "How many arrows?" form check, LeadPages palettes, stacked header / footer CTA / text size.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const FC = require('../lib/form-challenge');

async function answerOf(token) {
  for (let n = 1; n <= FC.MAX_ANSWER; n++) if ((await FC.verify(token, n)).ok) return n;
  return 0;
}

test('settings: off unless on === true; unknown style → arrows', () => {
  assert.deepEqual(FC.settings({}), { on: false, style: 'arrows' });
  assert.deepEqual(FC.settings({ formChallenge: { on: true, style: 'paws' } }), { on: true, style: 'paws' });
  assert.deepEqual(FC.settings({ formChallenge: { on: 'yes', style: 'nope' } }), { on: false, style: 'arrows' });
  assert.equal(FC.settings({ formChallenge: { on: true, style: 'mix' } }).style, 'mix');
});

test('every picture draws exactly the number of targets it asks about', () => {
  for (let i = 0; i < 400; i++) {
    const c = FC.MIN_COUNT + (i % (FC.MAX_COUNT - FC.MIN_COUNT + 1));
    const svg = FC.drawSvg('arrows', c);
    assert.equal((svg.match(/<path d="M331/g) || []).length, c);
  }
});

test('token: one right answer, signed, expires; never carries the answer', async () => {
  for (const style of FC.STYLE_KEYS) {
    const c = FC.create({ style });
    assert.equal(c.style, style);
    assert.match(c.image, /^data:image\/svg\+xml;base64,/);
    const n = await answerOf(c.token);
    assert.ok(n >= FC.MIN_COUNT && n <= FC.MAX_COUNT);
    const p = FC.decode(c.token);
    assert.equal(JSON.stringify(p).includes('"' + n + '"'), false);
  }
  const c = FC.create({});
  assert.deepEqual(await FC.verify('', 3), { ok: false, reason: 'missing' });
  assert.deepEqual(await FC.verify(c.token + 'x', 3), { ok: false, reason: 'bad_token' });
  const [body] = c.token.split('.');
  const forged = Buffer.from(JSON.stringify(Object.assign(FC.decode(c.token), { e: Date.now() + 9e9 }))).toString('base64url');
  assert.deepEqual(await FC.verify(forged + '.' + c.token.split('.')[1], 3), { ok: false, reason: 'bad_token' });
  void body;
});

test('one try per picture when the used-token table is there', async () => {
  const seen = new Set();
  const admin = { from: () => ({ insert: async (row) => (seen.has(row.jti) ? { error: { code: '23505' } } : (seen.add(row.jti), { error: null })) }) };
  const c = FC.create({});
  const n = await answerOf(c.token);   // no admin: not used up
  assert.deepEqual(await FC.verify(c.token, n === 1 ? 2 : 1, admin), { ok: false, reason: 'wrong' });
  assert.deepEqual(await FC.verify(c.token, n, admin), { ok: false, reason: 'used' });
  const broken = { from: () => ({ insert: async () => { throw new Error('no table'); } }) };
  assert.deepEqual(await FC.verify(c.token, n, broken), { ok: true });
});

test('endpoints check the answer only when the site has it on', () => {
  const leads = read('api/leads.js');
  assert.match(leads, /if \(siteRow && FormChallenge\.settings\(siteRow\.config\)\.on\) \{/);
  assert.match(leads, /error: 'challenge', reason: fc\.reason/);
  assert.match(read('api/consent-form.js'), /if \(FormChallenge\.settings\(cfg\)\.on\) \{/);
  const render = read('api/render.js');
  assert.match(render, /html = injectAttribution\(html, cfg\);\n    html = injectFormChallenge\(html, cfg\);/);
  assert.match(render, /if \(!st\.on\) return html;/);
  assert.match(read('db/form_challenge.sql'), /create table if not exists public\.form_challenge_used/);
  // Forms keep their fields after a miscount instead of saying thank you.
  assert.match(read('trade.template.json'), /if\(_cj&&_cj\.error===\\"challenge\\"\) return;/);
  assert.match(read('assets/lp-layouts.js'), /if \(r && r\.status === 400 && window\.LPChallenge\) \{ btn\.disabled = false;/);
  assert.match(read('assets/lp-consent.js'), /if \(j && j\.error === 'challenge'\)/);
  assert.match(read('manage.html'), /id="dash-fc-on"/);
});

test('LeadPages palettes in the visitor colour picker', () => {
  global.window = global;
  require('../assets/lp-visitor-schemes.js');
  const keys = Object.keys(global.LPVisitorSchemes.SCHEMES);
  assert.deepEqual(keys.slice(0, 5), ['brand', 'leadpages', 'ocean', 'sunset', 'grape']);
  const css = read('assets/lp-visitor-schemes.css');
  assert.match(css, /html\[data-lp-visitor-scheme="leadpages"\] \{\n  --pipe: #1565D8 !important;/);
  assert.match(read('manage.html'), /var colorSchemes=\['brand','leadpages','ocean','sunset','grape',/);
});

test('header stack, footer CTA, no-logo footer, text size, {{year}}', () => {
  const js = read('assets/lp-layouts.js');
  assert.match(js, /pageBlocks, headerStack, textScale, logoThemed, darkSections, footerTextCols, editorialLooks, subPageAnchors, cardLooks\]/);
  assert.match(js, /F\.logoMode === 'none'|F\.logoMode==='none'/);
  const css = read('assets/lp-layouts.css');
  assert.match(css, /\.lpl-hstack > \[data-sec="navMenu"\]\{order:1 !important\}/);
  assert.match(css, /\.lpl-hs-nobtn header\.site \.head-call\{display:none!important\}/);
  assert.match(css, /html\[data-lp-zoom\]\{zoom:calc\(var\(--lp-zoom,1\) \* var\(--lp-visitor-zoom,1\)\)\}/);
  const tpl = read('trade.template.json');
  assert.ok((tpl.match(/new Date\(\)\.getFullYear\(\)/g) || []).length >= 2);
  assert.ok((tpl.match(/mailto:\|tel:/g) || []).length >= 3);
});
