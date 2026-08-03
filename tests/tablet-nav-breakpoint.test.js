/**
 * Tablet/phone must not lose navigation:
 * - mobile bar aligns to ≤900px (same band as compact header)
 * - header navMenu gets a hamburger drawer (lp-compact-nav) so page
 *   links remain reachable even when Mobile Bar has no Menu configured
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

describe('tablet / mobile nav access', () => {
  for (const [name, css] of [
    ['demo-shared.css', demoCss],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: mobile bar + compact header menu share the ≤900px band`, () => {
      assert.match(css, /@media\(max-width:900px\)\{\.mobile-call\{display:block\}\}/);
      assert.doesNotMatch(css, /@media\(max-width:680px\)\{\.mobile-call\{display:block\}\}/);
      assert.match(css, /@media\(min-width:901px\)\{\.lpm-backdrop,\.lpm-panel\{display:none!important\}\}/);
      assert.match(css, /html\.lp-compact-nav header\.site \.head-nav\{display:none\}/);
      assert.match(css, /html\.lp-compact-nav header\.site \.head-menu-btn\{display:inline-flex\}/);
      assert.match(css, /\.hnm-panel\{/);
      assert.match(css, /@media\(min-width:901px\)\{\.hnm-backdrop,\.hnm-panel\{display:none!important\}\}/);
    });
  }

  for (const [name, js] of [
    ['demo-shared.js', demoJs],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: builds a header hamburger from navMenu items`, () => {
      assert.match(js, /classList\.add\('lp-compact-nav'\)/);
      assert.match(js, /classList\.remove\('lp-compact-nav'\)/);
      assert.match(js, /head-menu-btn/);
      assert.match(js, /hnm-panel/);
      assert.match(js, /hnm-item/);
      assert.match(js, /\.head-nav,\.head-menu-btn/);
    });
  }
});
