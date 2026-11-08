'use strict';

/**
 * Content blocks (page.blocks / textBox layout 'blocks'), the feature CTA banner, hero banner
 * options and the online consent form (Nov 2026, first used by Pam Connor & Associates).
 * Everything is opt-in, so existing sites render as before.
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
const html = JSON.parse(read('trade.template.json')).html;
const manage = read('manage.html');

/** Pull the blocks renderer out of lp-layouts.js and run it on its own. */
function blocksRenderer() {
  const start = js.indexOf('  var LPB_WARN');
  const end = js.indexOf('  function lpbCurrentPage');
  assert.ok(start > 0 && end > start, 'blocks code found');
  const helpers = `
    var location = { host: 'example.com', pathname: '/acme/page' };
    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function txt(v){ return String(v == null ? '' : v).trim(); }
    function icon(n){ return n && n !== 'nope' ? '<svg data-i="' + n + '"></svg>' : ''; }
    function hrefOf(v){ var s = txt(v); if (/^\\//.test(s)) return '/acme' + s; return s; }
    function linkAttrs(h){ return 'href="' + esc(h) + '"'; }
    function bgUrl(u){ return txt(u).replace(/[)\\s"'<>\\\\]/g, ''); }
    var CHECK = '<svg data-check></svg>', ARROW = '<svg data-arrow></svg>';`;
  const ctx = {};
  vm.runInNewContext(helpers + js.slice(start, end) + ';this.render=lpbRender;this.parse=lpbParse;', ctx);
  return ctx;
}

test('blocks: parse, nest, self-closing image / consent', () => {
  const B = blocksRenderer();
  const out = B.render([
    ':::heading Who we see', 'Intro **bold**', ':::',
    ':::cols ratio=2:1', ':::col', 'Left text', ':::', ':::image src="/a.jpg" alt="A"', ':::',
    ':::cards cols=3 style=link more="Learn More"', 'brain | Adult ADHD | Text | /adhd', ':::',
    ':::notice', 'Not accepting <script>', ':::',
    ':::faq', '? info | Question one', 'Answer [link](/x)', ':::',
    ':::consent'
  ].join('\n'));
  assert.match(out, /<h2 class="lpb-h2"><span class="lpb-rule"[^>]*><\/span>Who we see<\/h2>/);
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /--lpb-cols:2fr 1fr/);
  assert.match(out, /<figure class="lpb-img"><img src="\/a.jpg" alt="A"/);
  // the image closed itself, so the cards are not inside the columns
  assert.ok(out.indexOf('lpb-cards') > out.indexOf('</div><div class="lpb-cards'.slice(0, 6)));
  assert.match(out, /href="\/acme\/adhd">Learn More/);
  assert.match(out, /Not accepting &lt;script&gt;/);
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /<details class="lpb-faq-i"><summary><span class="lpb-faq-ic"><svg data-i="info">/);
  assert.match(out, /<a href="\/acme\/x">link<\/a>/);
  assert.match(out, /data-lp-consent/);
});

test('blocks: tables, ticks in panels, steps numbered, external links open in a new tab', () => {
  const B = blocksRenderer();
  const out = B.render([
    '| A | B |', '|---|---|', '| 1 | 2 |',
    ':::panel icon=brain title="Focus" price="$250"', '- one', '- two', ':::',
    ':::steps', 'users | First | a', 'mail | Second | b', ':::',
    '[Site](https://other.org)'
  ].join('\n'));
  assert.match(out, /<table class="lpb-table"><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr>/);
  assert.match(out, /<ul class="lpb-ticks"><li><span class="lpb-tick"><svg data-check>/);
  assert.match(out, /<span class="lpb-price"><b>\$250<\/b>/);
  assert.match(out, /<span class="lpb-num">1<\/span>[\s\S]*<span class="lpb-num">2<\/span>/);
  assert.match(out, /href="https:\/\/other.org" target="_blank" rel="noopener"/);
});

test('blocks are opt-in: template keeps the article as before unless page.blocks === true', () => {
  assert.match(html, /var _cls='lp-img-'\+\(p\.img\?_im:'none'\)\+\(p\.blocks===true\?' lp-blocks-wait':''\);/);
  assert.match(html, /p\.blocks===true\?String\(p\.body\|\|''\)\.replace\(\/\^ \*:::\.\*\$\/gm,''\):\(p\.body\|\|''\)/);
  assert.match(js, /if \(!p \|\| p\.blocks !== true\) \{ art\.classList\.remove\('lp-has-blocks'\); return; \}/);
  assert.match(js, /var blocksOn = TB\.layout === 'blocks';/);
  assert.match(css, /\.lp-blocks-wait \.lp-body\{opacity:0;animation:lpbShow 0s 2\.5s forwards\}/);
  assert.match(css, /\.tbx-blocks > :not\(\.tbk-wrap\)\{display:none!important\}/);
});

