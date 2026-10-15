'use strict';

/**
 * Why section: the editor's reason heading / text / icon colours and item outline are saved as
 * --why-* variables on the section; the stylesheet must read them, and only when they are set.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'lp-layouts.css'), 'utf8');
const tpl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'trade.template.json'), 'utf8')).html;

test('why colour variables are applied only when set', () => {
  assert.match(css, /\[data-sec="why"\]\[style\*="--why-heading"\] \.why-item h3\{color:var\(--why-heading\)\}/);
  assert.match(css, /\[data-sec="why"\]\[style\*="--why-text"\] \.why-item p\{color:var\(--why-text\)\}/);
  assert.match(css, /\[style\*="--why-icon"\] \.why-item \.wic\{color:var\(--why-icon\)\}/);
  assert.match(css, /\[style\*="--why-item-stroke"\] \.why-item\{border:var\(--why-item-stroke-w,1px\) solid var\(--why-item-stroke\)/);
});

test('template sets the variables the stylesheet reads', () => {
  for (const v of ['--why-heading', '--why-text', '--why-icon', '--why-item-stroke']) {
    assert.ok(tpl.includes("'" + v + "'"), v);
  }
});
