'use strict';

/**
 * Image library: reachable from the Site tools menu (classic and new look), and tiles stay a
 * fixed square showing the whole image, with the grid scrolling instead of squeezing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '..', 'assets', 'lp-ui-shell.js'), 'utf8');

test('Site tools has an Image library button that opens the library', () => {
  assert.match(manage, /il\.id='lpc-image-library'/);
  assert.match(manage, /il\.addEventListener\('click',function\(\)\{ if\(typeof cwLibOpen==='function'\) cwLibOpen\(\); \}\)/);
  assert.match(shell, /'lpc-backups', 'lpc-image-library'/);
  assert.match(shell, /\[\/image library\/i, 'images'\]/);
});

test('library tiles are fixed squares showing the whole image; the grid scrolls', () => {
  assert.match(manage, /#cwlib \.cwl-img\{aspect-ratio:1\/1;/);
  assert.match(manage, /#cwlib \.cwl-img img\{width:100%;height:100%;object-fit:contain;/);
  assert.match(manage, /#cwlib \.cwl-grid\{[^}]*overflow-y:auto;[^}]*grid-auto-rows:max-content;[^}]*min-height:0\}/);
  assert.match(manage, /c_limit,w_360,h_360,f_auto,q_auto/);
});
