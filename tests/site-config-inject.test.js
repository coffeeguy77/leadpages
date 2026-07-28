/**
 * SITE_CONFIG injection must treat replacement text literally.
 * String.prototype.replaceAll interprets $', $`, $&, $$ — which appears in
 * Custom HTML packs (e.g. fmtMoney `?'-$':'$'`) and previously destroyed pages.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadRenderHelpers() {
  const src = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
  // Pull the small pure helpers without executing the HTTP handler.
  const start = src.indexOf('const safeJson');
  const end = src.indexOf('function sendHtml');
  assert.ok(start >= 0 && end > start, 'helpers region');
  const sandbox = { module: { exports: {} }, exports: {}, process: { env: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(
    src.slice(start, end) + '\nthis.safeJson = safeJson; this.injectLiteral = injectLiteral;',
    sandbox
  );
  return { safeJson: sandbox.safeJson, injectLiteral: sandbox.injectLiteral };
}

test('injectLiteral does not expand $\' inside SITE_CONFIG JSON', function () {
  const { safeJson, injectLiteral } = loadRenderHelpers();
  const tpl =
    'const SITE_CONFIG = __SITE_CONFIG__;\n(function(){ var MARKER="boot"; })();\n</script>\n</html>\n';
  const cfg = {
    sections: {
      customHtml: {
        on: true,
        html: "function fmtMoney(c){return (c<0?'-$':'$')+(Math.abs(c)/100);}"
      }
    }
  };
  const out = injectLiteral(tpl, '__SITE_CONFIG__', safeJson(cfg));
  assert.equal(out.indexOf('</html>'), out.lastIndexOf('</html>'), 'template must not be spliced');
  assert.equal((out.match(/var MARKER="boot"/g) || []).length, 1);
  assert.match(out, /\\u003c0\?'-\$'\:'\$'/);
  assert.doesNotMatch(out, /\?'-;\s*\(function\(\)/);
});

test('transfer-matcher body.html has no inline script', function () {
  const body = fs.readFileSync(path.join(root, 'assets/apps/transfer-matcher/body.html'), 'utf8');
  assert.doesNotMatch(body, /<script\b/i);
  assert.match(body, /id="tm-root"/);
  assert.ok(fs.existsSync(path.join(root, 'assets/apps/transfer-matcher/app.js')));
});

test('theme-studio injectSiteConfig is dollar-safe', function () {
  const { injectSiteConfig } = require('../lib/theme-studio/render-preview');
  const tpl =
    'try{cfg=window.__SITE_CONFIG__||window.SITE_CONFIG}catch(e){}\n'
    + 'const SITE_CONFIG = __SITE_CONFIG__;\n(function(){ var MARKER="boot"; })();\n';
  const html = injectSiteConfig(tpl, {
    name: 'Test',
    sections: { customHtml: { on: true, html: "return (c<0?'-$':'$')+x" } }
  });
  assert.match(html, /window\.__SITE_CONFIG__/);
  assert.equal((html.match(/var MARKER="boot"/g) || []).length, 1);
  assert.doesNotMatch(html, /\?'-;\s*\(function\(\)/);
});
