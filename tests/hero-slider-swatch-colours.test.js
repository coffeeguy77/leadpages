/**
 * Hero slider colour swatches must mirror site theme defaults
 * (not a hardcoded #1a2230 for every field).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

test('list editor colour helpers resolve site theme defaults', function() {
  assert.match(manage, /function listColorDefault\(/);
  assert.match(manage, /function listColorSwatchValue\(/);
  assert.match(manage, /function siteThemeColors\(/);
  assert.match(manage, /listColorSwatchValue\(_tv,_k,c\)/);
  assert.doesNotMatch(
    manage,
    /\.le-color[\s\S]{0,120}ci\.value=\([^)]*\)\?_tv:'#1a2230'/
  );
});

test('hero slide colour defaults map to theme roles', function() {
  // Extract listColorDefault body mapping
  const m = manage.match(/function listColorDefault\(key, c\)\{([\s\S]*?)\n  \}/);
  assert.ok(m, 'listColorDefault present');
  const body = m[1];
  assert.match(body, /highlightColor:t\.hivis/);
  assert.match(body, /featureTextColor:t\.white/);
  assert.match(body, /eyebrowColor:t\.white/);
  assert.match(body, /headingColor:t\.white/);
  assert.match(body, /primaryCtaBg:t\.hivis/);
  assert.match(body, /primaryCtaFg:t\.white/);
  assert.match(body, /secondaryCtaBg:t\.white/);
  assert.match(body, /secondaryCtaFg:t\.ink/);
  assert.match(body, /bgColour:t\.steel/);
});

test('hero slides schema exposes eyebrow and heading colour pickers', function() {
  const m = manage.match(/heroSlides:\{secId:'heroSlider'[\s\S]*?rowHeader:heroSlideRowHeader\}/);
  assert.ok(m, 'heroSlides schema present');
  const schema = m[0];
  assert.match(schema, /\{k:'eyebrowColor',label:'Eyebrow colour',type:'color'\}/);
  assert.match(schema, /\{k:'headingColor',label:'Heading colour',type:'color'\}/);
  assert.match(schema, /\{k:'featureTextColor',label:'Feature text colour',type:'color'\}/);
  assert.match(schema, /eyebrowColor:''/);
  assert.match(schema, /headingColor:''/);
});

test('colour placeholder shows site default not hardcoded steel', function() {
  assert.match(manage, /placeholder="'\+_cdef\+'\s*\(site\)"/);
});

test('hero slider text colours inherit unless overridden (templates + demo)', function() {
  const fs = require('fs');
  const path = require('path');
  const trade = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'trade.template.json'), 'utf8')).html;
  const shell = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'landing-shell-neutral-v1.template.json'), 'utf8')).html;
  const demoCss = fs.readFileSync(path.join(__dirname, '..', 'marketplace/demos/demo-shared.css'), 'utf8');
  const demoJs = fs.readFileSync(path.join(__dirname, '..', 'marketplace/demos/demo-shared.js'), 'utf8');
  for (const html of [trade, shell, demoCss]) {
    assert.match(html, /\.hsl-eyebrow\{color:inherit/);
    assert.match(html, /\.hsl-h\{[^}]*color:inherit/);
    assert.match(html, /\.hsl-sub\{color:inherit/);
    assert.doesNotMatch(html, /\.hsl-eyebrow\{color:#fff/);
  }
  for (const js of [trade, shell, demoJs]) {
    assert.match(js, /_ebc=_hslCol\(s\.eyebrowColor\)/);
    assert.match(js, /_hdc=_hslCol\(s\.headingColor\)/);
    assert.match(js, /hsl-eyebrow"'\+_ebSt/);
    assert.match(js, /hsl-h"'\+_hdSt/);
  }
});
