'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('How It Works mobile tightness', () => {
  it('hides icons and arrows and tightens gaps below 900px in demo-shared.css', () => {
    const css = read('marketplace/demos/demo-shared.css');
    const media = css.match(/@media\(max-width:900px\)\{[\s\S]*?\.sp-steps[\s\S]*?\n\}/);
    assert.ok(media, 'expected mobile media block for .sp-steps');
    const block = media[0];
    assert.match(block, /\.sp-arrow\{display:none!important\}/);
    assert.match(block, /\.sp-ic\{display:none!important\}/);
    assert.match(block, /gap:10px 0/);
    assert.doesNotMatch(block, /transform:rotate\(90deg\)/);
  });

  it('ships the same mobile rules in trade and landing-shell templates', () => {
    for (const rel of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
      const html = JSON.parse(read(rel)).html;
      assert.match(html, /\.sp-arrow\{display:none!important\}/);
      assert.match(html, /\.sp-ic\{display:none!important\}/);
      assert.match(html, /@media\(max-width:900px\)\{[\s\S]*?\.sp-steps\{flex-wrap:wrap;gap:10px 0/);
    }
  });
});
