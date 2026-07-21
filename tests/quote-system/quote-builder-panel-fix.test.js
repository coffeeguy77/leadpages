/**
 * Regression: Quote Builder must not throw ReferenceError "panel is not defined"
 * when rendering wizard colour controls (calendar popup bg fallback).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const builderSrc = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

test('_renderWizardUiColors declares panel before calendarPopBg fallback', function() {
  const fn = builderSrc.match(/QuoteBuilder\.prototype\._renderWizardUiColors\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?\n  \};/);
  assert.ok(fn, 'found _renderWizardUiColors');
  assert.match(fn[0], /var panel\s*=/);
  assert.match(fn[0], /calendarPopBg/);
  assert.ok(fn[0].indexOf('var panel') < fn[0].indexOf("col('calendarPopBg'"));
});

test('_renderWizardUiColors runs without ReferenceError', function() {
  const start = builderSrc.indexOf('QuoteBuilder.prototype._renderWizardUiColors');
  assert.ok(start >= 0, 'method present');
  const end = builderSrc.indexOf('\n  };', start) + 5;
  const methodSrc = builderSrc.slice(start, end);
  const sandbox = {
    QuoteBuilder: function QuoteBuilder() {},
    console: console,
    esc: function(s) { return String(s == null ? '' : s); }
  };
  vm.createContext(sandbox);
  vm.runInContext(methodSrc, sandbox);
  const instance = {
    _accent: function() { return '#ff00aa'; },
    _colorField: function(path, label, value, fallback) {
      return '<div data-path="' + path + '" data-fallback="' + (fallback || '') + '"></div>';
    }
  };
  let html;
  assert.doesNotThrow(function() {
    html = sandbox.QuoteBuilder.prototype._renderWizardUiColors.call(instance, { ui: { panelBg: '#112233' } });
  });
  assert.match(html, /calendarPopBg/);
  assert.match(html, /data-fallback="#112233"/);
});

test('cache-bust for builder panel fix', function() {
  assert.match(manage, /oq-portal-style-1/);
  assert.match(render, /lp-online-quote\.js\?v=oq-session-token-1/);
});
