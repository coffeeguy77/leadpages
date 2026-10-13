'use strict';

/**
 * Landing pages: "App layout" pages (apps only), "Start blank" unique apps that don't fall
 * back to homepage content, Duplicate page, and slug typing (no per-keystroke history/reloads).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

function mergeFn() {
  const i = tpl.indexOf('function _lpDeepMergeSec(home, page){');
  const j = tpl.indexOf('function _lpMergedPageConfig', i);
  const ctx = {};
  vm.runInNewContext(tpl.slice(i, j) + ';this.m=_lpDeepMergeSec;', ctx);
  return ctx.m;
}

test('template: owned page sections win (empty included); others still fall back to the homepage', () => {
  const raw = mergeFn();
  const m = (a, b) => JSON.parse(JSON.stringify(raw(a, b)));
  const home = { mode: 'stacked', badges: [{ label: 'Beef' }], heading: 'Home' };
  assert.deepEqual(m(home, { badges: [], heading: '' }).badges, [{ label: 'Beef' }]);
  const own = m(home, { _own: true, badges: [{ label: 'Grass fed' }], heading: '' });
  assert.deepEqual(own.badges, [{ label: 'Grass fed' }]);
  assert.equal(own.heading, '');
  assert.equal(own.mode, 'stacked');
  assert.deepEqual(m(home, { _own: true, badges: [] }).badges, []);
});

test('editor: Start blank, App layout pages, Duplicate page', () => {
  assert.match(manage, /function lpPageAppStartBlank\(secKey\)/);
  assert.match(manage, /class="btn ghost sm lp-app-blank"/);
  assert.match(manage, /if\(sec&&sec\._own===true\) return false;/);
  assert.match(manage, /_own===true\) return;/);
  assert.match(manage, /id="lp-new-apps"/);
  assert.match(manage, /id="lp-kind"/);
  assert.match(manage, /#lp-editor\.lp-kind-apps \.lp-art\{display:none!important;\}/);
  assert.match(manage, /id="lp-dup"/);
});

test('editor: slug history keeps only the address at open; preview reload is debounced', () => {
  const f = manage.slice(manage.indexOf('  function lpField(f,v){'), manage.indexOf('  function lpImgPrev()'));
  assert.match(f, /var was=lpSlugAtOpen;/);
  assert.doesNotMatch(f, /if\(prevSlug&&next&&prevSlug!==next\)/);
  assert.match(f, /_lpSlugPrevT=setTimeout/);
});
