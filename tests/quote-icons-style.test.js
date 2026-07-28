/**
 * Quote trust-point icons: colour picker, no fill, global size (default +50%).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function tplHtml(rel) {
  return JSON.parse(read(rel)).html;
}

test('manage quoteStyleCard exposes icon colour + size slider', () => {
  const m = read('manage.html');
  assert.match(m, /Trust point icons/);
  assert.match(m, /colWire\('qf-icon','iconColor'\)/);
  assert.match(m, /id="qf-sc"/);
  assert.match(m, /Q\(\)\.iconScale/);
  assert.match(m, /iconColor:\(th\.hivis\|\|'#ff6a1f'\)/);
});

test('demo-shared.css: transparent icon badges, CSS size/colour vars', () => {
  const css = read('marketplace/demos/demo-shared.css');
  assert.match(css, /\.q-points \.t\{[^}]*background:transparent/);
  assert.match(css, /--qf-icon-size,23px/);
  assert.match(css, /color:var\(--qf-icon,var\(--hivis\)\)/);
  assert.doesNotMatch(css, /\[data-sec="quote"\]\.qf-acc \.q-points \.t\{background:var\(--qf-accent\)\}/);
  assert.match(css, /\[data-sec="quote"\]\.qf-icon \.q-points \.t\{color:var\(--qf-icon\)\}/);
});

test('demo-shared.js applies iconColor and iconScale', () => {
  const js = read('marketplace/demos/demo-shared.js');
  assert.match(js, /_qf\('--qf-icon','qf-icon',Q\.iconColor\)/);
  assert.match(js, /Q\.iconScale/);
  assert.match(js, /Math\.round\(23\*Math\.max\(50,Math\.min\(250,_isc\)\)\/100\)/);
});

test('trade + landing shell templates include icon styling', () => {
  for (const rel of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
    const html = tplHtml(rel);
    assert.match(html, /background:transparent/, rel);
    assert.match(html, /--qf-icon-size,23px/, rel);
    assert.match(html, /Q\.iconScale/, rel);
    assert.doesNotMatch(
      html,
      /\[data-sec="quote"\]\.qf-acc \.q-points \.t\{background:var\(--qf-accent\)\}/,
      rel
    );
  }
});
