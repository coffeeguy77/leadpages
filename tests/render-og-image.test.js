// api/render.js — optional social share image (cfg.ogImage).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../api/render.js'), 'utf8');

test('og:image is only added when the site sets an https cfg.ogImage', () => {
  assert.match(src, /const _ogImg = String\(cfg\.ogImage \|\| ''\)\.trim\(\);/);
  assert.match(src, /if \(\/\^https:\\\/\\\/\[\^\\s"'<>\]\+\$\/i\.test\(_ogImg\)\)/);
  assert.match(src, /<meta property="og:image" content="' \+ esc\(_ogImg\)/);
  assert.match(src, /<meta name="twitter:image" content="' \+ esc\(_ogImg\)/);
});

test('the trade template itself still has no og:image (other sites unchanged)', () => {
  const html = JSON.parse(fs.readFileSync(path.join(__dirname, '../trade.template.json'), 'utf8')).html;
  assert.doesNotMatch(html, /property="og:image"/);
  assert.match(html, /property="og:locale"/);
});
