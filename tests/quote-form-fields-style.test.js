/**
 * Quote form: bg opacity, outer stroke, visible fields, extra fields → lead email.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { detailLines } = require('../lib/lead-notify-email');

const ROOT = path.join(__dirname, '..');
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function tplHtml(rel) {
  return JSON.parse(read(rel)).html;
}

test('manage: opacity slider, stroke, visible + extra fields UI', () => {
  const m = read('manage.html');
  assert.match(m, /id="qf-bgop"/);
  assert.match(m, /formStrokeOn/);
  assert.match(m, /colWire\('qf-stroke','formStroke'\)/);
  assert.match(m, /showFieldsCard/);
  assert.match(m, /wireShowFields/);
  assert.match(m, /q-show-suburb/);
  assert.match(m, /quoteExtraFields/);
  assert.match(m, /listEditor\(\$\('le-quoteExtraFields'\),c,'quoteExtraFields'\)/);
});

test('CSS supports transparent form bg + outer stroke', () => {
  const css = read('marketplace/demos/demo-shared.css');
  assert.match(css, /--qf-bg-opacity/);
  assert.match(css, /color-mix\(in srgb,var\(--qf-bg-solid/);
  assert.match(css, /\[data-sec="quote"\]\.qf-stroke \.qcard/);
  assert.match(css, /\.ff\[data-qf\]\.qf-off/);
});

test('applyCfg sets opacity, stroke, visibility, extra fields', () => {
  const js = read('marketplace/demos/demo-shared.js');
  assert.match(js, /--qf-bg-opacity/);
  assert.match(js, /formStrokeOn/);
  assert.match(js, /showSuburb/);
  assert.match(js, /quoteExtraFields/);
  assert.match(js, /q-extra-/);
});

test('templates: field mounts + submit includes extraFields', () => {
  for (const rel of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
    const html = tplHtml(rel);
    assert.match(html, /data-qf="suburb"/, rel);
    assert.match(html, /id="quoteExtraFields"/, rel);
    assert.match(html, /extraFields:_extras/, rel);
    assert.match(html, /showName/, rel);
  }
});

test('detailLines includes custom extra field titles in owner email', () => {
  const rows = detailLines({
    job: 'Hire',
    suburb: 'Acton',
    detail: 'Saturday',
    extraFields: [
      { label: 'Company name', value: 'Bean Culture' },
      { label: 'Guest count', value: '120' }
    ]
  });
  const map = Object.fromEntries(rows);
  assert.equal(map['Company name'], 'Bean Culture');
  assert.equal(map['Guest count'], '120');
  assert.equal(map.Problem, 'Hire');
  assert.equal(map.Message, 'Saturday');
  assert.ok(!rows.some((r) => r[0] === 'Extrafields' || /Acton/.test(r[1])));
});
