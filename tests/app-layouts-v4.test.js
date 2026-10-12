'use strict';

/**
 * More opt-in layouts (assets/lp-layouts.js + manage.html): Newsreader Heritage font set,
 * header button rectangle + arrow, menu in spaced capitals, Services "Story", How It Works
 * "Journey", Project Portfolio "Feature cards", hero headline / eyebrow case and eyebrow
 * position. Every option is off until chosen.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/lp-layouts.js');
const css = read('assets/lp-layouts.css');
const manage = read('manage.html');
const F = require('../assets/lp-fonts.js');

test('Heritage font set: serif headings and body, sans-serif small capitals', () => {
  assert.ok(F.ORDER.includes('heritage'));
  const out = F.css('heritage');
  assert.match(out, /--lp-font-head:"Newsreader"/);
  assert.match(out, /--lp-font-body:"Newsreader"/);
  assert.match(out, /--lp-font-label:"Jost"/);
  assert.match(out, /\.eyebrow,[^{]*\{font-family:var\(--lp-font-label\)/);
  assert.match(F.googleUrl(F.SETS.heritage), /family=Newsreader.*family=Jost/);
  // Sets without an eyebrow font are unchanged.
  assert.doesNotMatch(F.css('oswald'), /--lp-font-label/);
  assert.match(manage, /s\.eyebrow\?/);
});

test('every new option is drawn, styled and opt-in', () => {
  for (const [key, cls] of [
    ["H.btnShape === 'rect'", 'lpl-cta-rect'],
    ['H.btnArrow === true', 'lpl-cta-arrow'],
    ["NM.textStyle === 'caps'", 'lpl-nav-caps'],
    ["SV.mode === 'story'", 'svcs-story'],
    ["SP.layout === 'journey'", 'sp-journey'],
    ["FP.layout === 'cards'", 'fp-feature'],
    ["S.eyebrowPos === 'below'", 'lpl-eb-below']
  ]) {
    assert.ok(js.indexOf(key) >= 0, key);
    assert.ok(css.indexOf(cls) >= 0, cls + ' styled');
  }
  assert.match(css, /lpl-hcase-lower[^{]*\{text-transform:lowercase/);
  assert.match(js, /STEPS = \[heroSlider, heroBanners, headerCta, featuredProjects, services,/);
});

test('the editor offers each option', () => {
  for (const re of [
    /id="hd-shape"/, /id="hd-arrow"/, /id="nm-textstyle"/,
    /<option value="story"/, /\['journey','Journey/, /\['cards','Feature cards/,
    /k:'eyebrowPos',label:'Eyebrow position'/, /\['lower','all lowercase'\]/,
    /hero:\{title:'Text options'/, /splitHero:\{title:'Text options'/,
    /services:\{title:'Story layout',when:'mode=story'/, /k:'link',label:'Card link \(Feature cards\)'/
  ]) assert.match(manage, re);
});

test('eyebrow moves below the headline and back', () => {
  // Minimal DOM: one wrap with eyebrow then heading.
  const vm = require('vm');
  function el(cls) {
    return { cls, parentNode: null, matches(sel) { return sel === '.' + this.cls; } };
  }
  const wrap = { children: [], insertBefore(n, ref) {
    this.children = this.children.filter((c) => c !== n);
    const i = ref ? this.children.indexOf(ref) : this.children.length;
    this.children.splice(i < 0 ? this.children.length : i, 0, n);
  } };
  const e = el('hsl-eyebrow'), h = el('hsl-h');
  [e, h].forEach((n) => { n.parentNode = wrap; wrap.children.push(n); });
  Object.defineProperty(h, 'nextSibling', { get() { return wrap.children[wrap.children.indexOf(h) + 1] || null; } });
  h.compareDocumentPosition = (o) => (wrap.children.indexOf(o) > wrap.children.indexOf(h) ? 4 : 2);
  const node = { classList: { toggle() {} }, querySelectorAll: (s) => (s === '.hsl-h' ? [h] : []) };
  const src = js.replace('window.__lpLayoutsRun = run;', 'window.__lpLayoutsRun = run; window.__t = heroText;');
  const win = { addEventListener() {} };
  const doc = { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  vm.runInNewContext(src, { window: win, document: doc, setTimeout() {}, getComputedStyle() { return {}; } });
  win.__t(node, { eyebrowPos: 'below' }, '.hsl-h', '.hsl-eyebrow');
  assert.deepEqual(wrap.children.map((c) => c.cls), ['hsl-h', 'hsl-eyebrow']);
  win.__t(node, {}, '.hsl-h', '.hsl-eyebrow');
  assert.deepEqual(wrap.children.map((c) => c.cls), ['hsl-eyebrow', 'hsl-h']);
});
