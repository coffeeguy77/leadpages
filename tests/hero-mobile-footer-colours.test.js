'use strict';

/**
 * Hero/editor mobile polish + header click-to-call + footer text/map colours.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const trade = () => JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
const manage = () => fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const adminCss = () => fs.readFileSync(path.join(root, 'assets/lp-admin-responsive.css'), 'utf8');

describe('Editor list/hero fields stack in narrow panes', () => {
  it('list editor uses le-fields grid-friendly markup', () => {
    const m = manage();
    assert.match(m, /class="le-fields"/);
    assert.match(m, /le-color-row/);
    assert.match(m, /le-f-full/);
  });

  it('admin responsive CSS stacks .row and le-fields via container queries', () => {
    const css = adminCss();
    assert.match(css, /@container lp-editor \(max-width: 900px\)/);
    assert.match(css, /\.le-row \.le-fields/);
    assert.match(css, /minmax\(min\(100%, 220px\), 1fr\)/);
  });
});

describe('Mobile hero / header logo CTA', () => {
  it('site-width-capped hero uses height not 16:9 crop on mobile', () => {
    const html = trade();
    assert.match(html, /aspect-ratio:auto;height:var\(--hsl-mh-m/);
  });

  it('float header becomes sticky on mobile and CTA is static', () => {
    const html = trade();
    assert.match(html, /lp-hdr-float\{position:sticky/);
    assert.match(html, /classList\.toggle\('lp-hdr-float'/);
    assert.match(html, /head-call\{position:static!important/);
  });
});

describe('Header phone click-to-call', () => {
  it('phone is an anchor and paint always sets tel href', () => {
    const html = trade();
    assert.match(html, /class="head-phone-num"/);
    assert.match(html, /_telHref/);
    assert.match(html, /H\.action==='form'/);
  });
});

describe('Footer text and map colour controls', () => {
  it('manage exposes ink / muted / map colour fields', () => {
    const m = manage();
    assert.match(m, /_ftCol\('ft-ink','inkColor'/);
    assert.match(m, /_ftCol\('ft-muted','mutedColor'/);
    assert.match(m, /_ftCol\('ft-map','mapColor'/);
    assert.match(m, /colWire\('ft-ink','inkColor'\)/);
    assert.match(m, /colWire\('ft-map','mapColor'\)/);
  });

  it('tenant paint applies --mkt-foot-ink / muted / map', () => {
    const html = trade();
    assert.match(html, /inkColor\|\|F\.ink/);
    assert.match(html, /mutedColor\|\|F\.muted/);
    assert.match(html, /mapColor\|\|F\.map/);
    assert.match(html, /setProperty\('--mkt-foot-map'/);
  });
});
