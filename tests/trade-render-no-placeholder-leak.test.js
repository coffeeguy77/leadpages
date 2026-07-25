'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  prepareTradeLiveHtml,
  TRADE_RESIDUAL,
  stalePlumbingEmerg,
  altHeroOn
} = require('../lib/trade-render-guard');

const trade = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'trade.template.json'), 'utf8')
).html;

const PLUMBING = /blocked drain|we'll clear it today|24\/7 emergency plumber|licensed canberra plumber|speak to a plumber/i;

describe('live trade render — no plumbing placeholder leak', () => {
  it('trade shell static hero/emerg mounts are empty of plumbing copy', () => {
    const hero = trade.match(/<section class="hero" data-sec="hero">[\s\S]*?<\/section>/);
    assert.ok(hero);
    assert.doesNotMatch(hero[0], PLUMBING);
    const emerg = trade.match(/<div class="emerg" data-sec="emerg">[\s\S]*?<\/div>/);
    assert.ok(emerg);
    assert.doesNotMatch(emerg[0], /Emergency Plumber|Burst pipe/i);
    assert.match(trade, /Speak to a plumber|Call us/);
    assert.match(trade, />Call us</);
  });

  it('hides classic hero when heroSlider is on (coffee site FOUC guard)', () => {
    const cfg = {
      business: 'Bean Culture',
      trade: 'Coffee cart hire',
      sections: {
        heroSlider: {
          on: true,
          slides: [
            {
              eyebrow: 'Coffee Cart Hire · Canberra',
              heading: 'Real coffee, wheeled to your event',
              subText: 'Baristas and carts for weddings and corporate events.'
            }
          ]
        },
        emerg: { on: true, text: '⚠ 24/7 Emergency Plumber — Burst pipe or flooding?' },
        hero: { on: false, title: 'Blocked drain?', titleHl: "We'll clear it today." }
      }
    };
    assert.equal(altHeroOn(cfg), true);
    assert.equal(stalePlumbingEmerg(cfg), true);
    const html = prepareTradeLiveHtml(trade, cfg);
    assert.match(html, /data-sec="hero"[^>]*hidden/i);
    assert.match(html, /data-sec="emerg"[^>]*hidden/i);
    // Residual plumbing must not remain visible in first-byte HTML mounts
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    assert.doesNotMatch(withoutScripts, /Blocked drain\?/i);
    assert.doesNotMatch(withoutScripts, /We'll clear it today/i);
    assert.doesNotMatch(withoutScripts, /24\/7 Emergency Plumber/i);
  });

  it('keeps plumbing copy when the site config owns it', () => {
    const cfg = {
      business: "Duncan's Plumbing",
      trade: 'Plumber',
      sections: {
        hero: {
          on: true,
          eyebrow: 'Licensed Canberra plumber · Same-day',
          title: 'Blocked drain?',
          titleHl: "We'll clear it today.",
          sub: 'Fast, fixed-price plumbing across the ACT — blocked drains, burst pipes, hot water and leaks.'
        },
        emerg: { on: true, text: '⚠ 24/7 Emergency Plumber — Burst pipe or flooding?' }
      }
    };
    assert.equal(stalePlumbingEmerg(cfg), false);
    const html = prepareTradeLiveHtml(trade, cfg);
    assert.match(html, /Blocked drain\?/i);
    assert.match(html, /We'll clear it today/i);
    assert.match(html, /24\/7 Emergency Plumber/i);
  });

  it('injects FOUC guard + cfg-ready hook', () => {
    const html = prepareTradeLiveHtml(trade, { sections: {} });
    assert.match(html, /id="lp-fouc-guard"/);
    assert.match(html, /lp-cfg-ready/);
    assert.match(html, TRADE_RESIDUAL); // pattern export sanity
  });

  it('hides inactive Services (and other off sections) before first paint', () => {
    const cfg = {
      business: 'Bean Culture',
      trade: 'Coffee cart hire',
      sections: {
        heroSlider: { on: true, slides: [{ heading: 'Coffee' }] },
        hero: { on: false },
        services: { on: false },
        seoText: { on: true, h1: 'Premium Event Coffee', content: 'Our Coffee Offerings\nGreat beans for events.' },
        faq: {},
        emerg: { on: false }
      },
      sectionOrder: ['heroSlider', 'seoText', 'faq', 'footer']
    };
    const html = prepareTradeLiveHtml(trade, cfg);
    assert.match(html, /data-sec="services"[^>]*hidden/i);
    assert.match(html, /id="lp-section-order"/);
    assert.match(html, /\[data-sec="seoText"\]\{order:\d+!important\}/);
    assert.match(html, /function __lpFormatSeoText/);
    assert.match(html, /seotxt-h3/);
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    assert.doesNotMatch(withoutScripts, /Blocked Drains/i);
  });

  it('api/render.js wires prepareTradeLiveHtml', () => {
    const render = fs.readFileSync(path.join(__dirname, '..', 'api/render.js'), 'utf8');
    assert.match(render, /trade-render-guard/);
    assert.match(render, /prepareTradeLiveHtml/);
  });

  it('manage.html no longer defaults hero/emerg to plumbing placeholders', () => {
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /hero:\{eyebrow:'', title:'', titleHl:'', sub:''\}/);
    assert.match(manage, /emerg:\{text:''\}/);
    assert.match(manage, /Never fall back to plumbing placeholder defaults/);
    assert.match(manage, /Supporting copy — blank line = paragraph/);
    assert.match(manage, /\*\*bold\*\*/);
    assert.match(manage, /resize:vertical/);
  });
});