test('feature banner, hero options and enquiry block', () => {
  assert.match(js, /var featOn = M\.layout === 'feature';/);
  assert.match(js, /node\.classList\.toggle\('hsp-bold', on && HS\.headingWeight === 'bold'\)/);
  assert.match(js, /--hsc-w/);
  assert.match(js, /--hsc-min/);
  assert.match(css, /min-height:var\(--hsc-min,420px\)/);
  assert.match(js, /fetch\('\/api\/leads'/);
  assert.match(js, /\(typeof SITE_CONFIG !== 'undefined'\) \? SITE_CONFIG : window\.SITE_CONFIG/);
});

test('editor: blocks switch, textBox blocks, feature banner, hero options', () => {
  assert.match(manage, /<input type="checkbox" id="lp-blocks">/);
  assert.match(manage, /\['blocks','Designed sections \\u2014 cards, steps, notices, columns \(written as text\)'\]/);
  assert.match(manage, /\['feature','Feature \\u2014 round icon or photo, divider, heading, button'\]/);
  for (const k of ['featureImage', 'headingWeight', 'coverTextWidth', 'coverMinHeight']) assert.match(manage, new RegExp("k:'" + k + "'"), k);
  const L = read('lib/ai-composer/layouts.js');
  assert.match(L, /ctaBanner: \['', 'boxes', 'notice', 'quote', 'feature'\]/);
  assert.match(L, /textBox: \['blocks'\]/);
});

/* ---------------- Consent form ---------------- */
const CF = require('../lib/consent-form');
const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(400, 1)]).toString('base64');
const FORM = {
  on: true, recipient: 'practice@example.com', title: 'New patient form',
  documents: [{ title: 'Info sheet', body: 'Read **this**.' }, { title: 'Privacy', body: '- a\n- b', initial: true }],
  fields: [{ k: 'fullName', label: 'Full name', req: true }, { k: 'email', label: 'Email', type: 'email', req: true }, { k: 'dob', label: 'Date of birth', type: 'date' }],
  declaration: 'I, {name}, agree.'
};
const PAGE = { slug: 'new-patient-form', blocks: true, body: ':::consent\n:::', consentForm: FORM };
const good = () => ({ answers: { fullName: 'Jo Bloggs', email: 'jo@example.com', dob: '1990-01-02' }, read: { 0: true, 1: true }, initials: { 1: 'JB' }, signedName: 'Jo Bloggs', agree: true, signature: PNG });

test('consent form: only live on a blocks page with a consent block', () => {
  assert.ok(CF.formOf(PAGE));
  assert.equal(CF.formOf(Object.assign({}, PAGE, { blocks: false })), null);
  assert.equal(CF.formOf(Object.assign({}, PAGE, { body: 'no form here' })), null);
  assert.equal(CF.formOf(Object.assign({}, PAGE, { consentForm: Object.assign({}, FORM, { on: false }) })), null);
});

test('consent form: validation', () => {
  assert.equal(CF.validate(FORM, good()).ok, true);
  const v = (patch) => CF.validate(FORM, Object.assign(good(), patch)).errors;
  assert.deepEqual(v({ answers: { fullName: '', email: 'jo@example.com' } }), ['fullName']);
  assert.deepEqual(v({ answers: { fullName: 'Jo', email: 'nope' } }), ['email']);
  assert.deepEqual(v({ read: { 0: true } }), ['read:1']);
  assert.deepEqual(v({ initials: {} }), ['initials:1']);
  assert.deepEqual(v({ agree: false }), ['agree']);
  assert.deepEqual(v({ signature: 'data:image/png;base64,AAAA' }), ['signature']);
  assert.deepEqual(v({ signature: 'data:image/jpeg;base64,' + Buffer.alloc(400).toString('base64') }), ['signature']);
});

