/**
 * About Us image/quote/fonts + LeadPages logo in site footer.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-about-us.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/lp-about-us.js'), 'utf8');
const demoShared = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const fields = fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8');

test('About Us headings use Barlow Condensed (not Georgia)', function () {
  assert.match(css, /\.au-heading\{[^}]*Barlow Condensed/);
  assert.match(css, /\.au-band-heading\{[^}]*Barlow Condensed/);
  assert.doesNotMatch(css, /\.au-heading\{[^}]*Georgia/);
  assert.doesNotMatch(css, /\.au-band-heading\{[^}]*Georgia/);
});

test('About Us headings support multiline via white-space pre-line', function () {
  assert.match(css, /\.au-heading\{[^}]*white-space:pre-line/);
  assert.match(css, /\.au-band-heading\{[^}]*white-space:pre-line/);
  assert.match(js, /setMultilineText/);
  assert.match(manage, /Heading \(line breaks allowed\)/);
});

test('About Us image fills 1\/3 column edge-to-edge with fit\/position tools', function () {
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(css, /\.au-col-media\{[^}]*position:relative/);
  assert.match(css, /--au-img-fit/);
  assert.match(css, /object-fit:var\(--au-img-fit/);
  assert.match(js, /--au-img-fit/);
  assert.match(js, /imageFit/);
  assert.match(manage, /id="au-img-fit"/);
  assert.match(manage, /id="au-img-pos"/);
  assert.match(manage, /imageFit:'cover'/);
});

test('About Us quote handwriting \/ plain + show\/hide', function () {
  assert.match(css, /Caveat/);
  assert.match(css, /data-au-quote-style="handwriting"/);
  assert.match(css, /data-au-quote-style="plain"/);
  assert.match(js, /quoteStyle/);
  assert.match(js, /quoteOn/);
  assert.match(manage, /id="au-quote-on"/);
  assert.match(manage, /id="au-quote-style"/);
  assert.match(manage, /quoteStyle:'handwriting'/);
});

test('About Us quote overlays image with size and position sliders', function () {
  assert.match(css, /--au-quote-x/);
  assert.match(css, /--au-quote-y/);
  assert.match(css, /--au-quote-size/);
  assert.match(css, /transform:translate\(-50%,-50%\)/);
  assert.match(js, /--au-quote-x/);
  assert.match(js, /quoteSize/);
  assert.match(js, /quoteX/);
  assert.match(js, /quoteY/);
  assert.match(js, /quoteScrim/);
  assert.match(manage, /id="au-quote-size"/);
  assert.match(manage, /id="au-quote-x"/);
  assert.match(manage, /id="au-quote-y"/);
  assert.match(manage, /id="au-quote-scrim"/);
  assert.match(manage, /quoteSize:100/);
  assert.match(manage, /quoteX:50/);
  assert.match(manage, /quoteY:78/);
  assert.match(fields, /sections\.aboutUs\.quoteX/);
  assert.match(fields, /sections\.aboutUs\.quoteSize/);
});

test('About Us section has full text colour styling options', function () {
  assert.match(css, /--au-eyebrow/);
  assert.match(css, /--au-intro/);
  assert.match(css, /--au-body/);
  assert.match(css, /--au-cta/);
  assert.match(css, /--au-quote-color/);
  assert.match(js, /eyebrowColor/);
  assert.match(js, /introColor/);
  assert.match(js, /bodyColor/);
  assert.match(js, /ctaColor/);
  assert.match(js, /quoteColor/);
  assert.match(manage, /Section colours/);
  assert.match(manage, /_auCol\('au-eyebrow'/);
  assert.match(manage, /_auCol\('au-heading'/);
  assert.match(manage, /_auCol\('au-intro'/);
  assert.match(manage, /_auCol\('au-body'/);
  assert.match(manage, /_auCol\('au-quote-color'/);
  assert.match(manage, /colWire\('au-eyebrow','eyebrowColor'\)/);
  assert.match(manage, /colWire\('au-quote-color','quoteColor'\)/);
  assert.match(manage, /imageAlt/);
  assert.match(fields, /sections\.aboutUs\.eyebrowColor/);
  assert.match(fields, /sections\.aboutUs\.bodyColor/);
});

test('Footer can host LeadPages logo; Privacy\/Terms move beside copyright', function () {
  assert.match(manage, /id="ft-lplogo"/);
  assert.match(manage, /leadpagesLogoInFooter/);
  assert.match(demoShared, /leadpagesLogoInFooter/);
  assert.match(demoShared, /_lpMountFooterLogoInto/);
  assert.match(demoShared, /f-pipe/);
  assert.match(demoShared, /f-links-lp-logo/);
  assert.match(demoShared, /data-lp-moved/);
  const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
  assert.match(trade, /f-legal-piped/);
  assert.match(trade, /foot-lp-logo-host/);
  assert.match(trade, /leadpagesLogoInFooter/);
});
