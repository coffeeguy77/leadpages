/**
 * About Us marketplace app — story layout + optional navy CTA band.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const {
  OPTIONAL_SECTIONS,
  OFF_BY_DEFAULT,
  resolveSectionOrder
} = require('../lib/section-order');
const { SECTION_CATEGORY } = require('../lib/marketplace-categories');
const appContent = require('../marketplace/app-content.json');
const sellTemplates = require('../marketplace/sell-templates.json');
const fieldDefs = require('../marketplace/playground-field-defs.json');
const defaults = require('../marketplace/playground-default-configs.json');

test('aboutUs is optional / off-by-default', function () {
  assert.ok(OPTIONAL_SECTIONS.indexOf('aboutUs') >= 0);
  assert.ok(OFF_BY_DEFAULT.indexOf('aboutUs') >= 0);
  assert.match(manage, /OPTIONAL_COMPONENTS\s*=\s*\[[^\]]*aboutUs/);
  assert.match(manage, /OFF_BY_DEFAULT_SECTIONS\s*=\s*\[[^\]]*aboutUs/);
  assert.match(manage, /\['aboutUs','About Us'\]/);
  assert.match(manage, /aboutUs:\{on:false,layout:'story'/);
});

test('resolveSectionOrder places aboutUs near hero when on', function () {
  const off = resolveSectionOrder({
    sections: { aboutUs: { on: false }, hero: {} }
  });
  assert.ok(off.indexOf('aboutUs') < 0);

  const on = resolveSectionOrder({
    sections: { aboutUs: { on: true }, hero: {} }
  });
  assert.ok(on.indexOf('aboutUs') >= 0);
  assert.ok(on.indexOf('aboutUs') > on.indexOf('hero'));
});

test('manage _orderList includes aboutUs when enabled', function () {
  const layoutsMatch = manage.match(/const LAYOUTS\s*=\s*(\{[\s\S]*?\});\s*\n\s*function getLayout/);
  assert.ok(layoutsMatch, 'LAYOUTS present');
  const optMatch = manage.match(/const OPTIONAL_COMPONENTS\s*=\s*(\[[^\]]+\])/);
  const offMatch = manage.match(/const OFF_BY_DEFAULT_SECTIONS\s*=\s*(\[[^\]]+\])/);
  const startEnsure = manage.indexOf('function _orderEnsure(base, id, afterIds)');
  const endList = manage.indexOf('function wireOrder(c)');
  assert.ok(startEnsure > 0 && endList > startEnsure);

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    'LAYOUTS = ' + layoutsMatch[1] + ';\n'
    + 'OPTIONAL_COMPONENTS = ' + optMatch[1] + ';\n'
    + 'OFF_BY_DEFAULT_SECTIONS = ' + offMatch[1] + ';\n'
    + 'function getLayout(layoutId){ return (layoutId && LAYOUTS[layoutId]) ? LAYOUTS[layoutId] : LAYOUTS.classic; }\n'
    + 'function _secOn(c,id){ var s=(c&&c.sections&&c.sections[id])||{}; return (OFF_BY_DEFAULT_SECTIONS.indexOf(id)>=0)?(s.on===true):(s.on!==false); }\n'
    + manage.slice(startEnsure, endList),
    sandbox
  );

  const ord = sandbox._orderList({
    layout: 'classic',
    sections: { aboutUs: { on: true }, hero: {} }
  });
  assert.ok(ord.indexOf('aboutUs') >= 0);
});

test('marketplace catalog + demo coverage for aboutUs', function () {
  assert.ok(appContent.aboutUs);
  assert.equal(appContent.aboutUs.name, 'About Us');
  assert.ok(sellTemplates.aboutUs);
  assert.ok(fieldDefs.aboutUs);
  assert.ok(fieldDefs.aboutUs.some(function (f) { return f.key === 'sections.aboutUs.layout'; }));
  assert.ok(fieldDefs.aboutUs.some(function (f) { return f.key === 'sections.aboutUs.bandOn'; }));
  assert.equal(SECTION_CATEGORY.aboutUs, 'core-content');
  assert.ok(defaults.aboutUs && defaults.aboutUs.aboutUs);
  assert.equal(defaults.aboutUs.aboutUs.layout, 'story');
  assert.equal(defaults.aboutUs.aboutUs.bandOn, true);
  assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-aboutUs.html')));
  assert.ok(fs.existsSync(path.join(root, 'assets/lp-about-us.js')));
  assert.ok(fs.existsSync(path.join(root, 'assets/lp-about-us.css')));
});

test('trade + landing templates mount About Us', function () {
  ['trade.template.json', 'landing-shell-neutral-v1.template.json'].forEach(function (name) {
    const html = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')).html;
    assert.match(html, /data-sec="aboutUs"/, name + ' section');
    assert.match(html, /au-band/, name + ' band');
    assert.match(html, /lp-about-us\.css/, name + ' css');
    assert.match(html, /lp-about-us\.js/, name + ' runtime');
    assert.match(html, /lpApplyAboutUs/, name + ' apply hook');
    assert.match(html, /'aboutUs'/, name + ' visibility list');
  });
});

test('lpApplyAboutUs paints story layout and optional band', function () {
  const src = fs.readFileSync(path.join(root, 'assets/lp-about-us.js'), 'utf8');
  const nodes = {};
  function el(tag, cls) {
    const store = { tag: tag, className: cls || '', attrs: {}, style: {}, children: [], textContent: '', innerHTML: '', classList: null };
    const classSet = new Set((cls || '').split(/\s+/).filter(Boolean));
    store.classList = {
      add: function (c) { classSet.add(c); store.className = Array.from(classSet).join(' '); },
      remove: function (c) { classSet.delete(c); store.className = Array.from(classSet).join(' '); },
      toggle: function (c, force) {
        if (force === true) classSet.add(c);
        else if (force === false) classSet.delete(c);
        else if (classSet.has(c)) classSet.delete(c); else classSet.add(c);
        store.className = Array.from(classSet).join(' ');
      },
      contains: function (c) { return classSet.has(c); }
    };
    store.style.setProperty = function (k, v) { store.style[k] = v; };
    store.style.removeProperty = function (k) { delete store.style[k]; };
    store.setAttribute = function (k, v) { store.attrs[k] = v; };
    store.removeAttribute = function (k) { delete store.attrs[k]; };
    store.querySelector = function (sel) {
      const map = {
        '.au-eyebrow': 'eyebrow',
        '.au-heading': 'heading',
        '.au-intro': 'intro',
        '.au-body': 'body',
        '.au-cta': 'cta',
        '.au-cta-label': 'ctaLabel',
        '.au-col-media': 'media',
        '.au-media-wrap': 'wrap',
        '.au-img': 'img',
        '.au-quote': 'quote',
        '.au-quote-text': 'quoteText',
        '.au-quote-attr': 'quoteAttr',
        '.au-band': 'band',
        '.au-band-heading': 'bandHeading',
        '.au-band-sub': 'bandSub',
        '.au-band-cta': 'bandCta',
        '.au-band-cta-label': 'bandCtaLabel',
        '.au-band-tag': 'bandTag',
        '.au-band-tagline': 'bandTagline'
      };
      const key = map[sel];
      return key ? nodes[key] : null;
    };
    return store;
  }

  nodes.root = el('section', 'au-section');
  nodes.eyebrow = el('span', 'au-eyebrow');
  nodes.heading = el('h2', 'au-heading');
  nodes.intro = el('p', 'au-intro');
  nodes.body = el('div', 'au-body');
  nodes.cta = el('a', 'au-cta');
  nodes.ctaLabel = el('span', 'au-cta-label');
  nodes.cta.querySelector = function (sel) { return sel.indexOf('cta-label') >= 0 ? nodes.ctaLabel : null; };
  nodes.media = el('div', 'au-col-media');
  nodes.wrap = el('div', 'au-media-wrap');
  nodes.img = el('img', 'au-img');
  nodes.quote = el('blockquote', 'au-quote');
  nodes.quoteText = el('p', 'au-quote-text');
  nodes.quoteAttr = el('cite', 'au-quote-attr');
  nodes.band = el('div', 'au-band');
  nodes.bandHeading = el('h3', 'au-band-heading');
  nodes.bandSub = el('p', 'au-band-sub');
  nodes.bandCta = el('a', 'au-band-cta');
  nodes.bandCtaLabel = el('span', 'au-band-cta-label');
  nodes.bandCta.querySelector = function (sel) { return sel.indexOf('cta-label') >= 0 ? nodes.bandCtaLabel : null; };
  nodes.bandTag = el('div', 'au-band-tag');
  nodes.bandTagline = el('span', 'au-band-tagline');
  nodes.root.querySelector = nodes.root.querySelector;

  const sandbox = { window: {}, document: {}, globalThis: null };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);

  assert.equal(typeof sandbox.lpApplyAboutUs, 'function');

  sandbox.lpApplyAboutUs({
    on: true,
    layout: 'story',
    eyebrow: 'About {{businessName}}',
    heading: 'Built on trade skills.',
    intro: 'Short intro.',
    body: 'Para one.\n\nPara two.',
    ctaLabel: 'Our Story',
    ctaAction: 'scroll',
    ctaTarget: 'quote',
    image: 'https://example.com/f.jpg',
    quote: 'Good work helps people move forward.',
    quoteAttr: 'Founder',
    bandOn: true,
    bandHeading: 'You do not have to manage it all yourself.',
    bandSub: 'Let’s talk.',
    bandCtaLabel: 'Start the Conversation',
    bandTagline: 'Same home. New possibilities.',
    bandBg: '#0a2744'
  }, nodes.root, { business: 'Ace Co', theme: { hivis: '#e87722' } });

  assert.ok(nodes.root.classList.contains('au-on'));
  assert.equal(nodes.eyebrow.textContent, 'About Ace Co');
  assert.equal(nodes.heading.textContent, 'Built on trade skills.');
  assert.match(nodes.body.innerHTML, /Para one/);
  assert.match(nodes.body.innerHTML, /Para two/);
  assert.equal(nodes.ctaLabel.textContent, 'Our Story');
  assert.equal(nodes.cta.attrs.href, '#quote');
  assert.equal(nodes.img.attrs.src, 'https://example.com/f.jpg');
  assert.match(nodes.quoteText.textContent, /Good work/);
  assert.ok(nodes.band.classList.contains('au-band-on'));
  assert.equal(nodes.bandHeading.textContent, 'You do not have to manage it all yourself.');
  assert.equal(nodes.bandTagline.textContent, 'Same home. New possibilities.');
  assert.equal(nodes.root.style['--au-accent'], '#e87722');

  sandbox.lpApplyAboutUs({ on: true, layout: 'story', bandOn: false, heading: 'Hi' }, nodes.root, {});
  assert.ok(!nodes.band.classList.contains('au-band-on'));
});

test('manage editor exposes layout + optional band controls', function () {
  assert.match(manage, /sub==='aboutUs'/);
  assert.match(manage, /id="au-layout"/);
  assert.match(manage, /Story \(3-column\)/);
  assert.match(manage, /id="au-band-on"/);
  assert.match(manage, /Show blue bottom band/);
  assert.match(manage, /id="au-band-heading"/);
  assert.match(manage, /id="au-quote"/);
});

test('api-apps auto-registers About Us for App Marketplace', function () {
  const apiApps = fs.readFileSync(path.join(root, 'api/api-apps.js'), 'utf8');
  assert.match(apiApps, /ensureAboutUsApp/);
  assert.match(apiApps, /section_key:\s*'aboutUs'/);
  assert.match(apiApps, /slug:\s*'about-us'/);
  assert.match(apiApps, /builder_visible:\s*true/);
  assert.match(apiApps, /await ensureAboutUsApp\(\)/);
  assert.match(apiApps, /default_position:\s*'upper'/);
});

test('manage injects About Us builtin for Apps picker fallback', function () {
  assert.match(manage, /function _aaInjectBuiltinApps/);
  assert.match(manage, /section_key:'aboutUs'/);
  assert.match(manage, /slug:'about-us'/);
  assert.match(manage, /name:'About Us'/);
});

test('register script exists for ops', function () {
  assert.ok(fs.existsSync(path.join(root, 'scripts/register-about-us-app.js')));
  const reg = fs.readFileSync(path.join(root, 'scripts/register-about-us-app.js'), 'utf8');
  assert.match(reg, /section_key:\s*SECTION_KEY|section_key:\s*'aboutUs'|SECTION_KEY\s*=\s*'aboutUs'/);
  assert.match(reg, /about-us/);
});

test('demo-aboutUs enables story + band by default', function () {
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-aboutUs.html'), 'utf8');
  assert.match(demo, /"aboutUs"\s*:\s*\{[\s\S]*"on"\s*:\s*true/);
  assert.match(demo, /"layout"\s*:\s*"story"/);
  assert.match(demo, /"bandOn"\s*:\s*true/);
  assert.match(demo, /lp-about-us\.js/);
  assert.match(demo, /au-band/);
});
