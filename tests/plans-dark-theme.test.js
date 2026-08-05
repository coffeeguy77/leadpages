/**
 * Hosting plans modal must use theme tokens — no hardcoded white card surfaces.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

const cssStart = manage.indexOf('function _plansCss');
const cssEnd = manage.indexOf('function openPlansPage');
assert.ok(cssStart > 0 && cssEnd > cssStart, '_plansCss present');
const plansCssFn = manage.slice(cssStart, cssEnd);

assert.ok(!/background:#fff/.test(plansCssFn), '_plansCss must not hardcode white backgrounds');
assert.ok(!/#f3f3ef/.test(plansCssFn), '_plansCss must not hardcode light grey');
assert.ok(plansCssFn.includes('var(--panel'), '_plansCss uses --panel for cards');
assert.ok(plansCssFn.includes('var(--surface-2') || plansCssFn.includes('var(--panel-soft'), '_plansCss uses surface tokens for plan rows');
assert.ok(plansCssFn.includes('var(--input-bg'), '_plansCss themes form controls');
assert.ok(plansCssFn.includes('var(--ink'), '_plansCss sets ink colour');

const renderStart = manage.indexOf('function _bpRender');
const collectStart = manage.indexOf('function _bpCollect');
const bpRender = manage.slice(renderStart, collectStart);
assert.ok(!/background:#f3f3ef/.test(bpRender), 'plan key readonly must not hardcode #f3f3ef');
assert.ok(!/background:#fff/.test(bpRender), '_bpRender must not hardcode white');

console.log('plans-dark-theme: ok');
