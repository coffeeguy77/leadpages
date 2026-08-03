/**
 * Tablet portrait (≈768–900px) must not fall into a nav gap:
 * desktop header nav hidden at ≤900px while mobile bar/menu only at ≤680px.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const demoCss = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const demoJs = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
const shell = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8')).html;

describe('tablet nav breakpoint alignment', () => {
  for (const [name, css] of [
    ['demo-shared.css', demoCss],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: mobile bar shows at the same ≤900px band as compact header nav`, () => {
      assert.match(css, /@media\(max-width:900px\)\{\.mobile-call\{display:block\}\}/);
      assert.doesNotMatch(css, /@media\(max-width:680px\)\{\.mobile-call\{display:block\}\}/);
      assert.match(css, /@media\(min-width:901px\)\{\.lpm-backdrop,\.lpm-panel\{display:none!important\}\}/);
      assert.doesNotMatch(css, /@media\(min-width:681px\)\{\.lpm-backdrop,\.lpm-panel\{display:none!important\}\}/);
      assert.match(css, /@media\(max-width:900px\)\{html\.lp-has-mobile-bar header\.site \.head-nav\{display:none\}\}/);
      assert.doesNotMatch(css, /@media\(max-width:900px\)\{header\.site \.head-nav\{display:none\}\}/);
    });
  }

  for (const [name, js] of [
    ['demo-shared.js', demoJs],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: toggles lp-has-mobile-bar when the mobile bar is populated`, () => {
      assert.match(js, /classList\.add\('lp-has-mobile-bar'\)/);
      assert.match(js, /classList\.remove\('lp-has-mobile-bar'\)/);
    });
  }
});
