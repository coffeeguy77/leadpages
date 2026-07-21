'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(ROOT, 'manage.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.js'), 'utf8');
const tradeHtml = JSON.parse(fs.readFileSync(path.join(ROOT, 'trade.template.json'), 'utf8')).html;

describe('section style pickers', () => {
  it('header CTA exposes button and phone colour pickers', () => {
    assert.match(manage, /hdCol\('hd-btnbg','btnBg'/);
    assert.match(manage, /hdCol\('hd-btnfg','btnFg'/);
    assert.match(manage, /hdCol\('hd-btnbd','btnBorder'/);
    assert.match(manage, /hdCol\('hd-phonefg','phoneFg'/);
    assert.match(manage, /colWire\('hd-btnbg','btnBg'\)/);
    assert.match(js, /--hdr-cta-bg/);
    assert.match(js, /--hdr-phone-fg/);
    assert.match(css, /--hdr-cta-bg/);
  });

  it('nav menu beside logo can set link and hover colours', () => {
    assert.match(manage, /id="nm-fg"/);
    assert.match(manage, /id="nm-hfg"/);
    assert.match(manage, /id="nm-hbg"/);
    assert.match(js, /--hn-fg/);
    assert.match(css, /var\(--hn-fg/);
  });

  it('Why Us eyebrow colour overrides inline safety and spaces from title', () => {
    assert.match(js, /--why-eyebrow/);
    assert.match(js, /_wyEb\.style\.removeProperty\('color'\)/);
    assert.match(css, /section\[data-sec="why"\] \.eyebrow\{color:var\(--why-eyebrow,inherit\)!important\}/);
    assert.match(css, /\.why h2\{[^}]*margin-top:10px/);
    assert.equal(tradeHtml.includes('class="eyebrow" style="color:var(--safety)"'), false);
  });

  it('FAQ style card and live colour vars exist', () => {
    assert.match(manage, /function faqStyleCard/);
    assert.match(manage, /wireFaqStyle\(c\)/);
    assert.match(manage, /col\('faq-eyebrow','eyebrowColor'/);
    assert.match(manage, /colWire\('faq-eyebrow','eyebrowColor'\)/);
    assert.match(js, /--faq-eyebrow/);
    assert.match(css, /--faq-summary/);
    assert.match(css, /--faq-answer/);
  });

  it('Trust Bar image tiles expose fit and position', () => {
    assert.match(manage, /trustBar:\{secId:'trustBar'[\s\S]*imageFit[\s\S]*imagePos/);
    assert.match(js, /b\.imageFit==='stretch'/);
  });

  it('Hero Slider image fit includes stretch', () => {
    assert.match(manage, /heroSlides:\{secId:'heroSlider'[\s\S]*\['stretch','Stretch \(distort\)'\]/);
    assert.match(js, /_fit==='fill'\|\|_fit==='stretch'/);
  });

  it('Quote form section colours + eyebrow spacing', () => {
    assert.match(manage, /colWire\('qf-eyebrow','eyebrowColor'\)/);
    assert.match(manage, /colWire\('qf-heading','headingColor'\)/);
    assert.match(manage, /colWire\('qf-intro','introColor'\)/);
    assert.match(js, /--quote-eyebrow/);
    assert.match(js, /--quote-heading/);
    assert.match(js, /--quote-intro/);
    assert.match(css, /\.quote h2\{[^}]*margin-top:10px/);
  });
});
