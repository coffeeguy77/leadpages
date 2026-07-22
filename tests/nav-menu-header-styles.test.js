'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ensureNavMenu } = require('../lib/lp-nav-menu-sync');

const ROOT = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
const demoJs = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.js'), 'utf8');
const demoCss = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.css'), 'utf8');
const trade = fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8');

describe('navMenu defaults', () => {
  it('defaults to header placement and icon + text', () => {
    assert.match(manage, /navMenu:\{on:false,style:'pills',align:'left',placement:'header',icons:'both',items:\[\]\}/);
    const nm = ensureNavMenu({});
    assert.equal(nm.placement, 'header');
    assert.equal(nm.icons, 'both');
    assert.match(demoJs, /nm\.placement\|\|'header'/);
    assert.match(demoJs, /nm\.icons\|\|'both'/);
  });
});

describe('header beside-logo menu styles', () => {
  it('applies nm-* style classes and CSS vars on header nav', () => {
    assert.match(demoJs, /_el\.classList\.add\('nm-'\+_st\)/);
    assert.match(demoJs, /_set\('--hn-fill'/);
    assert.match(demoJs, /_set\('--hn-stroke'/);
    assert.match(demoCss, /header\.site \.head-nav\.nm-pills \.hn-link/);
    assert.match(demoCss, /header\.site \.head-nav\.nm-solid \.hn-link/);
    assert.match(demoCss, /header\.site \.head-nav\.nm-outline \.hn-link/);
    assert.doesNotMatch(demoJs, /optional fill tint on header links/);
  });

  it('is synced into trade.template.json', () => {
    assert.match(trade, /nm-pills \.hn-link/);
    assert.match(trade, /placement\|\|'header'/);
    assert.match(trade, /icons\|\|'both'/);
    assert.match(trade, /--hn-fill/);
  });
});