test('consent form: builds a PDF', async () => {
  const v = CF.validate(FORM, Object.assign(good(), { signature: realPng() }));
  const pdf = await CF.buildPdf({ business: 'Acme Psychology', form: FORM, data: v.data, when: new Date('2026-11-05T01:00:00Z') });
  assert.equal(pdf.slice(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 2000);
  assert.equal(CF.isoDay(new Date('2026-11-04T14:00:00Z')), '2026-11-05');   // Australian date, not UTC
});

test('consent API: recipient comes from saved config only, nothing is stored', () => {
  const api = read('api/consent-form.js');
  assert.match(api, /Recipient comes only from the saved site config, never from the request\./);
  assert.doesNotMatch(api, /\.insert\(|\.upsert\(|\.update\(/);
  assert.match(api, /limited\(req, \{ key: 'consent-form'/);
  assert.match(api, /CF\.clean\(body\.hp, 200\)/);
});

/** A tiny valid 1×1 PNG for pdfkit. */
function realPng() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' +
    '';
}

test('blocks: tabs (first content tab open, link tab, #id) and list steps', () => {
  const B = blocksRenderer();
  const out = B.render([
    ':::tabs',
    ':::tab id=one icon=user title="Tab One"', 'First **panel**', ':::',
    ':::tab id=two title="Tab Two"', 'Second panel', ':::',
    ':::tab title="Elsewhere" href=/other', ':::',
    ':::',
    ':::steps layout=list', 'users | Step A | Detail A', 'file | Step B | Detail B', ':::'
  ].join('\n'));
  assert.match(out, /<div class="lpb-tabs" data-lpb-tabs>/);
  assert.match(out, /class="lpb-tab is-on"[^>]*aria-selected="true" data-lpb-tab="one"/);
  assert.match(out, /data-lpb-tab="two"/);
  assert.match(out, /<a class="lpb-tab lpb-tab-link" href="\/acme\/other">/);
  assert.match(out, /<div class="lpb-tabpanel" role="tabpanel" id="lpbp-one" aria-labelledby="lpbt-one"><p>First <strong>panel<\/strong>/);
  assert.match(out, /id="lpbp-two" aria-labelledby="lpbt-two" hidden>/);
  assert.doesNotMatch(out, /lpbp-t3/);
  assert.match(out, /<ol class="lpb-steps lpb-steps-list">/);
  assert.match(out, /<div class="lpb-step-card">.*Step A.*Detail A/);
});

test('blocks: editorial looks — heading rule under, numbered rows, open FAQ, quote, lead, image options', () => {
  const B = blocksRenderer();
  const out = B.render([
    ':::heading Your journey rule=under', ':::',
    ':::steps layout=rows', '01 | Before | **Buying:** first\\n**Selling:** second', '02 | After | Done', ':::',
    ':::faq layout=list', '? Question one', 'Answer one', ':::',
    ':::quote cite="From clients"', '“Easy!”', ':::',
    ':::lead', 'A standfirst.', ':::',
    ':::image src="/a.jpg" alt="" ratio=3:4 phone=hide frame=none'
  ].join('\n'));
  assert.match(out, /<div class="lpb-head lpb-head-under"><h2 class="lpb-h2">/);
  assert.match(out, /<li class="lpb-row"><span class="lpb-row-no" aria-hidden="true">01<\/span><h3 class="lpb-row-t">Before<\/h3><div class="lpb-row-b"><p><strong>Buying:<\/strong> first<\/p><p><strong>Selling:<\/strong> second<\/p><\/div><\/li>/);
  assert.match(out, /<div class="lpb-faql"><div class="lpb-faql-i"><h3 class="lpb-faql-q">Question one<\/h3>/);
  assert.match(out, /<figure class="lpb-quote"><blockquote>“Easy!”<\/blockquote>.*<figcaption>From clients<\/figcaption>/);
  assert.match(out, /<p class="lpb-lead">A standfirst.<\/p>/);
  assert.match(out, /<figure class="lpb-img lpb-img-nophone lpb-img-plain"/);
  assert.doesNotMatch(out, /<details/);
});

test('editorial section options are opt-in (hero highlight line, strip banner, dark sections, footer text, plain cards, serif quotes, font set)', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '../assets/lp-layouts.js'), 'utf8');
  assert.match(js, /node\.classList\.toggle\('hsl-hl-break', HS\.highlightBreak === true\);/);
  assert.match(js, /var stripOn = M\.layout === 'strip';/);
  assert.match(js, /node\.classList\.toggle\('lpl-on-dark', l >= 0 && l < 0\.12\);/);
  assert.match(js, /if \(c\.mode !== 'text' \|\| !txt\(c\.text\)\) return;/);
  assert.match(js, /\(S\.services \|\| \{\}\)\.photoCard === 'plain'/);
  assert.match(js, /quoteLook === 'serif'/);
  assert.match(js, /C\.sectionHeadLine === true/);
  const F = require('../assets/lp-fonts.js');
  assert.ok(F.ORDER.includes('editorial'));
  assert.match(F.css('editorial'), /--lp-font-head:"Source Serif 4"/);
});
