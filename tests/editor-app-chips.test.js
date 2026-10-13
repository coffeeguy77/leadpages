'use strict';

/** Page editor app buttons: apps on the page are outlined; the one being edited is solid. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-themes.css'), 'utf8');

test('enabled app buttons are outline-only; the active one is filled', () => {
  const on = css.match(/\.lp-sec-editonly\[data-on="1"\] \{([^}]*)\}/);
  assert.ok(on, 'on rule');
  assert.match(on[1], /background: transparent;/);
  assert.match(on[1], /border-color: var\(--accent\);/);
  const act = css.match(/\.lp-sec-editonly\[data-active="1"\],\s*\.lp-sec-editonly\[data-active="1"\]:hover \{([^}]*)\}/);
  assert.ok(act, 'active rule');
  assert.match(act[1], /background: var\(--accent\);/);
  assert.ok(css.indexOf('.lp-sec-editonly[data-active="1"]') > css.indexOf('.lp-sec-editonly[data-on="1"]'), 'active wins');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8'), /lp-themes\.css\?v=editor-chips-2/);
});
